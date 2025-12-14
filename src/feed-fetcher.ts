import {
  FeedRow,
  feedsForFetching,
  findFeedById,
  recordFetchError,
  recordFetchSuccess,
  touchFeedFetch,
} from "./db";
import { parseFeed } from "./feed-parser";

const DEFAULT_INTERVAL_MS = Number(process.env.FETCH_INTERVAL_MS ?? 30 * 60 * 1000);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 15000);
const USER_AGENT =
  process.env.HTTP_USER_AGENT ??
  "Seymour/0.1 (+https://github.com/you/seymour; respectful fetcher)";
const RETRY_AFTER_FALLBACK_MS = 2 * 60 * 60 * 1000; // Slow down hard on 429s when no hint is provided.
const ERROR_BACKOFF_MS = 60 * 60 * 1000; // Avoid hammering a failing feed.
const NO_VALIDATOR_BACKOFF_MS = 90 * 60 * 1000; // Slow feeds that never send ETag/Last-Modified.

export type FeedFetcher = {
  triggerAll: () => Promise<void>;
  triggerFeed: (feedId: number) => Promise<void>;
  stop: () => void;
};

export function startFeedFetcher(intervalMs = DEFAULT_INTERVAL_MS): FeedFetcher {
  let running = false;
  let pendingAll = false;
  const pendingFeeds = new Set<number>();
  const backoffUntil = new Map<number, number>();

  const getBackoffRemaining = (feedId: number): number => {
    const until = backoffUntil.get(feedId);
    if (!until) return 0;
    const remaining = until - Date.now();
    if (remaining <= 0) {
      backoffUntil.delete(feedId);
      return 0;
    }
    return remaining;
  };

  const setBackoff = (feedId: number, delayMs: number) => {
    const jitter = Math.floor(delayMs * 0.1 * Math.random());
    const until = Date.now() + delayMs + jitter;
    const current = backoffUntil.get(feedId) ?? 0;
    if (until > current) {
      backoffUntil.set(feedId, until);
    }
  };

  const schedule = () => {
    if (running) return;
    running = true;
    processQueue()
      .catch((err) => console.error("fetch loop error", err))
      .finally(() => {
        running = false;
        if (pendingAll || pendingFeeds.size > 0) {
          schedule();
        }
      });
  };

  const processQueue = async () => {
    if (pendingAll) {
      pendingAll = false;
      const feeds = feedsForFetching();
      for (const feed of feeds) {
        if (getBackoffRemaining(feed.id) > 0) continue;
        await fetchAndStore(feed, { setBackoff });
      }
    }

    if (pendingFeeds.size > 0) {
      const ids = Array.from(pendingFeeds);
      pendingFeeds.clear();
      for (const id of ids) {
        const feed = findFeedById(id);
        if (!feed) continue;
        if (getBackoffRemaining(feed.id) > 0) continue;
        await fetchAndStore(feed, { setBackoff });
      }
    }
  };

  const timer = setInterval(() => {
    pendingAll = true;
    schedule();
  }, intervalMs);

  // Kick off immediately.
  pendingAll = true;
  schedule();

  return {
    triggerAll: async () => {
      pendingAll = true;
      schedule();
    },
    triggerFeed: async (feedId: number) => {
      pendingFeeds.add(feedId);
      schedule();
    },
    stop: () => clearInterval(timer),
  };
}

async function fetchAndStore(
  feed: FeedRow,
  options: { setBackoff?: (feedId: number, delayMs: number) => void } = {},
) {
  const fetchedAt = new Date().toISOString();
  const setBackoff = options.setBackoff;
  try {
    const headers: HeadersInit = {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
    };

    if (feed.etag) headers["If-None-Match"] = feed.etag;
    if (feed.last_modified) headers["If-Modified-Since"] = feed.last_modified;

    const res = await fetchWithTimeout(feed.url, { headers, redirect: "follow" }, FETCH_TIMEOUT_MS);

    const etag = res.headers.get("etag");
    const lastModified = res.headers.get("last-modified");

    if (res.status === 429) {
      const retryMs = parseRetryAfter(res.headers.get("retry-after")) ?? RETRY_AFTER_FALLBACK_MS;
      if (setBackoff) setBackoff(feed.id, retryMs);
      const nextAttempt = new Date(Date.now() + retryMs).toISOString();
      recordFetchError(feed.id, `HTTP 429 Too Many Requests; backing off until ${nextAttempt}`);
      return;
    }

    if (res.status === 304) {
      touchFeedFetch(feed.id, { etag: etag ?? feed.etag, lastModified: lastModified ?? feed.last_modified });
      return;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const body = await res.text();
    const parsed = parseFeed(body);
    recordFetchSuccess(feed, parsed, parsed.entries, {
      etag: etag ?? feed.etag,
      lastModified: lastModified ?? feed.last_modified,
      fetchedAt,
    });

    if (!etag && !lastModified && setBackoff) {
      setBackoff(feed.id, NO_VALIDATOR_BACKOFF_MS);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`fetch failed for feed ${feed.url}:`, message);
    const note = setBackoff
      ? `${message.slice(0, 400)}; backing off for ${Math.round(ERROR_BACKOFF_MS / 60000)}m`
      : message.slice(0, 500);
    recordFetchError(feed.id, note);
    if (setBackoff) setBackoff(feed.id, ERROR_BACKOFF_MS);
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10) * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return null;
  const delta = dateMs - Date.now();
  return delta > 0 ? delta : null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeout: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
