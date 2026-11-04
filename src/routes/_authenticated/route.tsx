import { createFileRoute, Outlet, redirect, useLocation, Navigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { useAllowedSections, isPathAllowed, sectionHomePath } from "@/hooks/use-allowed-sections";
import { isRxMode, isRxPathAllowed, isPatientHost } from "@/lib/rx-mode";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";

import { LogOut, ArrowLeft, ShoppingCart, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
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
  errorComponent: AuthedErrorComponent,
});

function AuthedLayout() {
  const { data: business } = useCurrentBusiness();
  const { isLoading: roleLoading } = useCurrentRole();
  const { sections: allowed, isLoading: sectionsLoading } = useAllowedSections();
  const { isSuperAdmin, isLoading: superLoading } = useIsSuperAdmin();
  const {
    sub,
    isLocked,
    isDueWarning,
    isLoading: subLoading,
    refetch: refetchSub,
  } = usePlatformSubscription();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
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
    try {
      await qc.cancelQueries();
      qc.clear();
    } catch {}
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      if (typeof window !== "undefined") {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("sb-") || key.includes("supabase.auth.token"))) {
            localStorage.removeItem(key);
          }
        }
        sessionStorage.clear();
      }
    } catch {}

    // Hard redirect: guarantees fresh JS bundle, purges old heap memory & open WebSockets
    if (typeof window !== "undefined") {
      window.location.replace("/auth?logged_out=1");
    } else {
      navigate({ to: "/auth", replace: true });
    }
  }

  function goBack() {
    const clean = pathname.replace(/\/+$/, "");
    const parent = clean.substring(0, clean.lastIndexOf("/")) || homePath;
    const target = parent === "/" ? homePath : parent;
    navigate({ to: target as any });
  }

  // 1. Wait for auth & permissions to load before making ANY redirect decisions!
  // This completely prevents premature redirects with half-baked permission states.
  if (superLoading || roleLoading || sectionsLoading || (!isSuperAdmin && subLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs text-muted-foreground font-medium">লোড হচ্ছে…</span>
        </div>
      </div>
    );
  }

  // 2. HARD LOCK: If subscription bill is overdue, show ONLY the square box lock screen.
  // Super Admins are exempt.
  if (!isSuperAdmin && isLocked && sub) {
    return <SubscriptionLockModal sub={sub} onSignOut={signOut} onRefresh={refetchSub} />;
  }

  // 3. Super Admins have full access to everything. Non-superadmins must pass permission checks.
  if (!isSuperAdmin) {
    // 3a. Platform-wide admin pages belong to the super admin only.
    if (pathname.startsWith("/admin")) {
      const safeHome = homePath && !homePath.startsWith("/admin") && isPathAllowed(homePath, allowed) ? homePath : null;
      if (safeHome && safeHome !== pathname) {
        return <Navigate to={safeHome as any} replace />;
      }
      return (
        <AccessRestrictedView
          pathname={pathname}
          homePath={safeHome}
          canGoHome={!!safeHome}
          onGoHome={() => safeHome && navigate({ to: safeHome as any })}
          onSignOut={signOut}
        />
      );
    }

    // 3b. Strictly enforce marked module grants — empty array means 0 modules granted.
    if (Array.isArray(allowed) && allowed.length === 0) {
      return <NoAccessView onSignOut={signOut} />;
    }

    // 3c. Module access control — never redirect to self or to an unallowed path!
    if (!isPathAllowed(pathname, allowed)) {
      const safeHome = homePath && isPathAllowed(homePath, allowed) ? homePath : null;
      if (safeHome && safeHome !== pathname) {
        return <Navigate to={safeHome as any} replace />;
      }
      return (
        <AccessRestrictedView
          pathname={pathname}
          homePath={safeHome}
          canGoHome={!!safeHome}
          onGoHome={() => safeHome && navigate({ to: safeHome as any })}
          onSignOut={signOut}
        />
      );
    }

    // 3d. Rx mode path restrictions (when allowed is null / legacy unconfigured)
    if (allowed === null && rxMode && !isRxPathAllowed(pathname)) {
      const safeHome = homePath && isRxPathAllowed(homePath) ? homePath : "/rx-dashboard";
      if (safeHome !== pathname && isRxPathAllowed(safeHome)) {
        return <Navigate to={safeHome as any} replace />;
      }
      return (
        <AccessRestrictedView
          pathname={pathname}
          homePath={safeHome}
          canGoHome={true}
          onGoHome={() => navigate({ to: safeHome as any })}
          onSignOut={signOut}
        />
      );
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

function NoAccessView({ onSignOut }: { onSignOut: () => void }) {
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
            onClick={onSignOut}
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

function AccessRestrictedView({
  pathname,
  homePath,
  canGoHome,
  onGoHome,
  onSignOut,
}: {
  pathname: string;
  homePath?: string | null;
  canGoHome: boolean;
  onGoHome: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">পেজ অ্যাক্সেস সীমিত</h2>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            আপনার অ্যাকাউন্টে এই পেজটিতে (<code className="font-mono text-primary font-semibold">{pathname}</code>) প্রবেশ করার অনুমতি নেই।
          </p>
        </div>
        <div className="flex justify-center gap-3 pt-2">
          {canGoHome && (
            <button
              onClick={onGoHome}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              মূল পাতায় যান
            </button>
          )}
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            লগআউট
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthedErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">পেজ লোড হতে সমস্যা হয়েছে</h2>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            সিস্টেমে সাময়িক সমস্যা দেখা দিয়েছে। অনুগ্রহ করে রিফ্রেশ করুন।
          </p>
        </div>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
          >
            রিফ্রেশ করুন
          </button>
          <button
            onClick={() => navigate({ to: "/dashboard" as any })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm cursor-pointer"
          >
            ড্যাশবোর্ডে ফিরুন
          </button>
        </div>
      </div>
    </div>
  );
}
