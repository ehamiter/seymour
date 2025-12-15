import { describe, expect, it } from "bun:test";
import "./test/setup";
import { renderHome } from "./html";
import { mountHtmlDocument } from "./test/dom-helpers";

const feed = {
  id: 1,
  url: "https://example.com/feed",
  title: "Example Feed",
  site_url: "https://example.com",
  etag: null,
  last_modified: null,
  last_fetched_at: null,
  fetch_error: null,
  created_at: new Date().toISOString(),
  raw: null,
  unread_count: 2,
} as const;

const entries = [
  {
    id: 21,
    feed_id: 1,
    guid: "first",
    url: "https://example.com/first",
    title: "First entry",
    author: null,
    summary: "<p>First</p>",
    published_at: "2024-01-02T00:00:00.000Z",
    fetched_at: "2024-01-02T00:00:00.000Z",
    read_at: null,
    sort_key: 2,
    unread: 1,
    raw: {},
    feed_title: "Example Feed",
    feed_url: "https://example.com/feed",
  },
  {
    id: 22,
    feed_id: 1,
    guid: "second",
    url: "https://example.com/second",
    title: "Second entry",
    author: null,
    summary: "<p>Second</p>",
    published_at: "2024-01-01T00:00:00.000Z",
    fetched_at: "2024-01-01T00:00:00.000Z",
    read_at: null,
    sort_key: 1,
    unread: 1,
    raw: {},
    feed_title: "Example Feed",
    feed_url: "https://example.com/feed",
  },
];

describe("keyboard shortcuts", () => {
  it("navigates entries and triggers actions", async () => {
    const html = renderHome({ entries, feeds: [feed] });
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetchMock: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ input, init });
      return new Response(null, { status: 204 });
    }) as any;

    const opened: Array<[string | undefined, string | undefined]> = [];
    const openMock = ((url?: string, target?: string) => {
      opened.push([url, target]);
      return undefined;
    }) as typeof open;

    const ctx = mountHtmlDocument(html, { fetchImpl: fetchMock, openImpl: openMock });
    try {
      const entryEls = Array.from(ctx.document.querySelectorAll<HTMLElement>("article.entry"));
      expect(entryEls.length).toBe(2);

      // Move down to the second entry.
      ctx.window.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "j" }));
      expect(ctx.document.activeElement).toBe(entryEls[1]);

      // Mark the focused entry as read.
      ctx.window.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "m" }));
      expect(entryEls[1].dataset.read).toBe("1");
      expect(String(fetchCalls[0]?.input)).toContain(`/entries/${entryEls[1].dataset.entryId}/read`);

      // Mark entries above pivot as read.
      ctx.window.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "M" }));
      await Promise.resolve();
      expect(entryEls[0].dataset.read).toBe("1");
      expect(entryEls[1].dataset.read).toBe("1");

      // Trigger refresh via keyboard.
      const refreshForm = ctx.document.querySelector<HTMLFormElement>('form[action="/refresh"]');
      let submitted = 0;
      if (refreshForm) {
        refreshForm.requestSubmit = () => {
          submitted += 1;
        };
        refreshForm.submit = () => {
          submitted += 1;
        };
      }
      ctx.window.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "r" }));
      expect(submitted).toBe(1);

      // Navigate to all feeds (we just verify it attempts to set location).
      let navigatedTo: string | undefined;
      Object.defineProperty(ctx.window, "location", {
        value: { ...ctx.window.location, set href(url: string) { navigatedTo = url; } },
        writable: true,
      });
      ctx.window.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "a" }));
      expect(navigatedTo).toBe("/");

      // Open the current entry in a new tab.
      ctx.window.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "v" }));
      expect(opened.length).toBe(1);
      expect(opened[0][0]).toBe(entries[1].url);
    } finally {
      ctx.restore();
    }
  });

  it("toggles the shortcuts overlay with ? and Escape", () => {
    const html = renderHome({ entries, feeds: [feed] });
    const ctx = mountHtmlDocument(html);
    try {
      const overlay = ctx.document.querySelector<HTMLElement>("[data-shortcut-overlay]");
      expect(overlay?.hasAttribute("hidden")).toBe(true);

      ctx.window.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "?" }));
      expect(overlay?.hasAttribute("hidden")).toBe(false);

      ctx.window.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "Escape" }));
      expect(overlay?.hasAttribute("hidden")).toBe(true);
    } finally {
      ctx.restore();
    }
  });
});
