import { XMLParser } from "fast-xml-parser";

export type OpmlFeed = { title: string | null; url: string };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: true,
  parseAttributeValue: false,
});

export function parseOpmlFeeds(xml: string): OpmlFeed[] {
  const doc = parser.parse(xml);
  const outlines = doc?.opml?.body?.outline ?? doc?.body?.outline ?? doc?.outline;
  const feeds: OpmlFeed[] = [];
  walk(outlines, feeds);

  const deduped = new Map<string, OpmlFeed>();
  for (const feed of feeds) {
    if (!feed.url) continue;
    if (!deduped.has(feed.url)) deduped.set(feed.url, feed);
  }
  return Array.from(deduped.values());
}

function walk(node: any, feeds: OpmlFeed[]) {
  if (!node) return;
  const nodes = Array.isArray(node) ? node : [node];

  for (const item of nodes) {
    const url = item?.["@_xmlUrl"] ?? item?.xmlUrl;
    const title = item?.["@_title"] ?? item?.["@_text"] ?? item?.title ?? item?.text ?? null;
    if (url) {
      feeds.push({ url: String(url), title: title ? String(title) : null });
    }
    if (item?.outline) {
      walk(item.outline, feeds);
    }
  }
}
