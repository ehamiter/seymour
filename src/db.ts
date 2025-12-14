import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";

export type FeedRow = {
  id: number;
  url: string;
  title: string | null;
  site_url: string | null;
  etag: string | null;
  last_modified: string | null;
  last_fetched_at: string | null;
  fetch_error: string | null;
  created_at: string;
  raw: unknown;
};

export type EntryRow = {
  id: number;
  feed_id: number;
  guid: string;
  url: string | null;
  title: string | null;
  author: string | null;
  summary: string | null;
  published_at: string | null;
  fetched_at: string;
  read_at: string | null;
  sort_key: number;
  unread: number;
  raw: unknown;
};

export type ParsedEntry = {
  guid: string;
  url: string | null;
  title: string | null;
  author?: string | null;
  summary?: string | null;
  published_at: string | null;
  raw: unknown;
};

export type ParsedFeed = {
  title: string | null;
  site_url: string | null;
  raw: unknown;
  entries: ParsedEntry[];
};

const dataDir = join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const DB_PATH = process.env.DB_PATH ?? join(dataDir, "reader.sqlite");
export const db = new Database(DB_PATH, { create: true });

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 3000;
`);

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT,
      site_url TEXT,
      etag TEXT,
      last_modified TEXT,
      last_fetched_at TEXT,
      fetch_error TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      raw JSON
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      guid TEXT NOT NULL,
      url TEXT,
      title TEXT,
      author TEXT,
      summary TEXT,
      published_at TEXT,
      fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      read_at TEXT,
      raw JSON NOT NULL,
      sort_key REAL GENERATED ALWAYS AS (
        julianday(COALESCE(published_at, fetched_at))
      ) STORED,
      unread INTEGER GENERATED ALWAYS AS (
        CASE WHEN read_at IS NULL THEN 1 ELSE 0 END
      ) STORED,
      UNIQUE(feed_id, guid)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_feed_sort ON entries(feed_id, sort_key DESC);
    CREATE INDEX IF NOT EXISTS idx_entries_unread_sort ON entries(unread, sort_key DESC);
    CREATE INDEX IF NOT EXISTS idx_entries_feed_unread ON entries(feed_id, unread) WHERE unread = 1;

    CREATE VIEW IF NOT EXISTS feed_unread_counts AS
      SELECT feed_id, COUNT(*) AS unread_count
      FROM entries
      WHERE unread = 1
      GROUP BY feed_id;
  `);
}

initSchema();

