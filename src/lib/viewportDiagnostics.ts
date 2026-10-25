import { APP_VERSION } from "./appInfo";

const MAX_EVENTS = 400;
const startedAt = performance.now();
let installed = false;
let events: Array<{ at: number; kind: string; detail: string }> = [];

function viewportSnapshot() {
  const viewport = window.visualViewport;
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    visualWidth: viewport ? Math.round(viewport.width) : null,
    visualHeight: viewport ? Math.round(viewport.height) : null,
    offsetTop: viewport ? Math.round(viewport.offsetTop) : null,
    scale: viewport?.scale ?? null,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    documentHeight: document.scrollingElement?.scrollHeight ?? null,
    appHeight: Number.parseFloat(
      document.documentElement.style.getPropertyValue("--app-height"),
    ) || null,
    keyboard: document.documentElement.dataset.keyboard ?? null,
  };
}

function describeElement(element: Element | null): string {
  if (!element) return "none";
  const id = element.id ? `#${element.id}` : "";
  return `${element.tagName.toLowerCase()}${id}`;
}

export function recordViewportEvent(
  kind: string,
  detail: string | Record<string, unknown> = "",
): void {
  const rendered =
    typeof detail === "string" ? detail : JSON.stringify(detail);
  events.push({
    at: Math.round(performance.now() - startedAt),
    kind,
    detail: rendered,
  });
  if (events.length > MAX_EVENTS) {
    events = events.slice(events.length - MAX_EVENTS);
  }
}

export function installViewportDiagnostics(): () => void {
  if (installed) return () => undefined;
  installed = true;

  const recording = (kind: string, detail: string | Record<string, unknown> = "") =>
    recordViewportEvent(kind, detail);

  const onFocusIn = (event: FocusEvent) => {
    recording("focusin", {
      target: describeElement(event.target as Element | null),
      trusted: event.isTrusted,
      ...viewportSnapshot(),
    });
  };
  const onFocusOut = (event: FocusEvent) => {
    recording("focusout", {
      target: describeElement(event.target as Element | null),
      ...viewportSnapshot(),
    });
  };
  const onWindowResize = () => {
    recording("window-resize", viewportSnapshot());
  };
  const onWindowScroll = () => {
    if (window.scrollX !== 0 || window.scrollY !== 0) {
      recording("window-scroll", viewportSnapshot());
    }
  };
  const onViewportResize = () => {
    recording("visual-resize", viewportSnapshot());
  };
  const onViewportScroll = () => {
    const viewport = window.visualViewport;
    if (viewport && viewport.offsetTop > 0) {
      recording("visual-scroll", viewportSnapshot());
    }
  };

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  recording("session", {
    version: APP_VERSION,
    standalone,
    userAgent: navigator.userAgent,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
    ...viewportSnapshot(),
  });

  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("scroll", onWindowScroll, { passive: true });
  window.visualViewport?.addEventListener("resize", onViewportResize);
  window.visualViewport?.addEventListener("scroll", onViewportScroll, {
    passive: true,
  });

  return () => {
    // Intentionally left installed for the life of the document. The listener
    // set is tiny and this function is guarded against duplicate installation.
  };
}

export function viewportDiagnosticsReport(): string {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const header = [
    "Zuofei viewport diagnostics",
    `Version: ${APP_VERSION}`,
    `Standalone: ${standalone ? "yes" : "no"}`,
    `User agent: ${navigator.userAgent}`,
    `Screen: ${window.screen.width}x${window.screen.height} @${window.devicePixelRatio}x`,
    `Current viewport: ${JSON.stringify(viewportSnapshot())}`,
    "",
    "No chat text, food data, or API keys are included.",
    "",
    "Events (milliseconds since app load):",
  ];
  const body = events.map(
    (event) => `+${event.at}ms ${event.kind} ${event.detail}`,
  );
  return `${[...header, ...body].join("\n")}\n`;
}
