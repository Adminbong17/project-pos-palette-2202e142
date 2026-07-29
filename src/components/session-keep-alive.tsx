import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps the login session alive for long working sessions (8h+).
 * Supabase access tokens are short-lived, so we proactively refresh them
 * every 20 minutes and whenever the tab regains focus or the network
 * comes back. Without this, a laptop that sleeps or a flaky connection
 * can drop the refresh token and every save then fails with an RLS error.
 */
export function SessionKeepAlive() {
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const expiresAt = (data.session.expires_at ?? 0) * 1000;
      // Refresh when less than 15 minutes of validity remains.
      if (expiresAt - Date.now() < 15 * 60 * 1000) {
        await supabase.auth.refreshSession();
      }
    };

    const interval = window.setInterval(refresh, 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    void refresh();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, []);

  return null;
}