export function ensureFeed(url: string): FeedRow {
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO feeds (url, created_at)
    VALUES (?, ?)
    ON CONFLICT(url) DO UPDATE SET url = excluded.url
    RETURNING *
  `);
  return insert.get(url, now) as FeedRow;
}

export function findFeedById(id: number): FeedRow | null {
  return db.prepare(`SELECT * FROM feeds WHERE id = ?`).get(id) as FeedRow | null;
}

export function findFeedByUrl(url: string): FeedRow | null {
  return db.prepare(`SELECT * FROM feeds WHERE url = ?`).get(url) as FeedRow | null;
}

export function deleteFeed(id: number): number {
  const res = db.prepare(`DELETE FROM feeds WHERE id = ?`).run(id);
  return res.changes;
}

export function updateFeed(id: number, data: { title?: string | null; url?: string }) {
  const title = data.title ?? null;
  const url = data.url;
  if (!url) throw new Error("URL required");
  const res = db
    .prepare(
      `
      UPDATE feeds
      SET title = ?, url = ?
      WHERE id = ?
      RETURNING *
    `,
    )
    .get(title, url, id);
  return res as FeedRow | undefined;
}

export function listFeeds(): Array<FeedRow & { unread_count: number }> {
  return db
    .prepare(
      `
      SELECT f.*, COALESCE(c.unread_count, 0) AS unread_count
      FROM feeds f
      LEFT JOIN feed_unread_counts c ON c.feed_id = f.id
      ORDER BY f.title IS NULL, LOWER(f.title), f.url
    `,
    )
    .all() as Array<FeedRow & { unread_count: number }>;
}

export function feedsForFetching(): FeedRow[] {
  return db
    .prepare(
      `
      SELECT *
      FROM feeds
      ORDER BY last_fetched_at IS NULL DESC, last_fetched_at ASC
    `,
    )
    .all() as FeedRow[];
}

export function markEntryRead(id: number): number {
  const res = db
    .prepare(
      `
      UPDATE entries
      SET read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      WHERE id = ?
    `,
    )
    .run(id);
  return res.changes;
}

export function markAboveAsRead(pivotSortKey: number): number {
  const res = db
    .prepare(
      `
      UPDATE entries
      SET read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      WHERE unread = 1 AND sort_key >= ?
    `,
    )
    .run(pivotSortKey);
  return res.changes;
}

export function listUnreadEntries(limit = 50, beforeSortKey?: number, feedId?: number) {
  const params: unknown[] = [];
  let sql = `
    SELECT e.*, f.title AS feed_title, f.url AS feed_url
    FROM entries e
    JOIN feeds f ON f.id = e.feed_id
    WHERE e.unread = 1
  `;
  if (typeof beforeSortKey === "number") {
    sql += " AND e.sort_key < ?";
    params.push(beforeSortKey);
  }
  if (typeof feedId === "number") {
    sql += " AND e.feed_id = ?";
    params.push(feedId);
  }
  sql += " ORDER BY e.sort_key DESC LIMIT ?";
  params.push(limit);

  return db.prepare(sql).all(...params) as Array<
    EntryRow & { feed_title: string | null; feed_url: string }
  >;
}

export function recordFetchSuccess(
  feed: FeedRow,
  parsed: ParsedFeed,
  entries: ParsedEntry[],
  meta: { etag: string | null; lastModified: string | null; fetchedAt: string },
) {
  const updateFeed = db.prepare(`
    UPDATE feeds
    SET
      title = ?,
      site_url = ?,
      etag = ?,
      last_modified = ?,
      last_fetched_at = ?,
      fetch_error = NULL,
      raw = ?
    WHERE id = ?
  `);

  const upsertEntry = db.prepare(`
    INSERT INTO entries (feed_id, guid, url, title, author, summary, published_at, fetched_at, raw)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(feed_id, guid) DO UPDATE SET
      url = COALESCE(excluded.url, entries.url),
      title = COALESCE(excluded.title, entries.title),
      author = COALESCE(excluded.author, entries.author),
      summary = COALESCE(excluded.summary, entries.summary),
      published_at = COALESCE(excluded.published_at, entries.published_at),
      fetched_at = excluded.fetched_at,
      raw = excluded.raw
  `);

  const tx = db.transaction(() => {
    updateFeed.run(
      parsed.title,
      parsed.site_url,
      meta.etag,
      meta.lastModified,
      meta.fetchedAt,
      JSON.stringify(parsed.raw ?? null),
      feed.id,
    );

    for (const entry of entries) {
      upsertEntry.run(
        feed.id,
        entry.guid,
        entry.url,
        entry.title,
        entry.author ?? null,
        entry.summary ?? null,
        entry.published_at,
        meta.fetchedAt,
        JSON.stringify(entry.raw ?? null),
      );
    }
  });

  tx();
}

export function recordFetchError(feedId: number, message: string) {
  db.prepare(
    `
    UPDATE feeds
    SET fetch_error = ?, last_fetched_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `,
  ).run(message, feedId);
}

export function recentEntries(limit = 100) {
  return db
    .prepare(
      `
      SELECT e.*, f.title AS feed_title, f.url AS feed_url
      FROM entries e
      JOIN feeds f ON f.id = e.feed_id
      ORDER BY e.sort_key DESC
      LIMIT ?
    `,
    )
    .all(limit) as Array<EntryRow & { feed_title: string | null; feed_url: string }>;
}

export function touchFeedFetch(
  feedId: number,
  meta: { etag: string | null; lastModified: string | null },
) {
  db.prepare(
    `
    UPDATE feeds
    SET
      etag = ?,
      last_modified = ?,
      last_fetched_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      fetch_error = NULL
    WHERE id = ?
  `,
  ).run(meta.etag, meta.lastModified, feedId);
}
