import { describe, expect, it } from "bun:test";
import "./test/setup";
import { parseOpmlFeeds } from "./opml";

describe("parseOpmlFeeds", () => {
  it("walks nested outlines and dedupes by URL", () => {
    const xml = `
      <opml version="2.0">
        <body>
          <outline text="Group">
            <outline text="One" xmlUrl="https://example.com/rss" />
            <outline text="Nested">
              <outline text="Two" xmlUrl="https://example.com/rss" />
              <outline text="Three" xmlUrl="https://example.com/three" title="Third" />
            </outline>
          </outline>
        </body>
      </opml>
    `;

    const feeds = parseOpmlFeeds(xml);
    expect(feeds.length).toBe(2);
    expect(feeds).toEqual([
      { title: "One", url: "https://example.com/rss" },
      { title: "Third", url: "https://example.com/three" },
    ]);
  });
});
