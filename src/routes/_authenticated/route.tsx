import { createFileRoute, Outlet, redirect, useLocation, Navigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { useAllowedSections, isPathAllowed } from "@/hooks/use-allowed-sections";
import { isRxMode, isRxPathAllowed } from "@/lib/rx-mode";

import { LogOut, ArrowLeft, ShoppingCart } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { data: business } = useCurrentBusiness();
  const { isLoading: roleLoading } = useCurrentRole();
  const { isAdmin, sections: allowed, isLoading: sectionsLoading } = useAllowedSections();
  const navigate = useNavigate();
  
  const pathname = useLocation({ select: (l) => l.pathname });
  const qc = useQueryClient();
  const rxMode = isRxMode();
  const canUsePos = !rxMode && (isAdmin || !allowed || allowed.includes("pos"));
  const homePath = rxMode
    ? "/rx-dashboard"

    : allowed && allowed.length === 1 && allowed[0] === "rx-queue"
      ? "/rx-appointments"
      : isAdmin || !allowed || allowed.includes("dashboard")
      ? "/dashboard"
      : `/${allowed[0] ?? "pos"}`;
  const isHome = pathname === homePath;

  if (rxMode && !isRxPathAllowed(pathname)) {
    return <Navigate to="/prescriptions" replace />;
  }

  if (!roleLoading && !sectionsLoading && !isAdmin && !isPathAllowed(pathname, allowed)) {
    const first = allowed && allowed.length ? allowed[0] : "pos";
    return <Navigate to={`/${first}` as any} replace />;
  }


  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function goBack() {
    // Prefer going up one path segment so Back always lands somewhere sensible,
    // regardless of browser history state (which may point to /auth or be empty).
    const clean = pathname.replace(/\/+$/, "");
    const parent = clean.substring(0, clean.lastIndexOf("/")) || homePath;
    const target = parent === "/" ? homePath : parent;
    navigate({ to: target as any });
  }


  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            {!isHome && (
              <button
                onClick={goBack}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                title="Go back"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            <div className="flex-1" />
            {business && (
              <div className="hidden sm:flex flex-col text-right text-[11px] leading-tight">
                <span className="font-medium text-foreground">{business.name}</span>
                <span className="text-muted-foreground">QweekPOS</span>
              </div>
            )}
            {canUsePos && (
              <button
                onClick={() => navigate({ to: "/pos" })}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                title="Open POS"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                POS
              </button>
            )}
            <button
              onClick={signOut}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </header>
          <main className="flex-1"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
