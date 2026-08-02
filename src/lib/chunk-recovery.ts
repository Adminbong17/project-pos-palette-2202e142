const KEY = "__chunk_reload_at";
const COOLDOWN_MS = 15_000;

export function isChunkLoadError(error: unknown): boolean {
  const msg =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : String((error as { message?: string } | null)?.message ?? "");
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk .* failed/i.test(msg) ||
    /Unable to preload CSS/i.test(msg)
  );
}

/** Hard-reload once (cache-busted) when a stale deploy chunk fails to load. */
export function recoverFromChunkError(error: unknown): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? "0");
    if (Date.now() - last < COOLDOWN_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* ignore storage failures */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

let installed = false;

export function installChunkRecovery() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("vite:preloadError", (event) => {
    if (recoverFromChunkError((event as unknown as { payload?: unknown }).payload)) {
      event.preventDefault();
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    recoverFromChunkError(event.reason);
  });
  window.addEventListener("error", (event) => {
    recoverFromChunkError((event as ErrorEvent).error ?? (event as ErrorEvent).message);
  });
}
