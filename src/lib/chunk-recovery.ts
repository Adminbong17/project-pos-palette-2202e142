const KEY = "__chunk_reload_at";
const COOLDOWN_MS = 8_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const msg =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? `${error.name}: ${error.message} ${error.stack ?? ""}`
        : String((error as { message?: string } | null)?.message ?? "");
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk .* failed/i.test(msg) ||
    /Unable to preload CSS/i.test(msg) ||
    /dynamically imported module/i.test(msg) ||
    /vite:preloadError/i.test(msg)
  );
}

/** Hard-reload once (cache-busted) when a stale deploy chunk fails to load. */
export function recoverFromChunkError(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!isChunkLoadError(error) && !String(error).includes("Failed to load asset")) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? "0");
    if (Date.now() - last < COOLDOWN_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* ignore storage failures */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

let installed = false;

export function installChunkRecovery() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // 1. Vite preloadError event — fires when any code-split chunk 404s after a new build deploy
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    recoverFromChunkError((event as unknown as { payload?: unknown })?.payload ?? new Error("vite:preloadError"));
  });

  // 2. Unhandled promise rejections (often thrown by dynamic imports in TanStack Router)
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault();
      recoverFromChunkError(event.reason);
    }
  });

  // 3. Script / link tag loading errors
  window.addEventListener("error", (event) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "SCRIPT" || target.tagName === "LINK")) {
      const src = (target as HTMLScriptElement).src || (target as HTMLLinkElement).href;
      if (src && (src.includes("/assets/") || src.includes(".js") || src.includes(".css"))) {
        recoverFromChunkError(new Error(`Failed to load asset: ${src}`));
        return;
      }
    }
    if (isChunkLoadError((event as ErrorEvent).error ?? (event as ErrorEvent).message)) {
      recoverFromChunkError((event as ErrorEvent).error ?? (event as ErrorEvent).message);
    }
  });
}
