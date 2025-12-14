import { describe, expect, it } from "bun:test";
import "./test/setup";
import { parseFeed } from "./feed-parser";

const rssSample = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Example RSS</title>
    <link>https://example.com</link>
    <item>
      <title>Item One</title>
      <link>https://example.com/one</link>
      <description><![CDATA[<p>Hello there</p>]]></description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <enclosure url="https://cdn.example.com/cover.jpg" type="image/jpeg" />
    </item>
    <item>
      <title>Item Two</title>
      <link>https://example.com/two</link>
      <guid>two-guid</guid>
      <description><![CDATA[Check <a href="https://example.com/link">this link</a>.]]></description>
      <media:content url="https://cdn.example.com/thumb.png" type="image/png" />
    </item>
  </channel>
</rss>`;

const atomSample = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Atom Feed</title>
  <link rel="alternate" href="https://atom.example.com" />
  <link rel="self" href="https://atom.example.com/feed.atom" />
  <entry>
    <id>tag:atom.example.com,2024:1</id>
    <title>Atom Item</title>
    <link rel="alternate" href="https://atom.example.com/entries/1" />
    <updated>2024-02-10T10:30:00Z</updated>
    <content type="html"><![CDATA[<p>Atom <strong>content</strong> with a <a href="https://atom.example.com/more">link</a>.</p>]]></content>
    <media:thumbnail url="https://atom.example.com/thumb.webp" type="image/webp" />
  </entry>
</feed>`;

const rdfSample = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
  <channel>
    <title>RDF Feed</title>
    <link>https://rdf.example.com</link>
    <item>
      <title>RDF item</title>
      <link>https://rdf.example.com/1</link>
      <description>Plain text entry</description>
    </item>
  </channel>
</rdf:RDF>`;

describe("parseFeed", () => {
  it("parses RSS and injects enclosure media into summaries", () => {
    const parsed = parseFeed(rssSample);
    expect(parsed.title).toBe("Example RSS");
    expect(parsed.site_url).toBe("https://example.com");
    expect(parsed.entries.length).toBe(2);

    const first = parsed.entries[0]!;
    expect(first.published_at).toBe("2024-01-01T12:00:00.000Z");
    expect(first.guid).toBeTruthy();
    expect(first.summary).toContain('<img src="https://cdn.example.com/cover.jpg" alt="Item One" />');
    expect(first.summary).toContain("<p>Hello there</p>");

    const second = parsed.entries[1]!;
    expect(second.summary).toContain('<img src="https://cdn.example.com/thumb.png" alt="Item Two" />');
    expect(second.summary).toContain('<a href="https://example.com/link">this link</a>');
  });

  it("parses Atom feeds with HTML content and media thumbnails", () => {
    const parsed = parseFeed(atomSample);
    expect(parsed.title).toBe("Atom Feed");
    expect(parsed.site_url).toBe("https://atom.example.com");
    expect(parsed.entries.length).toBe(1);

    const entry = parsed.entries[0]!;
    expect(entry.url).toBe("https://atom.example.com/entries/1");
    expect(entry.published_at).toBe("2024-02-10T10:30:00.000Z");
    expect(entry.summary).toContain("<strong>content</strong>");
    expect(entry.summary).toContain('<a href="https://atom.example.com/more">link</a>');
    expect(entry.summary).toContain('<img src="https://atom.example.com/thumb.webp" alt="Atom Item" />');
  });

  it("parses RDF/RSS 1.0 feeds", () => {
    const parsed = parseFeed(rdfSample);
    expect(parsed.title).toBe("RDF Feed");
    expect(parsed.entries.length).toBe(1);
    const entry = parsed.entries[0]!;
    expect(entry.url).toBe("https://rdf.example.com/1");
    expect(entry.summary).toBe("Plain text entry");
  });
});
