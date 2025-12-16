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
        color-scheme: light dark;
        
        /* Base color in OKLCH - can be customized */
        --base-hue: 240;
        --base-chroma: 0.12;
        --base-lightness: 0.50;
        
        /* Generate color palette from base using OKLCH for perceptual uniformity */
        --color-base: oklch(var(--base-lightness) var(--base-chroma) var(--base-hue));
        
        /* Relative color variations with slight hue/chroma shifts for more natural scales */
        --color-light: oklch(from var(--color-base) calc(l + 0.25) calc(c - 0.02) calc(h - 5));
        --color-lighter: oklch(from var(--color-base) calc(l + 0.35) calc(c - 0.04) calc(h - 8));
        --color-dark: oklch(from var(--color-base) calc(l - 0.15) calc(c + 0.02) calc(h + 3));
        --color-darker: oklch(from var(--color-base) calc(l - 0.25) calc(c + 0.03) calc(h + 5));
        
        /* Semantic color assignments using light-dark() for automatic theme switching */
        --bg: light-dark(
          oklch(0.97 0.01 var(--base-hue)),
          oklch(0.15 0.02 var(--base-hue))
        );
        --panel: light-dark(
          oklch(1.0 0 0),
          oklch(0.20 0.03 var(--base-hue))
        );
        --ink: light-dark(
          oklch(0.20 0.05 var(--base-hue)),
          oklch(0.95 0.02 var(--base-hue))
        );
        --muted: light-dark(
          oklch(0.50 0.03 var(--base-hue)),
          oklch(0.60 0.04 var(--base-hue))
        );
        --accent: var(--color-base);
        --accent-strong: var(--color-dark);
        --accent-light: var(--color-light);
        --border: light-dark(
          oklch(0.88 0.02 var(--base-hue)),
          oklch(0.30 0.03 var(--base-hue))
        );
        --shadow: light-dark(
          0 10px 40px oklch(0.20 0.05 var(--base-hue) / 0.08),
          0 10px 40px oklch(0.05 0.02 0 / 0.4)
        );
        
        font-family: "Atkinson Hyperlegible", "IBM Plex Sans", "Segoe UI", sans-serif;
        background-color: var(--bg);
        color: var(--ink);
      }
      
      /* Predefined themes - 12-bit rainbow palette from iamkate.com */
      /* #817 */ :root[data-theme="red"] {
        --base-hue: 350;
        --base-chroma: 0.08;
        --base-lightness: 0.42;
      }
      
      /* #a35 */ :root[data-theme="pink"] {
        --base-hue: 340;
        --base-chroma: 0.12;
        --base-lightness: 0.50;
      }
      
      /* #c66 */ :root[data-theme="coral"] {
        --base-hue: 15;
        --base-chroma: 0.14;
        --base-lightness: 0.58;
      }
      
      /* #e94 */ :root[data-theme="orange"] {
        --base-hue: 35;
        --base-chroma: 0.16;
        --base-lightness: 0.65;
      }
      
      /* #ed0 */ :root[data-theme="yellow"] {
        --base-hue: 85;
        --base-chroma: 0.18;
        --base-lightness: 0.75;
      }
      
      /* #9d5 */ :root[data-theme="lime"] {
        --base-hue: 120;
        --base-chroma: 0.14;
        --base-lightness: 0.68;
      }
      
      /* #4d8 */ :root[data-theme="green"] {
        --base-hue: 160;
        --base-chroma: 0.12;
        --base-lightness: 0.62;
      }
      
      /* #2cb */ :root[data-theme="teal"] {
        --base-hue: 180;
        --base-chroma: 0.13;
        --base-lightness: 0.60;
      }
      
      /* #0bc */ :root[data-theme="cyan"] {
        --base-hue: 195;
        --base-chroma: 0.14;
        --base-lightness: 0.62;
      }
      
      /* #09c */ :root[data-theme="azure"] {
        --base-hue: 220;
        --base-chroma: 0.14;
        --base-lightness: 0.55;
      }
      
      /* #36b */ :root[data-theme="blue"] {
        --base-hue: 250;
        --base-chroma: 0.13;
        --base-lightness: 0.48;
      }
      
      /* #639 */ :root[data-theme="purple"] {
        --base-hue: 290;
        --base-chroma: 0.11;
        --base-lightness: 0.46;
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
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
        align-items: center;
      }

      .feed-menu .menu-actions button {
        width: 100%;
      }

      .feed-menu .menu-actions .wide {
        grid-column: 1 / -1;
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

      .entry:focus-visible,
      .entry.current {
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
      
      .theme-selector {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 0.5rem;
      }
      
      .theme-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4rem;
        padding: 0.6rem;
        border: 2px solid var(--border);
        background: var(--panel);
        border-radius: 8px;
        cursor: pointer;
        transition: all 120ms ease;
        font-size: 0.85rem;
      }
      
      .theme-btn:hover {
        transform: translateY(-2px);
        border-color: var(--accent);
      }
      
      .theme-btn.active {
        border-color: var(--accent);
        background: light-dark(
          oklch(from var(--accent) calc(l + 0.40) calc(c * 0.3) h),
          oklch(from var(--accent) calc(l - 0.20) calc(c * 0.8) h)
        );
        box-shadow: 0 0 0 1px var(--accent);
      }
      
      .theme-swatch {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        border: 1px solid var(--border);
        box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
      }
      
      .custom-color-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      
      .color-picker {
        width: 60px;
        height: 40px;
        border: 1px solid var(--border);
        border-radius: 8px;
        cursor: pointer;
        background: var(--panel);
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
          <div class="stack">
            <span><strong>Theme</strong></span>
            <div class="theme-selector">
              <button type="button" class="theme-btn" data-theme="red" aria-label="Red theme">
                <span class="theme-swatch" style="background: #817;"></span>
                <span>Red</span>
              </button>
              <button type="button" class="theme-btn" data-theme="pink" aria-label="Pink theme">
                <span class="theme-swatch" style="background: #a35;"></span>
                <span>Pink</span>
              </button>
              <button type="button" class="theme-btn" data-theme="coral" aria-label="Coral theme">
                <span class="theme-swatch" style="background: #c66;"></span>
                <span>Coral</span>
              </button>
              <button type="button" class="theme-btn" data-theme="orange" aria-label="Orange theme">
                <span class="theme-swatch" style="background: #e94;"></span>
                <span>Orange</span>
              </button>
              <button type="button" class="theme-btn" data-theme="yellow" aria-label="Yellow theme">
                <span class="theme-swatch" style="background: #ed0;"></span>
                <span>Yellow</span>
              </button>
              <button type="button" class="theme-btn" data-theme="lime" aria-label="Lime theme">
                <span class="theme-swatch" style="background: #9d5;"></span>
                <span>Lime</span>
              </button>
              <button type="button" class="theme-btn" data-theme="green" aria-label="Green theme">
                <span class="theme-swatch" style="background: #4d8;"></span>
                <span>Green</span>
              </button>
              <button type="button" class="theme-btn" data-theme="teal" aria-label="Teal theme">
                <span class="theme-swatch" style="background: #2cb;"></span>
                <span>Teal</span>
              </button>
              <button type="button" class="theme-btn" data-theme="cyan" aria-label="Cyan theme">
                <span class="theme-swatch" style="background: #0bc;"></span>
                <span>Cyan</span>
              </button>
              <button type="button" class="theme-btn" data-theme="azure" aria-label="Azure theme">
                <span class="theme-swatch" style="background: #09c;"></span>
                <span>Azure</span>
              </button>
              <button type="button" class="theme-btn" data-theme="blue" aria-label="Blue theme">
                <span class="theme-swatch" style="background: #36b;"></span>
                <span>Blue</span>
              </button>
              <button type="button" class="theme-btn" data-theme="purple" aria-label="Purple theme">
                <span class="theme-swatch" style="background: #639;"></span>
                <span>Purple</span>
              </button>
            </div>
            <div class="stack" style="margin-top: 0.5rem;">
              <span class="muted" style="font-size: 0.9rem;">Custom color</span>
              <div class="custom-color-row">
                <input type="color" id="custom-color-picker" class="color-picker" value="#234f9e" aria-label="Custom color" />
                <button type="button" id="apply-custom-color" class="primary">Apply custom</button>
              </div>
              <p class="muted" style="margin: 0; font-size: 0.85rem;">Pick a color to generate a custom theme.</p>
            </div>
          </div>
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
            <span>View all feeds</span>
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
            <details class="feed-menu">
              <summary aria-label="All feeds options">…</summary>
              <div class="menu-panel">
                <div class="menu-actions">
                  <form class="inline wide" method="post" action="/entries/mark-all" onsubmit="return confirm('Mark all entries as read?');">
                    <button type="submit">Mark all read</button>
                  </form>
                </div>
              </div>
            </details>
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

        let scrollingToEntry = false;

        const setCurrent = (idx) => {
          entries.forEach((el, i) => el.classList.toggle("current", i === idx));
          pointer = idx;
        };

        const focusEntry = (idx) => {
          const target = entries[idx];
          if (!target) return;
          scrollingToEntry = true;
          setCurrent(idx);
          target.focus({ preventScroll: true });
          if (entriesContainer instanceof HTMLElement) {
            const rect = target.getBoundingClientRect();
            const containerRect = entriesContainer.getBoundingClientRect();
            const offset = rect.top - containerRect.top - 8;
            entriesContainer.scrollBy({ top: offset, behavior: "smooth" });
          } else {
            target.scrollIntoView({ block: "start", behavior: "smooth" });
          }
          setTimeout(() => { scrollingToEntry = false; }, 300);
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

        const highlightIO = new IntersectionObserver((items) => {
          if (scrollingToEntry) return;
          
          // Check all entries to find the topmost currently visible one
          // Note: items only contains entries that changed intersection state,
          // so we need to check the actual DOM for which entries are visible
          let topIdx = -1;
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (!entry) continue;
            const rect = entry.getBoundingClientRect();
            if (!entriesContainer) continue;
            const containerRect = entriesContainer.getBoundingClientRect();
            
            // Check if entry is visibly intersecting the container
            const isVisible = rect.top < containerRect.bottom && rect.bottom > containerRect.top;
            const isHalfVisible = (rect.top + rect.height / 2) >= containerRect.top && 
                                  (rect.top + rect.height / 2) <= containerRect.bottom;
            
            if (isVisible && isHalfVisible) {
              topIdx = i;
              break; // Found the topmost visible entry
            }
          }
          
          // Only update if we found a visible entry different from current pointer
          if (topIdx !== -1 && topIdx !== pointer) {
            setCurrent(topIdx);
          }
        }, { root: entriesContainer, threshold: 0.5 });

        entries.forEach((el) => highlightIO.observe(el));

        if (entries.length > 0) {
          setCurrent(0);
        }

        entries.forEach((el, idx) => {
          el.addEventListener("click", (event) => {
            const target = event.target;
            if (target instanceof HTMLAnchorElement || target instanceof HTMLButtonElement) return;
            if (target instanceof Element && target.closest("a, button")) return;
            setCurrent(idx);
          });
        });

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
            window.location.href = "/";
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

        // Theme management
        (() => {
          const applyTheme = (theme, customHue, customChroma, customLightness) => {
            const root = document.documentElement;
            if (theme === 'custom' && customHue !== null) {
              root.removeAttribute('data-theme');
              root.style.setProperty('--base-hue', customHue);
              root.style.setProperty('--base-chroma', customChroma);
              root.style.setProperty('--base-lightness', customLightness);
            } else if (theme) {
              root.setAttribute('data-theme', theme);
              root.style.removeProperty('--base-hue');
              root.style.removeProperty('--base-chroma');
              root.style.removeProperty('--base-lightness');
            }
          };

          const hexToOklch = (hex) => {
            // Convert hex to RGB
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            
            // Convert RGB to HSL first (simpler and more reliable)
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            
            let hslHue = 0;
            if (delta !== 0) {
              if (max === r) {
                hslHue = 60 * (((g - b) / delta) % 6);
              } else if (max === g) {
                hslHue = 60 * (((b - r) / delta) + 2);
              } else {
                hslHue = 60 * (((r - g) / delta) + 4);
              }
            }
            if (hslHue < 0) hslHue += 360;
            
            // Map HSL hue to approximate OKLCH hue
            // HSL and OKLCH hues don't align 1:1, so we need to remap
            const hueMap = [
              [0, 30],      // Red
              [60, 90],     // Yellow
              [120, 145],   // Green
              [180, 195],   // Cyan
              [240, 265],   // Blue
              [300, 330],   // Magenta
              [360, 390]    // Red (wrap)
            ];
            
            let oklchHue = hslHue;
            for (let i = 0; i < hueMap.length - 1; i++) {
              const [hslStart, oklchStart] = hueMap[i];
              const [hslEnd, oklchEnd] = hueMap[i + 1];
              if (hslHue >= hslStart && hslHue <= hslEnd) {
                const t = (hslHue - hslStart) / (hslEnd - hslStart);
                oklchHue = oklchStart + t * (oklchEnd - oklchStart);
                break;
              }
            }
            if (oklchHue >= 360) oklchHue -= 360;
            
            // Lightness (approximate from HSL lightness)
            const lightness = (max + min) / 2;
            
            // Chroma (approximate from HSL saturation)
            const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
            const chroma = saturation * 0.15; // Scale saturation to reasonable chroma range
            
            return {
              hue: oklchHue.toFixed(0),
              chroma: Math.max(0.06, Math.min(0.18, chroma)).toFixed(2),
              lightness: Math.max(0.40, Math.min(0.60, lightness)).toFixed(2)
            };
          };

          // Load saved theme
          try {
            const saved = localStorage.getItem('seymour-theme');
            if (saved) {
              const data = JSON.parse(saved);
              applyTheme(data.theme, data.customHue, data.customChroma, data.customLightness);
              
              // Update active state for theme buttons
              document.querySelectorAll('.theme-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.theme === data.theme);
              });
              
              // Update color picker if custom
              if (data.theme === 'custom' && data.customColor) {
                const picker = document.getElementById('custom-color-picker');
                if (picker instanceof HTMLInputElement) {
                  picker.value = data.customColor;
                }
              }
            }
          } catch (e) {
            // Ignore localStorage errors
          }

          // Theme button handlers
          document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const theme = btn.dataset.theme;
              if (!theme) return;
              
              applyTheme(theme, null, null, null);
              
              document.querySelectorAll('.theme-btn').forEach(b => {
                b.classList.toggle('active', b === btn);
              });
              
              try {
                localStorage.setItem('seymour-theme', JSON.stringify({ theme }));
              } catch (e) {
                // Ignore localStorage errors
              }
            });
          });

          // Custom color handler
          const customColorBtn = document.getElementById('apply-custom-color');
          const customColorPicker = document.getElementById('custom-color-picker');
          
          if (customColorBtn && customColorPicker instanceof HTMLInputElement) {
            customColorBtn.addEventListener('click', () => {
              const hex = customColorPicker.value;
              const oklch = hexToOklch(hex);
              
              applyTheme('custom', oklch.hue, oklch.chroma, oklch.lightness);
              
              document.querySelectorAll('.theme-btn').forEach(btn => {
                btn.classList.remove('active');
              });
              
              try {
                localStorage.setItem('seymour-theme', JSON.stringify({
                  theme: 'custom',
                  customHue: oklch.hue,
                  customChroma: oklch.chroma,
                  customLightness: oklch.lightness,
                  customColor: hex
                }));
              } catch (e) {
                // Ignore localStorage errors
              }
            });
          }
        })();

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
                <form id="feed-update-${feed.id}" class="stack" method="post" action="/feeds/${feed.id}/update">
                  <label>
                    Title
                    <input type="text" name="title" value="${escapeAttr(feed.title ?? "")}" placeholder="Feed title" />
                  </label>
                  <label>
                    URL
                    <input type="url" name="url" value="${escapeAttr(feed.url)}" required />
                  </label>
                </form>
                <div class="menu-actions">
                  <form class="inline wide" method="post" action="/feeds/${feed.id}/mark-read" onsubmit="return confirm('Mark all entries from this subscription as read?');">
                    <button type="submit">Mark all read</button>
                  </form>
                  <button type="submit" class="primary" form="feed-update-${feed.id}">Save</button>
                  <form class="inline" method="post" action="/feeds/${feed.id}/delete" onsubmit="return confirm('Remove this subscription?');">
                    <button type="submit" class="danger">Delete</button>
                  </form>
                </div>
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
  cleaned = cleaned.replace(/<\s*head[^>]*>[\s\S]*?<\/\s*head\s*>/gi, "");
  cleaned = cleaned.replace(/<\s*title[^>]*>[\s\S]*?<\/\s*title\s*>/gi, "");
  cleaned = cleaned.replace(/<\s*(base|meta|link)\b[^>]*\/?>/gi, "");
  cleaned = cleaned.replace(/<\/?\s*(html|body)\b[^>]*>/gi, "");
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
