import { describe, expect, it } from "bun:test";
import "./test/setup";
import { renderHome, sanitizeSummaryHtml } from "./html";
import type { EntryRow, FeedRow } from "./db";

describe("renderHome", () => {
  const baseFeed: FeedRow & { unread_count: number } = {
    id: 1,
    url: "https://example.com/feed",
    title: "Example Feed",
    site_url: "https://example.com",
    etag: null,
    last_modified: null,
    last_fetched_at: null,
    fetch_error: null,
    created_at: "2024-01-01T00:00:00.000Z",
    raw: {},
    unread_count: 1,
  };

  const baseEntry: EntryRow & { feed_title: string | null; feed_url: string } = {
    id: 1,
    feed_id: 1,
    guid: "guid-1",
    url: "https://example.com/post/1",
    title: "MADJB + Weird Al: You&#8217;re a Mean One, Mr. Grinch",
    author: null,
    summary: null,
    published_at: "2024-01-01T12:00:00.000Z",
    fetched_at: "2024-01-01T12:00:00.000Z",
    read_at: null,
    sort_key: Date.parse("2024-01-01T12:00:00.000Z"),
    unread: 1,
    raw: {},
    feed_title: "Example Feed",
    feed_url: "https://example.com/feed",
  };

  it("decodes HTML entities in entry titles when rendering", () => {
    const html = renderHome({
      entries: [baseEntry],
      feeds: [baseFeed],
      flash: null,
    });

    expect(html).toContain("You\u2019re a Mean One, Mr. Grinch");
    expect(html).not.toContain("You&#8217;re a Mean One, Mr. Grinch");
  });
});

describe("sanitizeSummaryHtml", () => {
  it("adds target and rel to links when missing", () => {
    const summary = '<p><a href="https://example.com/path">Example link</a></p>';
    const cleaned = sanitizeSummaryHtml(summary);
    expect(cleaned).toContain('target="_blank"');
    expect(cleaned).toMatch(/rel="[^"]*noreferrer[^"]*"/);
    expect(cleaned).toMatch(/rel="[^"]*noopener[^"]*"/);
  });

  it("removes base/head tags that can hijack navigation", () => {
    const summary = `
      <head><base href="https://evil.example/"><title>oops</title></head>
      <p>hello</p>
      <a href="/?feed=1">internal</a>
    `;
    const cleaned = sanitizeSummaryHtml(summary);
    expect(cleaned.toLowerCase()).not.toContain("<base");
    expect(cleaned.toLowerCase()).not.toContain("<head");
    expect(cleaned).toContain("<p>hello</p>");
    expect(cleaned).toContain('href="/?feed=1"');
  });
});
