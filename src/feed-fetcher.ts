import {
  FeedRow,
  feedsForFetching,
  findFeedById,
  recordFetchError,
  recordFetchSuccess,
  setFeedBackoff,
  touchFeedFetch,
} from "./db";
import { parseFeed } from "./feed-parser";

const DEFAULT_INTERVAL_MS = Number(process.env.FETCH_INTERVAL_MS ?? 30 * 60 * 1000);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 90000);
const MAX_RETRIES = 2;
const USER_AGENT =
  process.env.HTTP_USER_AGENT ??
  "Seymour/0.1 (+https://github.com/ehamiter/seymour; respectful rss feed fetcher)";
const RETRY_AFTER_FALLBACK_MS = 2 * 60 * 60 * 1000; // Slow down hard on 429s when no hint is provided.
const REMOTE_ERROR_BACKOFF_MS = 60 * 60 * 1000; // Remote HTTP errors (4xx/5xx) - avoid hammering a broken feed.
const LOCAL_ERROR_BACKOFF_MS = 5 * 60 * 1000; // Local/network/timeout errors - retry sooner.
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
        await fetchAndStore(feed);
      }
    }

    if (pendingFeeds.size > 0) {
      const ids = Array.from(pendingFeeds);
      pendingFeeds.clear();
      for (const id of ids) {
        const feed = findFeedById(id);
        if (!feed) continue;
        if (isBackedOff(feed)) continue;
        await fetchAndStore(feed);
      }
    }
  };

  const timer = setInterval(() => {
    pendingAll = true;
    schedule();
  }, intervalMs);

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

function isBackedOff(feed: FeedRow): boolean {
  if (!feed.backoff_until) return false;
  return new Date(feed.backoff_until) > new Date();
}

function persistBackoff(feedId: number, delayMs: number) {
  const jitter = Math.floor(delayMs * 0.1 * Math.random());
  const until = new Date(Date.now() + delayMs + jitter).toISOString();
  setFeedBackoff(feedId, until);
}

function isLocalOrTimeoutError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  const name = err.name.toLowerCase();
  return (
    name === "aborterror" ||
    msg.includes("aborted") ||
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("enetunreach") ||
    msg.includes("unable to connect") ||
    msg.includes("fetch failed")
  );
}

async function fetchAndStore(feed: FeedRow) {
  const fetchedAt = new Date().toISOString();

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
        persistBackoff(feed.id, retryMs);
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

      if (!etag && !lastModified) {
        persistBackoff(feed.id, NO_VALIDATOR_BACKOFF_MS);
      }
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  if (lastError) {
    const message = lastError.message;
    const isLocal = isLocalOrTimeoutError(lastError);
    const backoffMs = isLocal ? LOCAL_ERROR_BACKOFF_MS : REMOTE_ERROR_BACKOFF_MS;
    const backoffMins = Math.round(backoffMs / 60000);

    console.error(`fetch failed for feed ${feed.url} after ${MAX_RETRIES + 1} attempts:`, message);

    const note = isLocal
      ? `Network/timeout error; will retry in ${backoffMins}m`
      : `${message.slice(0, 400)}; backing off for ${backoffMins}m`;

    recordFetchError(feed.id, note);
    persistBackoff(feed.id, backoffMs);
  }
}

export function parseRetryAfter(value: string | null): number | null {
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

export async function fetchWithTimeout(url: string, init: RequestInit, timeout: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const __test__ = {
  fetchAndStore,
};
