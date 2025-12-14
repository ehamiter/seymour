import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Point the app at an isolated database for test runs.
if (!process.env.DB_PATH) {
  const dir = mkdtempSync(join(tmpdir(), "seymour-tests-"));
  process.env.DB_PATH = join(dir, "reader.sqlite");
}

// Provide minimal browser APIs that the client script expects.
if (!globalThis.IntersectionObserver) {
  class NoopIntersectionObserver {
    constructor(_cb: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // @ts-expect-error assigning stub
  globalThis.IntersectionObserver = NoopIntersectionObserver;
}

// Avoid missing method errors in environments without layout.
const HTMLElementCtor = (globalThis as any).HTMLElement;
if (HTMLElementCtor && typeof HTMLElementCtor.prototype.scrollIntoView !== "function") {
  HTMLElementCtor.prototype.scrollIntoView = () => {};
}
