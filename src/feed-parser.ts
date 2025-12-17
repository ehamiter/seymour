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
        richText(item?.["content:encoded"]) ??
        richText(item?.description) ??
        richText(item?.summary) ??
        null;

      if (imageUrl) {
        const hasImg = summary ? /<\s*img/i.test(summary) : false;
        if (!hasImg) {
          const alt = text(item?.title) ?? "";
          const imgTag = `<p><img src="${imageUrl}" alt="${escapeHtmlAttr(alt)}" /></p>`;
          summary = summary ? imgTag + summary : imgTag;
        }
      }

      const url = text(item?.link) ?? (guid.startsWith("http") ? guid : null);

      return {
        guid,
        url,
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
      const imageUrl = findImageUrl(entry);
      const summary =
        richText(entry?.summary) ??
        richText(entry?.content) ??
        null;

      let hydratedSummary = summary;
      if (imageUrl) {
        const hasImg = hydratedSummary ? /<\s*img/i.test(hydratedSummary) : false;
        if (!hasImg) {
          const alt = text(entry?.title) ?? "";
          const imgTag = `<p><img src="${imageUrl}" alt="${escapeHtmlAttr(alt)}" /></p>`;
          hydratedSummary = hydratedSummary ? imgTag + hydratedSummary : imgTag;
        }
      }

      return {
        guid,
        url: link,
        title: text(entry?.title?.["#text"] ?? entry?.title) ?? null,
        author: text(entry?.author?.name ?? entry?.author?.["#text"]),
        summary: hydratedSummary ?? null,
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

function richText(value: unknown, tagName?: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const rendered = value.map((v) => richText(v, tagName)).filter(Boolean) as string[];
    if (rendered.length > 0) return rendered.join(" ");
    return null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("#text" in obj && obj["#text"] !== undefined) return richText(obj["#text"]);
    if ("__cdata" in obj && obj["__cdata"] !== undefined) return richText(obj["__cdata"]);

    const attrs = Object.entries(obj).filter(([key]) => key.startsWith("@_"));
    const children = Object.entries(obj).filter(([key]) => !key.startsWith("@_"));

    if (tagName) {
      const attrText = attrs
        .map(([key, val]) => `${key.replace(/^@_/, "")}="${escapeHtmlAttr(String(val ?? ""))}"`)
        .join(" ");
      const childText = children
        .map(([childKey, childVal]) => richText(childVal, childKey))
        .filter(Boolean)
        .join("");

      if (isVoidElement(tagName) && (attrText || !childText)) {
        return `<${tagName}${attrText ? " " + attrText : ""} />`;
      }
      if (attrText || childText) {
        return `<${tagName}${attrText ? " " + attrText : ""}>${childText}</${tagName}>`;
      }
    }

    const flattened = children
      .map(([childKey, childVal]) => richText(childVal, childKey))
      .filter(Boolean)
      .join(" ");
    if (flattened) return flattened;
  }
  return null;
}

function findImageUrl(item: any): string | null {
  const candidates: Array<string | null> = [];

  const enclosures = toArray(item?.enclosure ?? item?.enclosures);
  candidates.push(pickImageFromEnclosures(enclosures));

  const mediaContent = toArray(item?.["media:content"]);
  candidates.push(pickImageFromEnclosures(mediaContent));

  const mediaThumbs = toArray(item?.["media:thumbnail"]);
  candidates.push(pickImageFromEnclosures(mediaThumbs));

  const mediaGroups = toArray(item?.["media:group"]);
  for (const group of mediaGroups) {
    candidates.push(pickImageFromEnclosures(toArray(group?.["media:content"])));
    candidates.push(pickImageFromEnclosures(toArray(group?.["media:thumbnail"])));
  }

  const linkImages = toArray(item?.link);
  for (const link of linkImages) {
    const rel = (link?.["@_rel"] ?? link?.rel ?? "").toLowerCase();
    const type = link?.["@_type"] ?? link?.type ?? "";
    const href = link?.["@_href"] ?? link?.href ?? null;
    if (href && (rel === "enclosure" || looksLikeImage(type, href))) {
      candidates.push(String(href));
    }
  }

  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return null;
}

function pickImageFromEnclosures(enclosures: any[]): string | null {
  for (const enclosure of enclosures) {
    const type = enclosure?.["@_type"] ?? enclosure?.type ?? "";
    const url = enclosure?.["@_url"] ?? enclosure?.url ?? enclosure?.["@_src"] ?? enclosure?.src;
    if (url && looksLikeImage(type, url)) return String(url);
  }
  return null;
}

function looksLikeImage(type: string | undefined, url: string): boolean {
  const lowerType = (type ?? "").toLowerCase();
  if (lowerType.startsWith("image/")) return true;
  const cleanUrl = url.split("?")[0] ?? "";
  return /\.(avif|gif|jpe?g|png|webp|svg)$/i.test(cleanUrl);
}

function isVoidElement(tag: string): boolean {
  return /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i.test(tag);
}

function escapeHtmlAttr(input: string) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
