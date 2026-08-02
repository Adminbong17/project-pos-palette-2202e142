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

/** Hosts that always serve the FULL app (POS + inventory + prescriptions). */
const FULL_APP_HOSTS = [
  /^sell\./i,
  /^app\./i,
  /^pos\./i,
  /^www\./i,
];

/** Paths reachable while in prescription-only (Rx domain) mode. */
export const RX_PATHS = ["/prescriptions", "/rx-lists", "/rx-options", "/admin/prescriptions"];

export function isRxHost(hostname?: string | null) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  if (FULL_APP_HOSTS.some((re) => re.test(h))) return false;
  return RX_HOST_MATCHERS.some((re) => re.test(h));
}

function isFullAppHost(hostname?: string | null) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  return FULL_APP_HOSTS.some((re) => re.test(h));
}

/** Client-only check. Returns false during SSR. */
export function isRxMode() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;

  // A production full-app host (e.g. sell.sheikhpharma.shop) is never Rx mode,
  // and clears any stale local override left over from testing.
  if (isFullAppHost(host)) {
    try {
      window.localStorage.removeItem("rx-mode");
    } catch {
      /* ignore */
    }
    return false;
  }

  try {
    const param = new URLSearchParams(window.location.search).get("rx");
    if (param === "0") {
      window.localStorage.removeItem("rx-mode");
      return isRxHost(host);
    }
    if (param === "1") {
      window.localStorage.setItem("rx-mode", "1");
      return true;
    }
    if (window.localStorage.getItem("rx-mode") === "1") return true;
  } catch {
    /* storage blocked — fall back to hostname only */
  }
  return isRxHost(host);
}


export function isRxPathAllowed(pathname: string) {
  return RX_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
