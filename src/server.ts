import {
  ensureFeed,
  listFeeds,
  listUnreadEntries,
  markAboveAsRead,
  markEntryRead,
  deleteFeed,
  updateFeed,
  findFeedById,
  findFeedByUrl,
} from "./db";
import { startFeedFetcher } from "./feed-fetcher";
import { renderHome } from "./html";
import { parseOpmlFeeds } from "./opml";

const PORT = Number(process.env.PORT ?? 3000);
const PAGE_SIZE = Number(process.env.PAGE_SIZE ?? 50);
const PASSWORD = process.env.APP_PASSWORD ?? null;

const fetcher = startFeedFetcher();

const server = Bun.serve({
  port: PORT,
  fetch: route,
});

console.log(`Seymour running on http://localhost:${server.port}`);

async function route(req: Request) {
  if (PASSWORD) {
    const auth = checkAuth(req, PASSWORD);
    if (auth) return auth;
  }

  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/") {
    return renderHomePage(url);
  }

  if (req.method === "POST" && url.pathname === "/feeds") {
    return handleAddFeed(req);
  }

  if (req.method === "POST" && url.pathname === "/refresh") {
    fetcher.triggerAll();
    return redirect("/");
  }

  const updateMatch = url.pathname.match(/^\/feeds\/(\d+)\/update$/);
  if (req.method === "POST" && updateMatch) {
    const id = Number(updateMatch[1]);
    return handleUpdateFeed(req, id);
  }

  const deleteMatch = url.pathname.match(/^\/feeds\/(\d+)\/delete$/);
  if (req.method === "POST" && deleteMatch) {
    const id = Number(deleteMatch[1]);
    deleteFeed(id);
    return redirect("/?flash=" + encodeURIComponent("Subscription removed"));
  }

  const readMatch = url.pathname.match(/^\/entries\/(\d+)\/read$/);
  if (req.method === "POST" && readMatch) {
    const id = Number(readMatch[1]);
    markEntryRead(id);
    return respondAfterAction(req);
  }

  if (req.method === "POST" && url.pathname === "/entries/mark-above") {
    const form = await req.formData();
    const pivot = Number(form.get("pivot"));
    if (Number.isFinite(pivot)) {
      markAboveAsRead(pivot);
    }
    return respondAfterAction(req);
  }

  return new Response("Not found", { status: 404 });
}

async function handleAddFeed(req: Request) {
  const form = await req.formData();
  const opmlFile = form.get("opml");
  const rawUrl = form.get("url");

  if (opmlFile instanceof File && opmlFile.size > 0) {
    try {
      const text = await opmlFile.text();
      const feeds = parseOpmlFeeds(text);
      if (feeds.length === 0) {
        return redirect("/?flash=" + encodeURIComponent("No feeds found in OPML"));
      }

      let created = 0;
      for (const feed of feeds) {
        const exists = findFeedByUrl(feed.url);
        const row = ensureFeed(feed.url);
        if (!exists) created += 1;
        fetcher.triggerFeed(row.id);
      }

      return redirect(
        "/?flash=" +
          encodeURIComponent(
            `Imported ${feeds.length} feed${feeds.length === 1 ? "" : "s"} (${created} new)`,
          ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import OPML";
      return redirect("/?flash=" + encodeURIComponent(message));
    }
  }

  if (!rawUrl) return redirect("/?flash=" + encodeURIComponent("Feed URL required"));

  const url = String(rawUrl).trim();
  if (!url) return redirect("/?flash=" + encodeURIComponent("Feed URL required"));

  const feed = ensureFeed(url);
  fetcher.triggerFeed(feed.id);

  return redirect("/?flash=" + encodeURIComponent("Feed saved"));
}

async function handleUpdateFeed(req: Request, feedId: number) {
  const feed = findFeedById(feedId);
  if (!feed) return new Response("Not found", { status: 404 });

  const form = await req.formData();
  const title = form.get("title");
  const url = form.get("url");
  if (!url || !String(url).trim()) {
    return redirect("/?flash=" + encodeURIComponent("URL is required"));
  }

  try {
    updateFeed(feedId, { title: title ? String(title).trim() : null, url: String(url).trim() });
    return redirect("/?flash=" + encodeURIComponent("Feed updated"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return redirect("/?flash=" + encodeURIComponent(message));
  }
}

function renderHomePage(url: URL) {
  const feedParam = url.searchParams.get("feed");
  const selectedFeedId = feedParam ? Number(feedParam) : undefined;
  const entries = listUnreadEntries(PAGE_SIZE, undefined, Number.isFinite(selectedFeedId) ? selectedFeedId : undefined);
  const feeds = listFeeds();
  const flash = url.searchParams.get("flash");
  const html = renderHome({ entries, feeds, flash, selectedFeedId: Number.isFinite(selectedFeedId) ? selectedFeedId! : undefined });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function respondAfterAction(req: Request) {
  const wantsJson = (req.headers.get("accept") ?? "").includes("application/json");
  if (wantsJson) return new Response(null, { status: 204 });
  return redirect(req.headers.get("referer") ?? "/");
}

function redirect(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path },
  });
}

function checkAuth(req: Request, password: string): Response | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Basic ")) {
    return new Response("Auth required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Seymour"' },
    });
  }

  const encoded = header.split(" ")[1] ?? "";
  let decoded = "";
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return new Response("Invalid auth", { status: 400 });
  }

  const supplied = decoded.split(":")[1] ?? "";
  if (supplied !== password) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}
