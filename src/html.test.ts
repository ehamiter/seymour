import { describe, expect, it } from "bun:test";
import "./test/setup";
import { renderHome, sanitizeSummaryHtml } from "./html";
import type { EntryRow, FeedRow } from "./db";
import { mountHtmlDocument } from "./test/dom-helpers";

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

  it("uses a shrinkable grid column to avoid overflow on long summaries", () => {
    const html = renderHome({
      entries: [
        {
          ...baseEntry,
          summary: "<pre><code>" + "x".repeat(2000) + "</code></pre>",
        },
      ],
      feeds: [baseFeed],
      flash: null,
    });

    expect(html).toContain("grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);");
    expect(html).toContain(".summary pre {");
    expect(html).toContain("min-width: 0;");
  });

  it("percent-encodes backticks in summary data attributes", () => {
    const html = renderHome({
      entries: [
        {
          ...baseEntry,
          summary: "Here is code: ```console.log('ok')```",
        },
      ],
      feeds: [baseFeed],
      flash: null,
    });

    expect(html).toContain("data-raw=");
    expect(html).toContain("%60%60%60");
  });

  it("does not server-render malformed HTML that could break the document", () => {
    const malformed = "<pre><code>oops";
    const html = renderHome({
      entries: [
        {
          ...baseEntry,
          summary: malformed,
        },
      ],
      feeds: [baseFeed],
      flash: null,
    });

    expect(html).toContain("data-raw=");
    expect(html).not.toContain(malformed);
  });

  it("hydrates summary previews into sanitized HTML on the client", () => {
    const html = renderHome({
      entries: [
        {
          ...baseEntry,
          summary: "<p>Hello <strong>world</strong>.</p>",
        },
      ],
      feeds: [baseFeed],
      flash: null,
    });

    const ctx = mountHtmlDocument(html);
    try {
      const summary = ctx.document.querySelector(".summary");
      expect(summary?.innerHTML).toContain("<p>");
      expect(summary?.innerHTML).toContain("<strong>world</strong>");
    } finally {
      ctx.restore();
    }
  });

  it("collapses link-adjacent <br> tags in hydrated summaries into spaces", () => {
    const html = renderHome({
      entries: [
        {
          ...baseEntry,
          summary: '<p>Visit<br><a href="https://uncrate.example/">Uncrate</a><br>for the full post.</p>',
        },
      ],
      feeds: [baseFeed],
      flash: null,
    });

    const ctx = mountHtmlDocument(html);
    try {
      const summary = ctx.document.querySelector(".summary");
      expect(summary?.innerHTML.toLowerCase()).not.toContain("<br");
      expect((summary?.textContent ?? "").replace(/\\s+/g, " ").trim()).toBe(
        "Visit Uncrate for the full post.",
      );
    } finally {
      ctx.restore();
    }
  });

  it("preserves <br> line breaks that are not link separators", () => {
    const html = renderHome({
      entries: [
        {
          ...baseEntry,
          summary: "<p>First line<br>Second line</p>",
        },
      ],
      feeds: [baseFeed],
      flash: null,
    });

    const ctx = mountHtmlDocument(html);
    try {
      const summary = ctx.document.querySelector(".summary");
      expect(summary?.innerHTML.toLowerCase()).toContain("<br");
    } finally {
      ctx.restore();
    }
  });

  it("formats numbered plain-text lists into ordered lists", () => {
    const html = renderHome({
      entries: [
        {
          ...baseEntry,
          summary: "1.\nFirst item\n2.\nSecond item",
        },
      ],
      feeds: [baseFeed],
      flash: null,
    });

    const ctx = mountHtmlDocument(html);
    try {
      const summary = ctx.document.querySelector(".summary");
      expect(summary?.innerHTML).toContain("<ol>");
      expect(summary?.innerHTML).toContain("<li>First item</li>");
      expect(summary?.innerHTML).toContain("<li>Second item</li>");
    } finally {
      ctx.restore();
    }
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

  it("does not decode escaped tags inside syntax-highlighted HTML", () => {
    const summary =
      '<div class="highlight"><pre class="highlight"><code>' +
      '<span class="nt">&lt;section</span><span class="nt">&gt;</span>hello<span class="nt">&lt;/section&gt;</span>' +
      "</code></pre></div>";
    const cleaned = sanitizeSummaryHtml(summary);
    expect(cleaned).toContain("&lt;section");
    expect(cleaned).not.toContain("<section");
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
