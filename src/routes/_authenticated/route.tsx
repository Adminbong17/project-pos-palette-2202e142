import { createFileRoute, Outlet, redirect, useLocation, Navigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { useAllowedSections, isPathAllowed, sectionHomePath } from "@/hooks/use-allowed-sections";
import { isRxMode, isRxPathAllowed, isPatientHost } from "@/lib/rx-mode";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";

import { LogOut, ArrowLeft, ShoppingCart, ShieldCheck } from "lucide-react";
import { LogoutConfirm } from "@/components/logout-confirm";
import { BluetoothStatusButton } from "@/components/BluetoothStatusButton";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { usePlatformSubscription } from "@/hooks/use-platform-subscription";
import { SubscriptionDueBanner } from "@/components/SubscriptionDueBanner";
import { SubscriptionLockModal } from "@/components/SubscriptionLockModal";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (isPatientHost()) throw redirect({ to: "/patient" });
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      return { user: sessionData.session.user };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { data: business } = useCurrentBusiness();
  const { isLoading: roleLoading } = useCurrentRole();
  const { sections: allowed, isLoading: sectionsLoading } = useAllowedSections();
  const { isSuperAdmin, isLoading: superLoading } = useIsSuperAdmin();
  const { sub, isLocked, isDueWarning, refetch: refetchSub } = usePlatformSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const bkashStatus = params.get("bkash");
      if (bkashStatus === "success") {
        toast.success("আপনার বিকাশ পেমেন্ট সফল হয়েছে! সাবস্ক্রিপশন সচল করা হয়েছে।");
        refetchSub();
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } else if (bkashStatus === "failed") {
        const reason = params.get("reason") || "পেমেন্ট সম্পন্ন হয়নি";
        toast.error(`বিকাশ পেমেন্ট ব্যর্থ হয়েছে: ${reason}`);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, [refetchSub]);
  
  const pathname = useLocation({ select: (l) => l.pathname });
  const qc = useQueryClient();
  const rxMode = isRxMode();
  const canUsePos = !rxMode && (allowed === null || allowed.includes("pos"));
  const homePath = isSuperAdmin
    ? "/admin"
    : allowed === null
      ? rxMode
        ? "/rx-dashboard"
        : "/dashboard"
      : sectionHomePath(allowed);
  const isHome = pathname === homePath;

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

  if (!roleLoading && !sectionsLoading && allowed === null && rxMode && !isRxPathAllowed(pathname)) {
    return <Navigate to={homePath as any} replace />;
  }

  // Platform-wide admin pages belong to the super admin only.
  if (!superLoading && !isSuperAdmin && pathname.startsWith("/admin")) {
    return <Navigate to={homePath as any} replace />;
  }

  // HARD LOCK: If subscription bill is overdue, show ONLY the square box lock screen.
  // Nothing behind it (sidebar, header, POS, data) is rendered!
  if (!superLoading && !isSuperAdmin && isLocked && sub) {
    return <SubscriptionLockModal sub={sub} onSignOut={signOut} onRefresh={refetchSub} />;
  }

  // Strictly enforce marked module grants — only `null` means unlimited.
  if (!isSuperAdmin && !roleLoading && !sectionsLoading) {
    if (Array.isArray(allowed) && allowed.length === 0) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
          <div className="max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">No Access Granted</h2>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Your account does not have permission to access any modules. Please contact the platform
                Super Admin to assign modules to your account.
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }
    if (!isPathAllowed(pathname, allowed)) {
      return <Navigate to={homePath as any} replace />;
    }
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
            {!isSuperAdmin && business && (
              <div className="hidden sm:flex items-center gap-2 text-right text-[11px] leading-tight">
                <img
                  src="/favicon.png"
                  alt="QweekPOS"
                  className="h-5 w-5 rounded object-cover opacity-90"
                />
                <span className="font-medium text-foreground">{business.name}</span>
              </div>
            )}
            {isSuperAdmin && (
              <div className="hidden sm:flex items-center gap-2 text-right text-[11px] leading-tight px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
                <span className="font-semibold text-primary">SaaS Super Admin</span>
              </div>
            )}
            {isSuperAdmin && (
              <button
                onClick={() => navigate({ to: "/admin" as any })}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20 shadow-xs cursor-pointer"
                title="Super Admin Master Dashboard"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>Admin Hub</span>
              </button>
            )}
            <BluetoothStatusButton businessName={business?.name || "Sheikh Pharma"} />
            {(canUsePos || isSuperAdmin) && (
              <button
                onClick={() => navigate({ to: "/pos" })}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                title="Open POS"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                POS
              </button>
            )}
            <LogoutConfirm onConfirm={signOut}>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground shadow-sm transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
            </LogoutConfirm>
          </header>
          {isDueWarning && sub && <SubscriptionDueBanner sub={sub} />}
          <main className="flex-1"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
