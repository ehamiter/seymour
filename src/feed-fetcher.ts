import {
  FeedRow,
  feedsForFetching,
  findFeedById,
  recordFetchError,
  recordFetchSuccess,
  touchFeedFetch,
} from "./db";
import { parseFeed } from "./feed-parser";

const DEFAULT_INTERVAL_MS = Number(process.env.FETCH_INTERVAL_MS ?? 5 * 60 * 1000);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 15000);
const USER_AGENT =
  process.env.HTTP_USER_AGENT ??
  "SeymourReader/0.1 (+https://github.com/)"; // Keep it simple and explicit.

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
        if (feed) await fetchAndStore(feed);
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

async function fetchAndStore(feed: FeedRow) {
  const fetchedAt = new Date().toISOString();
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`fetch failed for feed ${feed.url}:`, message);
    recordFetchError(feed.id, message.slice(0, 500));
  }
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
