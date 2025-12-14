import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "./test/setup";
import { __test__, parseRetryAfter } from "./feed-fetcher";
import { db, ensureFeed, findFeedById } from "./db";

const { fetchAndStore } = __test__;

const rssBody = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Feed</title>
    <link>https://fetch.example.com</link>
    <item>
      <title>Post</title>
      <link>https://fetch.example.com/post</link>
      <description>Body</description>
    </item>
  </channel>
</rss>`;

const originalFetch = globalThis.fetch;

beforeEach(() => {
  db.exec("DELETE FROM entries; DELETE FROM feeds;");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("parseRetryAfter", () => {
  it("parses seconds and HTTP date values", () => {
    expect(parseRetryAfter("120")).toBe(120000);
    const date = new Date(Date.now() + 60000).toUTCString();
    const delta = parseRetryAfter(date);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(60000);
  });
});

describe("fetchAndStore", () => {
  it("stores responses and backs off when validators are missing", async () => {
    const feed = ensureFeed("https://fetch.example.com/rss");
    const backoffs: Array<number> = [];

    globalThis.fetch = (async () => {
      return new Response(rssBody, {
        status: 200,
        headers: {},
      });
    }) as any;

    await fetchAndStore(feed, {
      setBackoff: (_id, delay) => backoffs.push(delay),
    });

    const updated = findFeedById(feed.id)!;
    expect(updated.etag).toBeNull();
    expect(updated.last_modified).toBeNull();
    expect(backoffs[0]).toBe(90 * 60 * 1000);

    const count = db.prepare("SELECT COUNT(*) AS c FROM entries").get() as { c: number };
    expect(count.c).toBe(1);
  });

  it("honors conditional requests with 304 responses", async () => {
    const feed = ensureFeed("https://fetch.example.com/rss");
    db.prepare("UPDATE feeds SET etag = ?, last_modified = ? WHERE id = ?").run("old", "yesterday", feed.id);
    const hydrated = findFeedById(feed.id)!;

    let seenHeaders: Headers | null = null;
    globalThis.fetch = (async (_url, init?: RequestInit) => {
      seenHeaders = new Headers(init?.headers as HeadersInit | undefined);
      return new Response(null, { status: 304, headers: { ETag: "new" } });
    }) as any;

    await fetchAndStore(hydrated);
    expect(seenHeaders?.get("If-None-Match")).toBe("old");
    expect(seenHeaders?.get("If-Modified-Since")).toBe("yesterday");
    const updated = findFeedById(feed.id)!;
    expect(updated.etag).toBe("new");
    expect(updated.last_fetched_at).toBeTruthy();
    expect(updated.fetch_error).toBeNull();
  });

  it("backs off on 429 responses using Retry-After", async () => {
    const feed = ensureFeed("https://fetch.example.com/rss");
    const backoffs: Array<number> = [];

    globalThis.fetch = (async () => {
      return new Response("", { status: 429, headers: { "Retry-After": "120" } });
    }) as any;

    await fetchAndStore(feed, {
      setBackoff: (_id, delay) => backoffs.push(delay),
    });

    const updated = findFeedById(feed.id)!;
    expect(updated.fetch_error).toContain("HTTP 429");
    expect(backoffs[0]).toBe(120000);
  });

  it("records errors and applies error backoff", async () => {
    const feed = ensureFeed("https://fetch.example.com/rss");
    const backoffs: Array<number> = [];

    globalThis.fetch = (async () => {
      throw new Error("boom");
    }) as any;

    await fetchAndStore(feed, {
      setBackoff: (_id, delay) => backoffs.push(delay),
    });

    const updated = findFeedById(feed.id)!;
    expect(updated.fetch_error).toContain("boom");
    expect(backoffs[0]).toBe(60 * 60 * 1000);
  });
});
