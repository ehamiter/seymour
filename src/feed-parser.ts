import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { ParsedFeed, ParsedEntry } from "./db";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: true,
  parseAttributeValue: false,
});

export function parseFeed(xml: string): ParsedFeed {
  const doc = parser.parse(xml);

  if (doc?.rss) {
    return parseRss(doc.rss);
  }

  if (doc?.feed) {
    return parseAtom(doc.feed);
  }

  if (doc?.["rdf:RDF"]) {
    return parseRss(doc["rdf:RDF"]);
  }

  throw new Error("Unrecognized feed format");
}

function parseRss(rss: any): ParsedFeed {
  const channel = Array.isArray(rss?.channel) ? rss.channel[0] : rss?.channel ?? rss;
  const feedTitle = text(channel?.title);
  const siteUrl = text(channel?.link);
  const items = toArray(channel?.item);

  const entries: ParsedEntry[] = items
    .map((item: any) => {
      const guid =
        text(item?.guid?.["#text"] ?? item?.guid) ??
        text(item?.link) ??
        text(item?.title) ??
        hashEntry(item);

      const published =
        normalizeDate(item?.pubDate) ??
        normalizeDate(item?.published) ??
        normalizeDate(item?.["dc:date"]) ??
        null;

      const imageUrl = findImageUrl(item);
      let summary =
        text(item?.["content:encoded"]) ??
        text(item?.description) ??
        text(item?.summary) ??
        null;

      if (imageUrl) {
        const hasImg = summary ? /<\s*img/i.test(summary) : false;
        if (!hasImg) {
          const alt = text(item?.title) ?? "";
          const imgTag = `<p><img src="${imageUrl}" alt="${escapeHtmlAttr(alt)}" /></p>`;
          summary = summary ? imgTag + summary : imgTag;
        }
      }

      return {
        guid,
        url: text(item?.link) ?? null,
        title: text(item?.title) ?? null,
        author: text(item?.["dc:creator"]) ?? null,
        summary,
        published_at: published,
        raw: item,
      } satisfies ParsedEntry;
    })
    .filter(Boolean) as ParsedEntry[];

  return {
    title: feedTitle ?? null,
    site_url: siteUrl ?? null,
    raw: channel,
    entries,
  };
}

function parseAtom(feed: any): ParsedFeed {
  const entriesRaw = toArray(feed?.entry);
  const feedTitle = text(feed?.title) ?? null;
  const siteUrl = pickLink(feed?.link);

  const entries: ParsedEntry[] = entriesRaw
    .map((entry: any) => {
      const link = pickLink(entry?.link);
      const guid = text(entry?.id) ?? link ?? text(entry?.title) ?? hashEntry(entry);
      const published = normalizeDate(entry?.published) ?? normalizeDate(entry?.updated) ?? null;
      const summary =
        text(entry?.summary?.["#text"] ?? entry?.summary) ??
        text(entry?.content?.["#text"] ?? entry?.content) ??
        null;

      return {
        guid,
        url: link,
        title: text(entry?.title?.["#text"] ?? entry?.title) ?? null,
        author: text(entry?.author?.name ?? entry?.author?.["#text"]),
        summary,
        published_at: published,
        raw: entry,
      } satisfies ParsedEntry;
    })
    .filter(Boolean) as ParsedEntry[];

  return {
    title: feedTitle,
    site_url: siteUrl,
    raw: feed,
    entries,
  };
}

function pickLink(link: any): string | null {
  const candidates = toArray(link);
  if (candidates.length === 0) return null;

  const alt = candidates.find((l: any) => l?.["@_rel"] === "alternate");
  const chosen = alt ?? candidates[0];
  const href = chosen?.["@_href"] ?? chosen?.href ?? chosen?.url ?? chosen?.["#text"];
  return href ? String(href) : null;
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object" && "#text" in (value as any)) {
    return text((value as any)["#text"]);
  }
  return null;
}

function normalizeDate(value: unknown): string | null {
  const str = text(value);
  if (!str) return null;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function hashEntry(payload: unknown): string {
  return createHash("sha1").update(JSON.stringify(payload ?? {})).digest("hex");
}

function findImageUrl(item: any): string | null {
  const enclosures = toArray(item?.enclosure ?? item?.enclosures);
  for (const enclosure of enclosures) {
    const type = (enclosure?.["@_type"] ?? enclosure?.type ?? "").toLowerCase();
    const url = enclosure?.["@_url"] ?? enclosure?.url;
    if (url && type.startsWith("image/")) return String(url);
  }

  const mediaContent = toArray(item?.["media:content"]);
  for (const media of mediaContent) {
    const type = (media?.["@_type"] ?? media?.type ?? "").toLowerCase();
    const url = media?.["@_url"] ?? media?.url ?? media?.["@_src"] ?? media?.src;
    if (url && (!type || type.startsWith("image/"))) return String(url);
  }

  return null;
}

function escapeHtmlAttr(input: string) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
