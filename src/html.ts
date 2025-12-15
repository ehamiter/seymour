import type { EntryRow, FeedRow } from "./db";

type FeedWithCounts = FeedRow & { unread_count: number };
type EntryView = EntryRow & { feed_title: string | null; feed_url: string };

export function renderHome(params: {
  entries: EntryView[];
  feeds: FeedWithCounts[];
  flash?: string | null;
  selectedFeedId?: number;
}) {
  const { entries, feeds, flash, selectedFeedId } = params;
  const body = renderEntries(entries);
  const feedList = renderFeedList(feeds, selectedFeedId);
  const flashBox = flash ? `<div class="flash">${escapeHtml(flash)}</div>` : "";
  const selectedFeed =
    typeof selectedFeedId === "number" ? feeds.find((f) => f.id === selectedFeedId) ?? null : null;
  const heading =
    selectedFeed && selectedFeedId
      ? `Unread — ${formatText(selectedFeed.title ?? selectedFeed.url)}`
      : "Unread";

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/favicon.ico" />
    <title>Seymour Reader</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f7fb;
        --panel: #ffffff;
        --ink: #0f172a;
        --muted: #5f6b7a;
        --accent: #234f9e;
        --accent-strong: #113a7c;
        --border: #d9dfea;
        --shadow: 0 10px 40px rgba(15, 23, 42, 0.08);
        font-family: "Atkinson Hyperlegible", "IBM Plex Sans", "Segoe UI", sans-serif;
        background-color: var(--bg);
        color: var(--ink);
      }

      * { box-sizing: border-box; }
      html {
        height: 100%;
      }

      body {
        margin: 0;
        min-height: 100vh;
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: radial-gradient(240px at 20% 10%, rgba(35, 79, 158, 0.06), transparent),
                    radial-gradient(200px at 85% 20%, rgba(17, 58, 124, 0.05), transparent),
                    var(--bg);
        color: var(--ink);
      }

      header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.55rem 1.5rem;
        position: sticky;
        top: 0;
        background: rgba(247, 247, 251, 0.98);
        backdrop-filter: blur(6px);
        border-bottom: 1px solid var(--border);
        z-index: 20;
      }

      .brand {
        display: inline-flex;
        gap: 0.75rem;
        align-items: flex-start;
      }

      .brand img {
        width: 56px;
        height: 56px;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: none;
        background: transparent;
        margin-top: -2px;
      }

      .brand-copy {
        display: grid;
        gap: 0.1rem;
        margin-top: 3px;
      }

      h1 {
        margin: 0;
        font-size: 1.2rem;
        letter-spacing: 0.01em;
      }

      .brand p {
        margin: 0.1rem 0 0;
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(260px, 320px) 1fr;
        gap: 1rem;
        padding: 1rem 1.5rem 2rem;
        align-items: stretch;
        flex: 1;
        overflow: hidden;
        min-height: 0;
      }

      section.feeds,
      section.entries {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow);
        height: 100%;
        overflow: auto;
        align-content: start;
        min-height: 0;
      }

      section.feeds {
        padding: 0.75rem;
        display: grid;
        gap: 0.5rem;
      }

      .feed-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.25rem 0.5rem;
        align-items: center;
        padding: 0.2rem 0.25rem;
        border-radius: 10px;
        min-width: 0;
        border: 1px solid transparent;
      }

      .feed-row strong {
        font-weight: 600;
      }

      .feed-row small {
        color: var(--muted);
        display: block;
      }

      .unread-pill {
        background: var(--accent);
        color: #fff;
        padding: 0.05rem 0.5rem;
        border-radius: 999px;
        font-size: 0.85rem;
        min-width: 2.5rem;
        text-align: center;
      }

      .feed-error {
        color: #b42318;
        font-size: 0.85rem;
      }

      .feed-actions {
        display: inline-flex;
        gap: 0.35rem;
        align-items: center;
        justify-self: end;
      }

      .feed-row .stack {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .feed-main {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 0.35rem;
        text-decoration: none;
        color: inherit;
        padding: 0.35rem 0.4rem;
        border-radius: 8px;
        border: 1px solid transparent;
      }

      .feed-row:hover .feed-main {
        background: #f6f8fd;
      }

      .feed-row.active .feed-main {
        background: #eef3ff;
        border-color: var(--accent);
      }

      .feed-menu {
        position: relative;
      }

      .feed-menu summary {
        list-style: none;
        cursor: pointer;
        font-size: 1.2rem;
        line-height: 1;
        padding: 0.15rem 0.5rem;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: #fff;
      }

      .feed-menu summary::-webkit-details-marker {
        display: none;
      }

      .feed-menu[open] summary {
        background: var(--panel);
        box-shadow: var(--shadow);
      }

      .feed-menu .menu-panel {
        position: absolute;
        right: 0;
        top: 120%;
        width: min(280px, 80vw);
        background: #fff;
        border: 1px solid var(--border);
        border-radius: 10px;
        box-shadow: var(--shadow);
        padding: 0.6rem;
        display: grid;
        gap: 0.4rem;
        z-index: 5;
      }

      .feed-menu label {
        display: grid;
        gap: 0.2rem;
        font-size: 0.85rem;
      }

      .feed-menu input[type="text"],
      .feed-menu input[type="url"] {
        padding: 0.35rem 0.5rem;
        border-radius: 6px;
        border: 1px solid var(--border);
      }

      .feed-menu .menu-actions {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        align-items: center;
      }

      .file-button {
        position: relative;
        overflow: hidden;
        border: 1px solid var(--border);
        padding: 0.4rem 0.75rem;
        border-radius: 8px;
        cursor: pointer;
        background: #fff;
        font-weight: 600;
        color: var(--ink);
      }

      .file-button input[type="file"] {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }

      section.entries {
        padding: 0.5rem 0.5rem 1rem;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 0.75rem;
        scroll-padding-top: 0;
      }

      .entries > h2 {
        grid-column: 1 / -1;
        margin: 0.25rem 0 0;
        font-size: 0.95rem;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .entry {
        display: grid;
        grid-template-columns: subgrid;
        align-content: start;
        background: linear-gradient(145deg, #ffffff 60%, rgba(35, 79, 158, 0.04));
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 0.85rem 1rem;
        gap: 0.35rem;
        outline: 0;
        position: relative;
        scroll-margin-top: 0;
        min-width: 0;
      }

      .entry:focus-visible {
        box-shadow: 0 0 0 2px var(--accent);
      }

      .entry header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.75rem;
        padding: 0.25rem 0;
        position: static;
        background: transparent;
        backdrop-filter: none;
        border-bottom: none;
        z-index: auto;
      }

      .entry .feed {
        color: var(--muted);
        font-size: 0.95rem;
      }

      .entry time {
        color: var(--muted);
        font-size: 0.85rem;
        text-align: right;
        white-space: nowrap;
      }

      .entry h3 {
        margin: 0;
        font-size: 1.05rem;
        letter-spacing: 0.01em;
      }

      .entry h3 a {
        color: var(--ink);
        text-decoration: none;
      }

      .entry h3 a:hover {
        text-decoration: underline;
      }

      .entry p {
        margin: 0;
        color: var(--muted);
        line-height: 1.4;
      }

      .summary {
        display: grid;
        gap: 0.35rem;
        color: var(--muted);
        line-height: 1.5;
        overflow-wrap: anywhere;
        word-break: break-word;
        min-width: 0;
      }

      .summary p {
        margin: 0;
      }

      .summary a {
        color: var(--accent-strong);
      }

      .summary ul,
      .summary ol {
        margin: 0.25rem 0 0.25rem 1.2rem;
        padding-left: 1rem;
        display: grid;
        gap: 0.2rem;
      }

      .summary li {
        margin: 0;
      }

      .summary blockquote {
        border-left: 3px solid var(--border);
        margin: 0;
        padding-left: 0.75rem;
        color: var(--ink);
      }

      .summary pre {
        background: #f4f6fb;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.6rem;
        overflow-x: auto;
      }

      .summary code {
        background: #f4f6fb;
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 0.15rem 0.35rem;
      }

      .summary img {
        max-width: 100%;
        height: auto;
        display: block;
        border-radius: 8px;
        border: 1px solid var(--border);
      }

      .entry .actions {
        display: inline-flex;
        gap: 0.5rem;
        align-items: center;
      }

      button {
        border: 1px solid var(--border);
        background: #fff;
        color: var(--ink);
        border-radius: 8px;
        padding: 0.4rem 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
      }

      button.primary {
        background: var(--accent);
        color: #fff;
        border-color: var(--accent-strong);
        box-shadow: 0 10px 30px rgba(35, 79, 158, 0.25);
      }

      button.danger {
        background: #fee9e7;
        color: #a01b14;
        border-color: #f4c7c2;
      }

      button:hover {
        transform: translateY(-1px);
      }

      form.inline {
        display: inline;
        margin: 0;
      }

      .flash {
        background: #fffbe6;
        color: #8a6d1f;
        padding: 0.6rem 0.8rem;
        border-radius: 8px;
        border: 1px solid #f1e5b9;
      }

      .stack {
        display: grid;
        gap: 0.35rem;
      }

      .text-input {
        min-width: 18rem;
        padding: 0.4rem 0.6rem;
        border-radius: 8px;
        border: 1px solid var(--border);
      }

      .settings-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.38);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        z-index: 200;
      }

      .settings-overlay[hidden] {
        display: none;
      }

      .settings-panel {
        width: min(640px, 92vw);
        background: #fff;
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow);
        padding: 1rem 1.25rem;
        display: grid;
        gap: 0.9rem;
      }

      .settings-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .settings-body {
        display: grid;
        gap: 0.75rem;
      }

      .settings-input-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
        align-items: center;
      }

      .settings-footer {
        display: flex;
        justify-content: flex-end;
      }

      .muted {
        color: var(--muted);
      }

      kbd {
        background: #f1f4fb;
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 0.15rem 0.45rem;
        font-family: "SFMono-Regular", "Menlo", "Consolas", monospace;
        font-size: 0.95rem;
        box-shadow: inset 0 -1px 0 rgba(15, 23, 42, 0.08);
      }

      .shortcut-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.38);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        z-index: 200;
      }

      .shortcut-overlay[hidden] {
        display: none;
      }

      .shortcut-panel {
        width: min(520px, 90vw);
        background: #fff;
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: var(--shadow);
        padding: 1rem 1.25rem;
        display: grid;
        gap: 0.8rem;
      }

      .shortcut-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .shortcut-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.45rem;
      }

      .shortcut-row {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.65rem;
        align-items: center;
      }

      .shortcut-keys {
        display: inline-flex;
        gap: 0.35rem;
        flex-wrap: wrap;
      }

      .shortcut-hint {
        margin: 0;
        color: var(--muted);
      }

      @media (max-width: 980px) {
        body {
          height: auto;
          overflow: auto;
        }
        header {
          align-items: flex-start;
          flex-direction: column;
          position: static;
        }
        .brand {
          width: 100%;
        }
        .settings-input-row {
          grid-template-columns: 1fr;
        }
        .layout {
          grid-template-columns: 1fr;
          padding: 1rem;
          height: auto;
          overflow: visible;
        }
        section.entries {
          grid-template-columns: 1fr;
          height: auto;
          overflow: visible;
        }
        section.feeds {
          height: auto;
          overflow: visible;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">
        <img src="/seymour.png" alt="Seymour logo" loading="lazy" />
        <div class="brand-copy">
          <h1><a href="/" style="color: inherit; text-decoration: none;">Seymour Reader</a></h1>
          <p class="muted">Press <kbd>?</kbd> to see keyboard shortcuts.</p>
        </div>
      </div>
      <button type="button" data-open-settings aria-label="Open settings">Settings</button>
    </header>
    <div class="settings-overlay" data-settings-overlay hidden>
      <div class="settings-panel" role="dialog" aria-modal="true" aria-label="Settings" tabindex="-1">
        <div class="settings-header">
          <div>
            <strong>Settings</strong>
            <p class="muted" style="margin: 0.15rem 0 0;">Manage feeds, imports, and refreshes.</p>
          </div>
          <button type="button" data-close-settings aria-label="Close settings">Close</button>
        </div>
        <div class="settings-body">
          <form class="stack" method="post" action="/feeds" enctype="multipart/form-data">
            <div class="stack">
              <label class="stack">
                <span>Subscribe to a feed</span>
                <div class="settings-input-row">
                  <input type="url" name="url" class="text-input" placeholder="Add feed URL" aria-label="Feed URL" />
                  <button type="submit" class="primary">Subscribe</button>
                </div>
              </label>
              <div class="stack">
                <span>Import OPML</span>
                <label class="file-button">
                  Choose file
                  <input type="file" name="opml" accept=".opml,text/xml,application/xml" />
                </label>
                <p class="muted" style="margin: 0;">We will add any new feeds we find.</p>
              </div>
            </div>
          </form>
          <form class="settings-footer" method="post" action="/refresh">
            <button type="submit" title="Fetch all feeds">Refresh all</button>
          </form>
        </div>
      </div>
    </div>
    <div class="shortcut-overlay" data-shortcut-overlay hidden>
      <div class="shortcut-panel" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" tabindex="-1">
        <div class="shortcut-header">
          <strong>Keyboard shortcuts</strong>
          <button type="button" data-close-shortcuts aria-label="Close keyboard shortcuts">Close</button>
        </div>
        <p class="muted" style="margin: 0;">Quick commands to stay in flow.</p>
        <ul class="shortcut-list">
          <li class="shortcut-row">
            <span class="shortcut-keys"><kbd>j</kbd></span>
            <span>Next item</span>
          </li>
          <li class="shortcut-row">
            <span class="shortcut-keys"><kbd>k</kbd></span>
            <span>Previous item</span>
          </li>
          <li class="shortcut-row">
            <span class="shortcut-keys"><kbd>m</kbd></span>
            <span>Mark current read</span>
          </li>
          <li class="shortcut-row">
            <span class="shortcut-keys"><kbd>shift</kbd><kbd>m</kbd></span>
            <span>Mark current and above read</span>
          </li>
          <li class="shortcut-row">
            <span class="shortcut-keys"><kbd>v</kbd></span>
            <span>Open current link in a new tab</span>
          </li>
          <li class="shortcut-row">
            <span class="shortcut-keys"><kbd>r</kbd></span>
            <span>Refresh all feeds</span>
          </li>
          <li class="shortcut-row">
            <span class="shortcut-keys"><kbd>a</kbd></span>
            <span>Focus "Add feed URL"</span>
          </li>
          <li class="shortcut-row">
            <span class="shortcut-keys"><kbd>?</kbd></span>
            <span>Toggle this shortcuts guide</span>
          </li>
        </ul>
        <p class="shortcut-hint">Press <kbd>Esc</kbd> or <kbd>?</kbd> to close.</p>
      </div>
    </div>
    <div class="layout">
      <section class="feeds" aria-label="Feeds">
        <div class="stack">
          <div class="feed-row ${!selectedFeedId ? "active" : ""}">
            <a class="feed-main" href="/">
              <div class="stack">
                <strong>All feeds</strong>
              </div>
              <span class="unread-pill">${totalUnread(feeds)}</span>
            </a>
          </div>
          ${feedList}
        </div>
        ${flashBox}
      </section>
      <section class="entries" aria-label="Unread entries">
        <h2>${heading}</h2>
        ${entries.length === 0 ? `<p class="muted" style="grid-column:1 / -1; padding:0.5rem 0 1rem;">Inbox zero. Enjoy the silence.</p>` : ""}
        ${body}
      </section>
    </div>
    <script>
      (() => {
        const entries = Array.from(document.querySelectorAll('[data-entry-id]'));
        const entriesContainer = document.querySelector("section.entries");
        let pointer = 0;

        const decodeHtmlEntities = (input) => {
          const named = {
            amp: "&",
            lt: "<",
            gt: ">",
            quot: '"',
            apos: "'",
            nbsp: " ",
          };
          return String(input || "").replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, ent) => {
            if (ent[0] === "#") {
              const isHex = ent[1]?.toLowerCase() === "x";
              const num = parseInt(ent.slice(isHex ? 2 : 1), isHex ? 16 : 10);
              if (!Number.isNaN(num)) {
                return String.fromCodePoint(num);
              }
              return _;
            }
            const lower = ent.toLowerCase();
            return named[lower] ?? _;
          });
        };

        const settingsOverlay = document.querySelector("[data-settings-overlay]");
        const settingsPanel =
          settingsOverlay instanceof HTMLElement ? settingsOverlay.querySelector(".settings-panel") : null;
        const openSettingsButton = document.querySelector("[data-open-settings]");
        const closeSettingsButton =
          settingsOverlay instanceof HTMLElement ? settingsOverlay.querySelector("[data-close-settings]") : null;
        const feedUrlInput =
          settingsOverlay instanceof HTMLElement ? settingsOverlay.querySelector('input[name="url"]') : null;

        const shortcutsOverlay = document.querySelector("[data-shortcut-overlay]");
        const shortcutsPanel = shortcutsOverlay instanceof HTMLElement ? shortcutsOverlay.querySelector(".shortcut-panel") : null;
        const closeShortcutsButton =
          shortcutsOverlay instanceof HTMLElement ? shortcutsOverlay.querySelector("[data-close-shortcuts]") : null;

        const settingsVisible = () =>
          settingsOverlay instanceof HTMLElement && !settingsOverlay.hasAttribute("hidden");

        const shortcutsVisible = () =>
          shortcutsOverlay instanceof HTMLElement && !shortcutsOverlay.hasAttribute("hidden");

        const openSettings = () => {
          if (!(settingsOverlay instanceof HTMLElement)) return;
          settingsOverlay.removeAttribute("hidden");
          if (settingsPanel instanceof HTMLElement) settingsPanel.focus({ preventScroll: true });
          if (feedUrlInput instanceof HTMLElement) feedUrlInput.focus({ preventScroll: true });
        };

        const openShortcuts = () => {
          if (!(shortcutsOverlay instanceof HTMLElement)) return;
          shortcutsOverlay.removeAttribute("hidden");
          if (shortcutsPanel instanceof HTMLElement) shortcutsPanel.focus({ preventScroll: true });
        };

        const closeSettings = () => {
          if (!(settingsOverlay instanceof HTMLElement)) return;
          settingsOverlay.setAttribute("hidden", "true");
        };

        const closeShortcuts = () => {
          if (!(shortcutsOverlay instanceof HTMLElement)) return;
          shortcutsOverlay.setAttribute("hidden", "true");
        };

        const toggleShortcuts = () => {
          if (shortcutsVisible()) {
            closeShortcuts();
          } else {
            openShortcuts();
          }
        };

        if (closeShortcutsButton instanceof HTMLElement) {
          closeShortcutsButton.addEventListener("click", () => closeShortcuts());
        }

        if (openSettingsButton instanceof HTMLElement) {
          openSettingsButton.addEventListener("click", () => openSettings());
        }

        if (closeSettingsButton instanceof HTMLElement) {
          closeSettingsButton.addEventListener("click", () => closeSettings());
        }

        if (settingsOverlay instanceof HTMLElement) {
          settingsOverlay.addEventListener("click", (event) => {
            if (event.target === settingsOverlay) {
              closeSettings();
            }
          });
        }

        if (shortcutsOverlay instanceof HTMLElement) {
          shortcutsOverlay.addEventListener("click", (event) => {
            if (event.target === shortcutsOverlay) {
              closeShortcuts();
            }
          });
        }

        const opmlInput = document.querySelector('input[name="opml"]');
        if (opmlInput instanceof HTMLInputElement) {
          opmlInput.addEventListener("change", () => {
            if (opmlInput.files && opmlInput.files.length > 0) {
              if (opmlInput.form) opmlInput.form.submit();
            }
          });
        }

        const focusEntry = (idx) => {
          const target = entries[idx];
          if (!target) return;
          pointer = idx;
          target.focus({ preventScroll: true });
          if (entriesContainer instanceof HTMLElement) {
            const rect = target.getBoundingClientRect();
            const containerRect = entriesContainer.getBoundingClientRect();
            const offset = rect.top - containerRect.top - 8;
            entriesContainer.scrollBy({ top: offset, behavior: "smooth" });
          } else {
            target.scrollIntoView({ block: "start", behavior: "smooth" });
          }
        };

        const markRead = (entry, silent) => {
          if (!entry || entry.dataset.read === "1") return;
          entry.dataset.read = "1";
          const id = entry.dataset.entryId;
          fetch(\`/entries/\${id}/read\`, {
            method: "POST",
            headers: { "Accept": "application/json" },
            keepalive: true,
          }).catch(() => {
            if (!silent) entry.dataset.read = "0";
          });
        };

        const markAbove = (entry) => {
          if (!entry) return;
          const pivot = entry.dataset.sortKey;
          fetch("/entries/mark-above", {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
            body: "pivot=" + encodeURIComponent(pivot),
            keepalive: true,
          }).then(() => {
            entries.forEach((el) => {
              if (Number(el.dataset.sortKey) >= Number(pivot)) {
                el.dataset.read = "1";
              }
            });
          }).catch(() => {});
        };

        const io = new IntersectionObserver((items) => {
          items.forEach((entry) => {
            const el = entry.target;
            if (entry.isIntersecting) return;
            const rect = el.getBoundingClientRect();
            if (rect.top < 0) {
              markRead(el, true);
            }
          });
        }, { threshold: 0, rootMargin: "-15% 0px -55% 0px" });

        entries.forEach((el) => io.observe(el));

        window.addEventListener("keydown", (event) => {
          if (settingsVisible()) {
            if (event.key === "Escape") {
              event.preventDefault();
              closeSettings();
            }
            return;
          }

          if (shortcutsVisible()) {
            if (event.key === "Escape" || event.key === "?") {
              event.preventDefault();
              closeShortcuts();
            }
            return;
          }

          const target = event.target;
          if (target && target.tagName && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

          if (event.key === "?") {
            event.preventDefault();
            toggleShortcuts();
          } else if (event.key === "j") {
            event.preventDefault();
            focusEntry(Math.min(entries.length - 1, pointer + 1));
          } else if (event.key === "k") {
            event.preventDefault();
            focusEntry(Math.max(0, pointer - 1));
          } else if (event.key === "m") {
            event.preventDefault();
            markRead(entries[pointer], false);
          } else if (event.key === "M") {
            event.preventDefault();
            markAbove(entries[pointer]);
          } else if (event.key === "r") {
            event.preventDefault();
            const form = document.querySelector('form[action="/refresh"]');
            if (form) {
              const submit = typeof form.requestSubmit === "function"
                ? form.requestSubmit.bind(form)
                : form.submit.bind(form);
              submit();
            }
          } else if (event.key === "a") {
            event.preventDefault();
            if (!settingsVisible()) openSettings();
            if (feedUrlInput instanceof HTMLElement) feedUrlInput.focus({ preventScroll: true });
          } else if (event.key === "v") {
            event.preventDefault();
            const entry = entries[pointer];
            if (!entry) return;
            const link = entry.querySelector("a");
            if (link instanceof HTMLAnchorElement && link.href) {
              window.open(link.href, "_blank", "noopener");
            }
          }
        });

        // Lightweight sanitizer for entry summaries to keep the DOM safe.
        (() => {
          const allowedTags = new Set([
            "P",
            "A",
            "UL",
            "OL",
            "LI",
            "EM",
            "STRONG",
            "CODE",
            "PRE",
            "BLOCKQUOTE",
            "BR",
            "B",
            "I",
            "IMG",
            "H1",
            "H2",
            "H3",
            "H4",
            "H5",
            "H6",
          ]);
          const allowedAttrs = {
            A: new Set(["href", "title"]),
            IMG: new Set(["src", "title", "alt", "width", "height"]),
          };

          const isSafeUrl = (value) => {
            const lowered = value.trim().toLowerCase();
            return !(lowered.startsWith("javascript:") || lowered.startsWith("data:text/html"));
          };

          const wrapStyleAsPre = (el) => {
            const text = (el.textContent || "").trim();
            const pre = document.createElement("pre");
            const code = document.createElement("code");
            code.textContent = text;
            pre.appendChild(code);
            el.replaceWith(pre);
          };

          const unwrap = (el) => {
            const frag = document.createDocumentFragment();
            while (el.firstChild) frag.appendChild(el.firstChild);
            el.replaceWith(frag);
          };

          const cleanse = (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node;
              if (el.tagName === "STYLE") {
                wrapStyleAsPre(el);
                return;
              }
              if (!allowedTags.has(el.tagName)) {
                const children = Array.from(el.childNodes);
                unwrap(el);
                children.forEach((child) => cleanse(child));
              } else {
                for (const attr of Array.from(el.attributes)) {
                  if (attr.name.startsWith("on")) {
                    el.removeAttribute(attr.name);
                    continue;
                  }
                  const allowed = allowedAttrs[el.tagName];
                  if (allowed && !allowed.has(attr.name)) {
                    el.removeAttribute(attr.name);
                  }
                }
                if (el.tagName === "A" && el.hasAttribute("href")) {
                  const href = el.getAttribute("href");
                  if (!href || !isSafeUrl(href)) {
                    el.removeAttribute("href");
                  } else {
                    el.setAttribute("rel", "noreferrer");
                    el.setAttribute("target", "_blank");
                  }
                }
                if (el.tagName === "IMG" && el.hasAttribute("src")) {
                  const src = el.getAttribute("src") || "";
                  const safeImg = new RegExp("^https?://", "i");
                  if (!src || !safeImg.test(src)) {
                    el.removeAttribute("src");
                  } else {
                    el.setAttribute("loading", "lazy");
                    el.removeAttribute("width");
                    el.removeAttribute("height");
                  }
                }
              }
            }
            for (const child of Array.from(node.childNodes)) {
              cleanse(child);
            }
          };

          const formatPlainText = (html) => {
            if (!html.includes("\\n")) {
              return html ? "<p>" + html + "</p>" : "";
            }

            const lines = html
              .split(/\\n+/)
              .map((line) => line.trim())
              .filter(Boolean);

            if (lines.length === 0) return "";

            const bulletPattern = /^[-*•]\\s*/;
            if (lines.every((line) => bulletPattern.test(line))) {
              const items = lines.map((line) => line.replace(bulletPattern, "").trim());
              return (
                "<ul>" +
                items
                  .map((item) => "<li>" + item + "</li>")
                  .join("") +
                "</ul>"
              );
            }

            return "<p>" + lines.join("</p><p>") + "</p>";
          };

      const sanitize = (html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html || "", "text/html");
        const root = doc.body || doc.documentElement;
        if (!root) return "";
        cleanse(root);
        let cleaned = root.innerHTML || "";
        if (cleaned.includes("<")) return cleaned;
        // If HTML entities were decoded into text nodes only, stitch textContent.
        if (!cleaned && root.textContent) {
          cleaned = root.textContent;
        }
        return formatPlainText(cleaned);
      };

          // Defer until DOM ready to ensure summaries exist
          const hydrateSummaries = () => {
            document.querySelectorAll(".summary[data-raw]").forEach((el) => {
              const raw = el.dataset.raw || "";
              if (!raw) return;
              let decoded = "";
              try {
                decoded = decodeURIComponent(raw);
              } catch {
                decoded = raw;
              }
              const rendered = sanitize(decodeHtmlEntities(decoded));
              if (rendered) {
                el.innerHTML = rendered;
              }
            });
          };

          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", hydrateSummaries, { once: true });
          } else {
            hydrateSummaries();
          }
        })();
      })();
    </script>
  </body>
</html>
`;
}

function renderEntries(entries: EntryView[]) {
  return entries
    .map((entry) => {
      const date = entry.published_at ?? entry.fetched_at;
      const displayDate = formatDate(date);
      const summary = entry.summary ?? "";
      const rawSummary = encodeURIComponent(summary);
      const title = formatText(entry.title ?? "(untitled)");

      const hydratedSummary = sanitizeSummaryHtml(summary);

          return `
      <article class="entry" tabindex="-1" data-entry-id="${entry.id}" data-sort-key="${entry.sort_key}" data-read="${entry.unread ? "0" : "1"}">
        <header>
          <span class="feed">${escapeHtml(entry.feed_title ?? entry.feed_url)}</span>
          <time datetime="${escapeHtml(date ?? "")}">${displayDate}</time>
        </header>
        <h3><a href="${escapeAttr(entry.url ?? entry.feed_url)}" target="_blank" rel="noreferrer">${title}</a></h3>
        ${summary ? `<div class="summary" data-raw="${escapeAttr(rawSummary)}">${hydratedSummary}</div>` : ""}
        <div class="actions">
          <form class="inline" method="post" action="/entries/${entry.id}/read">
            <button type="submit" data-action="mark-read">Mark read</button>
          </form>
          <form class="inline" method="post" action="/entries/mark-above">
            <input type="hidden" name="pivot" value="${entry.sort_key}" />
            <button type="submit" data-action="mark-above">Mark above</button>
          </form>
        </div>
      </article>
    `;
    })
    .join("");
}

function renderFeedList(feeds: FeedWithCounts[], selectedFeedId?: number) {
  return feeds
    .map(
      (feed) => {
        const active = selectedFeedId === feed.id;
        return `
          <div class="feed-row ${active ? "active" : ""}">
            <a class="feed-main" href="/?feed=${feed.id}">
              <div class="stack">
                <strong>${formatText(feed.title ?? feed.url)}</strong>
                ${feed.fetch_error ? `<span class="feed-error">${escapeHtml(feed.fetch_error)}</span>` : ""}
              </div>
              <span class="unread-pill">${feed.unread_count}</span>
            </a>
            <details class="feed-menu">
              <summary aria-label="Feed options">…</summary>
              <div class="menu-panel">
                <form class="stack" method="post" action="/feeds/${feed.id}/update">
                  <label>
                    Title
                    <input type="text" name="title" value="${escapeAttr(feed.title ?? "")}" placeholder="Feed title" />
                  </label>
                  <label>
                    URL
                    <input type="url" name="url" value="${escapeAttr(feed.url)}" required />
                  </label>
                  <div class="menu-actions">
                    <button type="submit" class="primary">Save</button>
                  </div>
                </form>
                <form class="inline" method="post" action="/feeds/${feed.id}/delete" onsubmit="return confirm('Remove this subscription?');">
                  <button type="submit" class="danger">Delete</button>
                </form>
              </div>
            </details>
          </div>
        `;
      },
    )
    .join("");
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("default", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function totalUnread(feeds: FeedWithCounts[]) {
  return feeds.reduce((sum, f) => sum + (f.unread_count ?? 0), 0);
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(input: string) {
  return escapeHtml(input).replace(/`/g, "&#96;");
}

function formatText(input: string | null | undefined) {
  return escapeHtml(decodeHtmlEntities(input ?? ""));
}

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ");
}

function decodeHtmlEntities(input: string) {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, ent: string) => {
    if (ent[0] === "#") {
      const isHex = ent[1]?.toLowerCase() === "x";
      const num = parseInt(ent.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isNaN(num)) {
        return String.fromCodePoint(num);
      }
      return _;
    }
    const lower = ent.toLowerCase();
    return named[lower] ?? _;
  });
}

export function sanitizeSummaryHtml(html: string) {
  if (!html) return "";
  let cleaned = decodeHtmlEntities(html);
  cleaned = cleaned.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1>/gi, "");
  cleaned = cleaned.replace(/<\s*(iframe|object|embed|form)[^>]*>[\s\S]*?<\/\s*\1>/gi, "");
  cleaned = cleaned.replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, "");
  cleaned = cleaned.replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1="#"');
  cleaned = cleaned.replace(/<img([^>]+)>/gi, (_match, attrs) => {
    const safeAttrs = attrs
      .replace(/\s*(on\w+|style)\s*=\s*(['"])[\s\S]*?\2/gi, "")
      .replace(/\s*src\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, ' src="#"');
    return `<img${safeAttrs}>`;
  });
  cleaned = cleaned.replace(/<a(\s[^>]*?)?>/gi, (match, attrs = "") => {
    const hasTarget = /\starget\s*=/i.test(attrs);
    const hasRel = /\srel\s*=/i.test(attrs);
    let updatedAttrs = attrs;
    if (!hasTarget) updatedAttrs += ' target="_blank"';
    if (hasRel) {
      updatedAttrs = updatedAttrs.replace(/rel\s*=\s*(['"])(.*?)\1/i, (_m, quote, value) => {
        const tokens = new Set(
          String(value)
            .split(/\s+/)
            .filter(Boolean),
        );
        tokens.add("noreferrer");
        tokens.add("noopener");
        return `rel="${Array.from(tokens).join(" ")}"`;
      });
    } else {
      updatedAttrs += ' rel="noreferrer noopener"';
    }
    return `<a${updatedAttrs}>`;
  });
  return cleaned;
}
