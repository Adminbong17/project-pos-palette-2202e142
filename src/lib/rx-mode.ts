// Hostname-based "prescription only" mode.
//
// When the app is served from a doctor/prescription domain (e.g. rx.example.com),
// the whole UI collapses to the prescription module: POS / inventory / reports
// navigation is hidden and the landing page goes straight to /prescriptions.
// Same codebase, same database — only the presentation changes per hostname.

const RX_HOST_MATCHERS = [
  /^rx\./i,
  /^prescription[s]?\./i,
  /^doctor[s]?\./i,
  /^dr\./i,
];

/** Paths reachable while in prescription-only (Rx domain) mode. */
export const RX_PATHS = ["/prescriptions", "/rx-lists", "/admin/prescriptions"];

export function isRxHost(hostname?: string | null) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  // Allow local/preview testing with ?rx=1 handled separately in isRxMode().
  return RX_HOST_MATCHERS.some((re) => re.test(h));
}

/** Client-only check. Returns false during SSR. */
export function isRxMode() {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem("rx-mode") === "1") return true;
    if (new URLSearchParams(window.location.search).get("rx") === "1") {
      window.localStorage.setItem("rx-mode", "1");
      return true;
    }
  } catch {
    /* storage blocked — fall back to hostname only */
  }
  return isRxHost(window.location.hostname);
}

export function isRxPathAllowed(pathname: string) {
  return RX_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
