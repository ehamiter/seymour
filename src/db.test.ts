import { beforeEach, describe, expect, it } from "bun:test";
import "./test/setup";
import {
  db,
  ensureFeed,
  findFeedById,
  markAboveAsRead,
  markEntryRead,
  recordFetchError,
  recordFetchSuccess,
  updateFeed,
} from "./db";

beforeEach(() => {
  db.exec("DELETE FROM entries; DELETE FROM feeds;");
});

describe("recordFetchSuccess", () => {
  it("upserts feeds and entries and preserves existing values", () => {
    const feed = ensureFeed("https://example.com/rss");
    const meta = {
      etag: "etag-1",
      lastModified: "Mon, 01 Jan 2024 00:00:00 GMT",
      fetchedAt: "2024-01-02T00:00:00.000Z",
    };

    recordFetchSuccess(
      feed,
      {
        title: "Example Feed",
        site_url: "https://example.com",
        raw: { foo: true },
        entries: [
          {
            guid: "guid-1",
            url: "https://example.com/post",
            title: "First",
            author: "Author",
            summary: "<p>Hello</p>",
            published_at: "2024-01-01T00:00:00.000Z",
            raw: { a: 1 },
          },
          {
            guid: "guid-2",
            url: "https://example.com/second",
            title: "Second",
            author: null,
            summary: null,
            published_at: null,
            raw: { b: 2 },
          },
        ],
      },
      [
        {
          guid: "guid-1",
          url: "https://example.com/post",
          title: "First",
          author: "Author",
          summary: "<p>Hello</p>",
          published_at: "2024-01-01T00:00:00.000Z",
          raw: { a: 1 },
        },
        {
          guid: "guid-2",
          url: "https://example.com/second",
          title: "Second",
          author: null,
          summary: null,
          published_at: null,
          raw: { b: 2 },
        },
      ],
      meta,
    );

    const updatedFeed = findFeedById(feed.id)!;
    expect(updatedFeed.title).toBe("Example Feed");
    expect(updatedFeed.site_url).toBe("https://example.com");
    expect(updatedFeed.etag).toBe("etag-1");
    expect(updatedFeed.last_modified).toBe("Mon, 01 Jan 2024 00:00:00 GMT");
    expect(updatedFeed.last_fetched_at).toBe(meta.fetchedAt);
    expect(updatedFeed.fetch_error).toBeNull();

    const entry = db
      .prepare("SELECT * FROM entries WHERE guid = ?")
      .get("guid-1") as any;
    expect(entry.title).toBe("First");
    expect(entry.unread).toBe(1);

    // Second fetch keeps existing data when new fields are null.
    const meta2 = { ...meta, etag: "etag-2", fetchedAt: "2024-01-03T00:00:00.000Z" };
    recordFetchSuccess(
      updatedFeed,
      {
        title: "Example Feed v2",
        site_url: "https://example.com",
        raw: {},
        entries: [
          {
            guid: "guid-1",
            url: "https://example.com/post",
            title: null,
            author: null,
            summary: null,
            published_at: null,
            raw: {},
          },
        ],
      },
      [
        {
          guid: "guid-1",
          url: "https://example.com/post",
          title: null,
          author: null,
          summary: null,
          published_at: null,
          raw: {},
        },
      ],
      meta2,
    );

    const entryAfter = db
      .prepare("SELECT * FROM entries WHERE guid = ?")
      .get("guid-1") as any;
    expect(entryAfter.title).toBe("First");
    expect(entryAfter.summary).toBe("<p>Hello</p>");
    expect(entryAfter.fetched_at).toBe(meta2.fetchedAt);
  });

  it("preserves user-set custom title after subsequent fetches", () => {
    const feed = ensureFeed("https://example.com/rss");
    const meta = {
      etag: "etag-1",
      lastModified: null,
      fetchedAt: "2024-01-01T00:00:00.000Z",
    };

    recordFetchSuccess(
      feed,
      { title: "Original Feed Title", site_url: null, raw: {}, entries: [] },
      [],
      meta,
    );

    let updated = findFeedById(feed.id)!;
    expect(updated.title).toBe("Original Feed Title");

    updateFeed(feed.id, { title: "My Custom Name", url: feed.url });
    updated = findFeedById(feed.id)!;
    expect(updated.title).toBe("My Custom Name");

    recordFetchSuccess(
      updated,
      { title: "Original Feed Title", site_url: null, raw: {}, entries: [] },
      [],
      { ...meta, fetchedAt: "2024-01-02T00:00:00.000Z" },
    );

    updated = findFeedById(feed.id)!;
    expect(updated.title).toBe("My Custom Name");
  });
});

describe("fetch error bookkeeping", () => {
  it("records fetch errors", () => {
    const feed = ensureFeed("https://example.com/rss");
    recordFetchError(feed.id, "boom");
    const updated = findFeedById(feed.id)!;
    expect(updated.fetch_error).toBe("boom");
    expect(updated.last_fetched_at).toBeTruthy();
  });
});

describe("marking entries as read", () => {
  it("marks single entry and above pivot as read", () => {
    const feed = ensureFeed("https://example.com/rss");
    const meta = { etag: null, lastModified: null, fetchedAt: "2024-01-05T00:00:00.000Z" };
    recordFetchSuccess(
      feed,
      {
        title: "Feed",
        site_url: null,
        raw: {},
        entries: [
          {
            guid: "a",
            url: "https://example.com/a",
            title: "A",
            author: null,
            summary: null,
            published_at: "2024-01-04T00:00:00.000Z",
            raw: {},
          },
          {
            guid: "b",
            url: "https://example.com/b",
            title: "B",
            author: null,
            summary: null,
            published_at: "2024-01-03T00:00:00.000Z",
            raw: {},
          },
        ],
      },
      [
        {
          guid: "a",
          url: "https://example.com/a",
          title: "A",
          author: null,
          summary: null,
          published_at: "2024-01-04T00:00:00.000Z",
          raw: {},
        },
        {
          guid: "b",
          url: "https://example.com/b",
          title: "B",
          author: null,
          summary: null,
          published_at: "2024-01-03T00:00:00.000Z",
          raw: {},
        },
      ],
      meta,
    );

    const rows = db.prepare("SELECT * FROM entries ORDER BY sort_key DESC").all() as any[];
    const first = rows[0]!;
    const second = rows[1]!;

    markEntryRead(first.id);
    const firstAfter = db.prepare("SELECT unread, read_at FROM entries WHERE id = ?").get(first.id) as any;
    expect(firstAfter.unread).toBe(0);
    expect(firstAfter.read_at).toBeTruthy();

    markAboveAsRead(second.sort_key);
    const secondAfter = db.prepare("SELECT unread, read_at FROM entries WHERE id = ?").get(second.id) as any;
    expect(secondAfter.unread).toBe(0);
    expect(secondAfter.read_at).toBeTruthy();
  });
});
