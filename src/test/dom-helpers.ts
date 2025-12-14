import { Window } from "happy-dom";

type DomOptions = {
  fetchImpl?: typeof fetch;
  openImpl?: typeof open;
  intersectionObserverImpl?: typeof IntersectionObserver;
};

export function mountHtmlDocument(html: string, options: DomOptions = {}) {
  const window = new Window({ url: "http://localhost" });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Node: (globalThis as any).Node,
    DOMParser: (globalThis as any).DOMParser,
    HTMLElement: (globalThis as any).HTMLElement,
    HTMLInputElement: (globalThis as any).HTMLInputElement,
    HTMLTextAreaElement: (globalThis as any).HTMLTextAreaElement,
    HTMLAnchorElement: (globalThis as any).HTMLAnchorElement,
    DocumentFragment: (globalThis as any).DocumentFragment,
    Event: (globalThis as any).Event,
    KeyboardEvent: (globalThis as any).KeyboardEvent,
    IntersectionObserver: (globalThis as any).IntersectionObserver,
    fetch: globalThis.fetch,
    open: (globalThis as any).open,
  };

  const intersectionObserver =
    options.intersectionObserverImpl ??
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };

  const fetchMock =
    options.fetchImpl ??
    (async () => new window.Response(null, { status: 204 }));

  const openMock = options.openImpl ?? (() => undefined);

  (globalThis as any).window = window as any;
  (globalThis as any).document = window.document as any;
  (globalThis as any).Node = window.Node as any;
  (globalThis as any).DOMParser = window.DOMParser as any;
  (globalThis as any).HTMLElement = window.HTMLElement as any;
  (globalThis as any).HTMLInputElement = window.HTMLInputElement as any;
  (globalThis as any).HTMLTextAreaElement = window.HTMLTextAreaElement as any;
  (globalThis as any).HTMLAnchorElement = window.HTMLAnchorElement as any;
  (globalThis as any).DocumentFragment = window.DocumentFragment as any;
  (globalThis as any).Event = window.Event as any;
  (globalThis as any).KeyboardEvent = window.KeyboardEvent as any;
  (globalThis as any).IntersectionObserver = intersectionObserver as any;
  (globalThis as any).fetch = fetchMock as any;
  (window as any).fetch = fetchMock as any;
  (window as any).open = openMock as any;
  (globalThis as any).open = openMock as any;

  window.document.write(html);
  window.document.close();

  const scriptEl = window.document.querySelector("script");
  if (scriptEl?.textContent) {
    const run = new Function(scriptEl.textContent);
    run();
  }

  // Ensure any DOMContentLoaded listeners run.
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));

  const restore = () => {
    (globalThis as any).window = previous.window;
    (globalThis as any).document = previous.document;
    (globalThis as any).Node = previous.Node;
    (globalThis as any).DOMParser = previous.DOMParser;
    (globalThis as any).HTMLElement = previous.HTMLElement;
    (globalThis as any).HTMLInputElement = previous.HTMLInputElement;
    (globalThis as any).HTMLTextAreaElement = previous.HTMLTextAreaElement;
    (globalThis as any).HTMLAnchorElement = previous.HTMLAnchorElement;
    (globalThis as any).DocumentFragment = previous.DocumentFragment;
    (globalThis as any).Event = previous.Event;
    (globalThis as any).KeyboardEvent = previous.KeyboardEvent;
    (globalThis as any).IntersectionObserver = previous.IntersectionObserver;
    (globalThis as any).fetch = previous.fetch;
    (globalThis as any).open = previous.open;
  };

  return { window, document: window.document, restore, fetchMock, openMock };
}
