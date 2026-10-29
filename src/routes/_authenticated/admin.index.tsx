import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Building2,
  Users,
  FileText,
  FlaskConical,
  Wallet,
  CreditCard,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  DatabaseBackup,
  MessageSquare,
  KeyRound,
  Stethoscope,
  Settings,
  ArrowRight,
  AlertTriangle,
  Radio,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  FolderArchive,
  ClipboardList,
  ListChecks,
} from "lucide-react";

import { useCurrentRole } from "@/hooks/use-current-role";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";
import { isRxMode } from "@/lib/rx-mode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  getSuperAdminMasterMetrics,
  type SuperAdminDashboardMetrics,
} from "@/lib/super-admin-dashboard.functions";
import { backupRunNow } from "@/lib/backups.functions";
import {
  approveAccessRequestServer,
  rejectAccessRequestServer,
  approveBusinessRequestServer,
  rejectBusinessRequestServer,
  purgeOrResolvePendingRequestsServer,
} from "@/lib/admin-requests.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Super Admin Master Dashboard — QweekPOS & Rx" },
      {
        name: "description",
        content:
          "Central platform control hub for Super Admins: oversee businesses, doctors, users, prescriptions, bKash & SMS gateways, and cloud backups.",
      },
      { property: "og:title", content: "Super Admin Master Dashboard" },
      {
        property: "og:description",
        content: "Master control hub for multi-tenant businesses, doctors, prescriptions and gateways.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminHubPage,
});

/* -------------------------------------------------------------------------- */
/*                            MODULE DEFINITIONS                              */
/* -------------------------------------------------------------------------- */
const CORE_MODULES = [
  {
    to: "/admin/businesses",
    label: "Businesses & Modules",
    titleBn: "প্রতিষ্ঠান ও মডিউল নিয়ন্ত্রণ",
    desc: "সকল ফার্মেসি, ক্লিনিক ও ডাক্তারের তালিকা। POS, Rx, Lab, HRM, CRM মডিউল অন/অফ করুন।",
    icon: Building2,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    badge: "Tenants",
  },
  {
    to: "/admin/users",
    label: "All Users & Logins",
    titleBn: "সকল ইউজার ও পাসওয়ার্ড নিয়ন্ত্রণ",
    desc: "সিস্টেমের সকল ইউজার অ্যাকাউন্ট, তাৎক্ষণিক পাসওয়ার্ড পরিবর্তন ও অ্যাকাউন্ট ব্যান/আনব্যান।",
    icon: KeyRound,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    badge: "Security",
  },
  {
    to: "/admin/backups",
    label: "Backups & Restore",
    titleBn: "ক্লাউড ব্যাকআপ ও রিস্টোর হাব",
    desc: "দৈনিক স্বয়ংক্রিয় ব্যাকআপ, এক ক্লিকে ইনস্ট্যান্ট ব্যাকআপ তৈরি ও পূর্বাবস্থায় রিস্টোর।",
    icon: DatabaseBackup,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    badge: "Cloud Storage",
  },
  {
    to: "/admin/business-requests",
    label: "Business Requests",
    titleBn: "নতুন ফার্মেসি/ব্যবসার আবেদন",
    desc: "প্ল্যাটফর্মে নতুন কোনো প্রতিষ্ঠান যুক্ত হতে চাইলে তাদের আবেদন পর্যালোচনা ও অনুমোদন।",
    icon: FolderArchive,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
    badge: "Onboarding",
  },
];

const CLINICAL_MODULES = [
  {
    to: "/admin/doctors",
    label: "Doctors & Approvals",
    titleBn: "ডাক্তার অনুমোদন ও প্রোফাইল",
    desc: "নতুন ডাক্তারদের রেজিস্ট্রেশন ভেরিফিকেশন, রোল নির্ধারণ ও চেম্বার শিডিউল অনুমোদন।",
    icon: Stethoscope,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    badge: "Clinical",
  },
  {
    to: "/admin/prescriptions",
    label: "Admin Prescriptions",
    titleBn: "কেন্দ্রীয় প্রেসক্রিপশন অডিট",
    desc: "প্ল্যাটফর্মের সকল ডাক্তারের লেখা প্রতিটি প্রেসক্রিপশনের কেন্দ্রীয় আর্কাইভ ও লাইভ সার্চ।",
    icon: ClipboardList,
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-500/10 border-teal-500/20",
    badge: "Live Rx",
  },
  {
    to: "/rx-options",
    label: "Manage Rx Options",
    titleBn: "গ্লোবাল প্রেসক্রিপশন লাইব্রেরি",
    desc: "চিফ কমপ্লেইন্টস (C/C), ইনভেস্টিগেশন টেস্ট লিস্ট, ডোজ ফ্রিকোয়েন্সি ও পরামর্শের সেন্ট্রাল ডাটা।",
    icon: ListChecks,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    badge: "Master Data",
  },
];

const BILLING_MODULES = [
  {
    to: "/admin/bkash",
    label: "bKash Payment Gateway",
    titleBn: "বিকাশ পেমেন্ট গেটওয়ে",
    desc: "বিকাশ টোকেনাইজড পেমেন্ট ক্রেডেনশিয়াল (App Key, Secret, Merchant) ও ক্রেডিট রেট সেটআপ।",
    icon: Wallet,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20",
    badge: "Gateway",
  },
  {
    to: "/admin/credit-purchases",
    label: "Credit Purchases Ledger",
    titleBn: "ক্রেডিট বিক্রয় ও আয় অডিট",
    desc: "বিকাশ ও ম্যানুয়াল মাধ্যমে কে কত ক্রেডিট রিচার্জ করেছে তার সম্পূর্ণ অডিট হিসেব।",
    icon: CreditCard,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    badge: "Revenue",
  },
  {
    to: "/admin/rx-credit-links",
    label: "Credit Purchase Links",
    titleBn: "পেমেন্ট ও টপ-আপ লিঙ্ক",
    desc: "ক্লিনিক ও ডাক্তারদের রিচার্জ করার জন্য ওয়ান-ক্লিক পেমেন্ট লিঙ্ক তৈরি ও ম্যানুয়াল অ্যাপ্রুভাল।",
    icon: Sparkles,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    badge: "Top-up",
  },
  {
    to: "/admin/sms",
    label: "SMS Gateway Settings",
    titleBn: "এসএমএস গেটওয়ে সেটিংস",
    desc: "সেন্ট্রাল বাল্ক এসএমএস গেটওয়ে API Key, Secret Key ও ব্র্যান্ডের নামে কলার আইডি কনফিগারেশন।",
    icon: MessageSquare,
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
    badge: "Notifications",
  },
];

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */
function AdminHubPage() {
  const { isAdmin, isLoading: roleLoading } = useCurrentRole();
  const { isSuperAdmin, isLoading: superLoading } = useIsSuperAdmin();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const fetchMetrics = useServerFn(getSuperAdminMasterMetrics);
  const runBackup = useServerFn(backupRunNow);

  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Current session user email
  const userQuery = useQuery({
    queryKey: ["current-user-email"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  // Fetch Live Super Admin Metrics
  const metricsQ = useQuery({
    queryKey: ["super-admin-master-metrics"],
    enabled: !!isSuperAdmin,
    queryFn: () => fetchMetrics({ data: undefined as never }),
    staleTime: 60_000,
    refetchInterval: 120000, // 2 min auto-refresh (30s was too heavy for the main thread)
  });

  // Manual Backup Mutation
  const backupMutation = useMutation({
    mutationFn: () => runBackup({ data: {} }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["super-admin-master-metrics"] });
      toast.success(res?.message || "🎉 ক্লাউড ব্যাকআপ সফলভাবে সম্পন্ন হয়েছে!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "ব্যাকআপ নিতে ব্যর্থ হয়েছে।");
    },
  });

  // Direct Quick Approvals from Dashboard
  const approveDoctorFn = useServerFn(approveAccessRequestServer);
  const rejectDoctorFn = useServerFn(rejectAccessRequestServer);
  const approveBizFn = useServerFn(approveBusinessRequestServer);
  const rejectBizFn = useServerFn(rejectBusinessRequestServer);
  const purgeRequestsFn = useServerFn(purgeOrResolvePendingRequestsServer);

  const approveDoctorMut = useMutation({
    mutationFn: (id: string) => approveDoctorFn({ data: { id, role: "Doctor" } }),
    onSuccess: () => {
      toast.success("ডাক্তার আবেদন অনুমোদিত হয়েছে!");
      qc.invalidateQueries({ queryKey: ["super-admin-master-metrics"] });
    },
    onError: (err: any) => toast.error(err?.message || "অনুমোদন ব্যর্থ"),
  });

  const rejectDoctorMut = useMutation({
    mutationFn: (id: string) => rejectDoctorFn({ data: { id } }),
    onSuccess: () => {
      toast.success("ডাক্তার আবেদন বাতিল করা হয়েছে");
      qc.invalidateQueries({ queryKey: ["super-admin-master-metrics"] });
    },
    onError: (err: any) => toast.error(err?.message || "বাতিল ব্যর্থ"),
  });

  const approveBizMut = useMutation({
    mutationFn: (id: string) => approveBizFn({ data: { id } }),
    onSuccess: () => {
      toast.success("ব্যবসা আবেদন অনুমোদিত ও প্রতিষ্ঠান তৈরি হয়েছে!");
      qc.invalidateQueries({ queryKey: ["super-admin-master-metrics"] });
    },
    onError: (err: any) => toast.error(err?.message || "অনুমোদন ব্যর্থ"),
  });

  const rejectBizMut = useMutation({
    mutationFn: (id: string) => rejectBizFn({ data: { id } }),
    onSuccess: () => {
      toast.success("ব্যবসা আবেদন বাতিল করা হয়েছে");
      qc.invalidateQueries({ queryKey: ["super-admin-master-metrics"] });
    },
    onError: (err: any) => toast.error(err?.message || "বাতিল ব্যর্থ"),
  });

  const autoResolveMut = useMutation({
    mutationFn: (action: "approve_all" | "reject_all") => purgeRequestsFn({ data: { action } }),
    onSuccess: (_, action) => {
      toast.success(
        action === "approve_all"
          ? "সকল অপেক্ষমান আবেদন অনুমোদিত হয়েছে!"
          : "সকল আবেদন খারিজ/ক্লিন করা হয়েছে!",
      );
      qc.invalidateQueries({ queryKey: ["super-admin-master-metrics"] });
    },
    onError: (err: any) => toast.error(err?.message || "ব্যর্থ"),
  });

  if (roleLoading || superLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Activity className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">
          সুপার অ্যাডমিন কমান্ড সেন্টার লোড হচ্ছে...
        </p>
      </div>
    );
  }

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          <AlertTriangle className="mx-auto h-10 w-10 mb-2 opacity-80" />
          <h2 className="text-lg font-bold">অননুমোদিত প্রবেশ</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            এই পৃষ্ঠাটি শুধুমাত্র প্ল্যাটফর্ম সুপার অ্যাডমিনের জন্য সংরক্ষিত।
          </p>
          <Button
            variant="outline"
            className="mt-4 cursor-pointer"
            onClick={() => navigate({ to: "/dashboard" as any })}
          >
            ড্যাশবোর্ডে ফিরে যান
          </Button>
        </div>
      </div>
    );
  }

  const m: SuperAdminDashboardMetrics | undefined = metricsQ.data;
  const userEmail = userQuery.data?.email || "Super Admin";

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
      {/* ================= HERO HEADER ================= */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-teal-500/10 p-5 sm:p-7 shadow-xl backdrop-blur-md">
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 h-56 w-56 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-primary text-primary-foreground font-bold text-xs gap-1 py-1 shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Super Admin Master Hub</span>
              </Badge>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs font-semibold gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>সিস্টেম সচল (Active)</span>
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              সুপার অ্যাডমিন মাস্টার ড্যাশবোর্ড
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium max-w-2xl">
              প্ল্যাটফর্মের সকল ফার্মেসি, ক্লিনিক, ডাক্তার, প্রেসক্রিপশন, পেমেন্ট গেটওয়ে এবং অটোমেটিক ক্লাউড ব্যাকআপের সেন্ট্রাল কমান্ড সেন্টার।
            </p>

            <div className="pt-1 flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span>👤 অ্যাকাউন্ট:</span>
              <span className="font-bold text-foreground bg-muted px-2 py-0.5 rounded-md border border-border/60">
                {userEmail}
              </span>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => metricsQ.refetch()}
              disabled={metricsQ.isFetching}
              className="rounded-xl h-10 px-3.5 font-bold gap-1.5 cursor-pointer bg-card/80 border-border/80 hover:bg-muted shadow-sm"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw className={`h-4 w-4 ${metricsQ.isFetching ? "animate-spin text-primary" : ""}`} />
              <span className="hidden sm:inline">রিফ্রেশ</span>
            </Button>

            <Button
              size="sm"
              onClick={() => backupMutation.mutate()}
              disabled={backupMutation.isPending}
              className="rounded-xl h-10 px-4 font-bold gap-2 cursor-pointer shadow-md shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <DatabaseBackup className={`h-4 w-4 ${backupMutation.isPending ? "animate-spin" : ""}`} />
              <span>{backupMutation.isPending ? "ব্যাকআপ নেওয়া হচ্ছে..." : "ইনস্ট্যান্ট ক্লাউড ব্যাকআপ"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ================= PENDING APPROVALS HUB ================= */}
      {m && (
        m.pendingDoctorRequests > 0 || m.pendingBusinessRequests > 0 ? (
          <div className="rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-amber-950 font-bold shadow-xs">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-amber-950 dark:text-amber-100 flex items-center gap-2">
                    <span>জরুরি অনুমোদন অপেক্ষমান রয়েছে!</span>
                    <Badge className="bg-amber-600 text-white font-mono text-xs">
                      {m.pendingDoctorRequests + m.pendingBusinessRequests} Pending
                    </Badge>
                  </h3>
                  <p className="text-xs text-amber-900/90 dark:text-amber-200/90 mt-0.5">
                    বর্তমানে {m.pendingDoctorRequests} জন নতুন ডাক্তার এবং {m.pendingBusinessRequests}টি নতুন ব্যবসা অনুমোদনের অপেক্ষায় আছে। নিচে সরাসরি অনুমোদন বা বাতিল করুন:
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => autoResolveMut.mutate("approve_all")}
                  disabled={autoResolveMut.isPending}
                  className="h-8.5 rounded-xl border-amber-600/40 bg-amber-600/10 text-amber-900 dark:text-amber-200 hover:bg-amber-600/20 text-xs font-bold cursor-pointer"
                >
                  সবগুলো এক ক্লিকে অনুমোদন
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => autoResolveMut.mutate("reject_all")}
                  disabled={autoResolveMut.isPending}
                  className="h-8.5 rounded-xl text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 text-xs cursor-pointer"
                  title="Clear / Dismiss test pending requests"
                >
                  ক্লিন / ডিসমিস
                </Button>
              </div>
            </div>

            {/* Direct Doctor Requests List */}
            {m.pendingDoctorsItems && m.pendingDoctorsItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5" /> ডাক্তার / স্টাফ আবেদন ({m.pendingDoctorsItems.length})
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {m.pendingDoctorsItems.map((doc) => (
                    <div key={doc.id} className="rounded-xl border border-amber-500/30 bg-card p-3 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-foreground truncate">{doc.full_name || doc.email}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{doc.email} · {doc.requested_role}</div>
                        {doc.qualification && <div className="text-[10px] text-muted-foreground truncate">{doc.qualification}</div>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => approveDoctorMut.mutate(doc.id)}
                          disabled={approveDoctorMut.isPending}
                          className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> অনুমোদন
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => rejectDoctorMut.mutate(doc.id)}
                          disabled={rejectDoctorMut.isPending}
                          className="h-7 px-2 rounded-lg text-destructive hover:bg-destructive/10 text-[11px] cursor-pointer"
                        >
                          বাতিল
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Business Requests List */}
            {m.pendingBusinessItems && m.pendingBusinessItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> নতুন ফার্মেসি / ব্যবসা আবেদন ({m.pendingBusinessItems.length})
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {m.pendingBusinessItems.map((biz) => (
                    <div key={biz.id} className="rounded-xl border border-amber-500/30 bg-card p-3 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-foreground truncate">{biz.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">Location: {biz.location_name}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => approveBizMut.mutate(biz.id)}
                          disabled={approveBizMut.isPending}
                          className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> অনুমোদন
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => rejectBizMut.mutate(biz.id)}
                          disabled={rejectBizMut.isPending}
                          className="h-7 px-2 rounded-lg text-destructive hover:bg-destructive/10 text-[11px] cursor-pointer"
                        >
                          বাতিল
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <span className="text-xs font-semibold text-foreground">
                  অনুমোদন স্থিতি: সব আবেদন হালনাগাদ (০ অপেক্ষমান)
                </span>
                <p className="text-[11px] text-muted-foreground">
                  নতুন কোনো ডাক্তার বা ফার্মেসি অ্যাকাউন্ট অনুমোদনের অপেক্ষায় নেই।
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="ghost" className="h-7 text-xs rounded-lg px-2.5 hover:bg-emerald-500/10">
                <Link to="/admin/doctors">ডাক্তার তালিকা ও আবেদন</Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="h-7 text-xs rounded-lg px-2.5 hover:bg-emerald-500/10">
                <Link to="/admin/business-requests">ব্যবসা আবেদন তালিকা</Link>
              </Button>
            </div>
          </div>
        )
      )}

      {/* ================= 6 EXECUTIVE KPI CARDS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* 1. মোট প্রতিষ্ঠান */}
        <Link to="/admin/businesses" className="group">
          <Card className="h-full border-border/80 bg-card/85 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md hover:border-primary/40 group-hover:-translate-y-0.5">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Businesses
                </span>
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">
                  {m ? m.businessesCount : "..."}
                </div>
                <div className="text-xs font-semibold text-foreground/80 mt-0.5">
                  মোট প্রতিষ্ঠান
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 truncate">
                  {m ? `POS: ${m.businessesByType.pos} · Clinic: ${m.businessesByType.clinic + m.businessesByType.doctor}` : "লোড হচ্ছে..."}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 2. প্ল্যাটফর্ম ইউজার */}
        <Link to="/admin/users" className="group">
          <Card className="h-full border-border/80 bg-card/85 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md hover:border-primary/40 group-hover:-translate-y-0.5">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Users className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Users
                </span>
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">
                  {m ? m.usersCount : "..."}
                </div>
                <div className="text-xs font-semibold text-foreground/80 mt-0.5">
                  সকল ইউজার
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 truncate">
                  ডাক্তার, অ্যাডমিন ও স্টাফ
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 3. মোট প্রেসক্রিপশন */}
        <Link to="/admin/prescriptions" className="group">
          <Card className="h-full border-border/80 bg-card/85 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md hover:border-primary/40 group-hover:-translate-y-0.5">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <FileText className="h-4 w-4" />
                </span>
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                  Rx
                </Badge>
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">
                  {m ? m.prescriptionsCount.toLocaleString() : "..."}
                </div>
                <div className="text-xs font-semibold text-foreground/80 mt-0.5">
                  ডিজিটাল প্রেসক্রিপশন
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 truncate">
                  {m ? `আজকে লেখা: +${m.prescriptionsTodayCount}` : "..."}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 4. মোট ল্যাব রিপোর্ট */}
        <Link to="/lab-reports/history" className="group">
          <Card className="h-full border-border/80 bg-card/85 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md hover:border-primary/40 group-hover:-translate-y-0.5">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <FlaskConical className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Lab
                </span>
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">
                  {m ? m.labReportsCount.toLocaleString() : "..."}
                </div>
                <div className="text-xs font-semibold text-foreground/80 mt-0.5">
                  ডায়াগনস্টিক রিপোর্ট
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 truncate">
                  ২,৬৬৮+ টেস্টের রেজাল্ট
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 5. ক্রেডিট রেভিনিউ */}
        <Link to="/admin/credit-purchases" className="group">
          <Card className="h-full border-border/80 bg-card/85 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md hover:border-primary/40 group-hover:-translate-y-0.5">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Wallet className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                  Revenue
                </span>
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">
                  {m ? `৳${m.totalRevenueBDT.toLocaleString()}` : "..."}
                </div>
                <div className="text-xs font-semibold text-foreground/80 mt-0.5">
                  ক্রেডিট আয়
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 truncate">
                  বিক্রিত: {m ? m.totalCreditsSold.toLocaleString() : "..."} ক্রেডিট
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* 6. ব্যাকআপ স্ট্যাটাস */}
        <Link to="/admin/backups" className="group">
          <Card className="h-full border-border/80 bg-card/85 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md hover:border-primary/40 group-hover:-translate-y-0.5">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <DatabaseBackup className="h-4 w-4" />
                </span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-emerald-500/30 text-emerald-600">
                  Active
                </Badge>
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">
                  {m ? m.backupInfo.totalBackups : "..."}
                </div>
                <div className="text-xs font-semibold text-foreground/80 mt-0.5">
                  ক্লাউড ব্যাকআপ
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 truncate">
                  {m?.backupInfo.lastBackupTime
                    ? `শেষ: ${new Date(m.backupInfo.lastBackupTime).toLocaleDateString("en-GB")}`
                    : "দৈনিক রাত ১১:৫৮"}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ================= 3 GATEWAY & INFRASTRUCTURE HEALTH CARDS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* bKash Payment Gateway */}
        <div className="rounded-2xl border border-pink-500/25 bg-gradient-to-br from-pink-500/10 via-card to-card p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/20 text-pink-600">
                <Wallet className="h-4 w-4" />
              </span>
              <div>
                <h4 className="font-bold text-sm text-foreground">bKash Payment Gateway</h4>
                <p className="text-[11px] text-muted-foreground">টোকেনাইজড পেমেন্ট ও ক্রেডিট রিচার্জ</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`text-xs font-bold ${
                m?.bkashConfig.enabled
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {m?.bkashConfig.enabled ? "সক্রিয় (Active)" : "নিষ্ক্রিয়"}
            </Badge>
          </div>

          <div className="rounded-xl bg-muted/40 p-2.5 text-xs space-y-1 font-medium">
            <div className="flex justify-between">
              <span className="text-muted-foreground">পরিবেশ (Mode):</span>
              <span className="font-mono font-bold uppercase">{m?.bkashConfig.environment || "Live"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ক্রেডিট রেট:</span>
              <span className="font-bold text-foreground">৳{m?.bkashConfig.ratePerCredit} / প্রেসক্রিপশন</span>
            </div>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full h-8 rounded-xl font-bold text-xs gap-1.5 border-pink-500/30 text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/20 cursor-pointer"
          >
            <Link to="/admin/bkash">
              <span>বিকাশ গেটওয়ে কনফিগার করুন</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* SMS Gateway */}
        <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 via-card to-card p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-600">
                <MessageSquare className="h-4 w-4" />
              </span>
              <div>
                <h4 className="font-bold text-sm text-foreground">SMS Gateway</h4>
                <p className="text-[11px] text-muted-foreground">টোকেন, ওটিপি ও নোটিফিকেশন</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`text-xs font-bold ${
                m?.smsConfig.enabled
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {m?.smsConfig.enabled ? "সক্রিয় (Active)" : "নিষ্ক্রিয়"}
            </Badge>
          </div>

          <div className="rounded-xl bg-muted/40 p-2.5 text-xs space-y-1 font-medium">
            <div className="flex justify-between">
              <span className="text-muted-foreground">কলার / সেন্ডার আইডি:</span>
              <span className="font-mono font-bold text-foreground truncate max-w-[150px]">{m?.smsConfig.callerId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">গেটওয়ে প্রভাইডার:</span>
              <span className="font-bold text-muted-foreground">ReveSMS / REST API</span>
            </div>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full h-8 rounded-xl font-bold text-xs gap-1.5 border-sky-500/30 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/20 cursor-pointer"
          >
            <Link to="/admin/sms">
              <span>এসএমএস গেটওয়ে কনফিগার করুন</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Cloud Backups */}
        <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600">
                <DatabaseBackup className="h-4 w-4" />
              </span>
              <div>
                <h4 className="font-bold text-sm text-foreground">Nightly Cloud Backups</h4>
                <p className="text-[11px] text-muted-foreground">স্বয়ংক্রিয় ক্লাউড আর্কাইভ ও রিস্টোর</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              Auto Active
            </Badge>
          </div>

          <div className="rounded-xl bg-muted/40 p-2.5 text-xs space-y-1 font-medium">
            <div className="flex justify-between">
              <span className="text-muted-foreground">শিডিউল রুটিন:</span>
              <span className="font-bold text-foreground">প্রতিদিন রাত ১১:৫৮ মিনিটে</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">রিটেনশন মেয়াদ:</span>
              <span className="font-bold text-foreground">৩০ দিন সংরক্ষিত থাকে</span>
            </div>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full h-8 rounded-xl font-bold text-xs gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer"
          >
            <Link to="/admin/backups">
              <span>ব্যাকআপ ও রিস্টোর সেন্টারে যান</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* ================= FAST USER FINDER & PASSWORD QUICK JUMP ================= */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card/80 shadow-sm backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <KeyRound className="h-4 w-4 text-primary" />
            <span>ইউজার অনুসন্ধান ও দ্রুত পাসওয়ার্ড পরিবর্তন (Fast User Lookup)</span>
          </h4>
          <p className="text-xs text-muted-foreground">
            যেকোনো ডাক্তার, ফার্মাসিস্ট বা কর্মীর ইমেইল বা ইউজারনেম লিখে সরাসরি খুঁজুন।
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (userSearchQuery.trim()) {
              navigate({ to: "/admin/users" as any });
            }
          }}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="ইমেইল বা ইউজারনেম..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="h-9 pl-8 text-xs rounded-xl"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="h-9 rounded-xl font-bold text-xs cursor-pointer px-3 shrink-0"
          >
            <span>খুঁজুন</span>
          </Button>
        </form>
      </div>

      {/* ================= MASTER SUPER ADMIN MODULES SECTION ================= */}
      <div className="space-y-6 pt-2">
        {/* CATEGORY 1: প্ল্যাটফর্ম ও ইউজার সিকিউরিটি */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Building2 className="h-3.5 w-3.5" />
            </span>
            <h3 className="font-extrabold text-sm sm:text-base text-foreground">
              প্ল্যাটফর্ম টেন্যান্ট ও ইউজার সিকিউরিটি
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {CORE_MODULES.map((mod) => (
              <Link
                key={mod.to}
                to={mod.to as any}
                className="group flex flex-col justify-between p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted/30 hover:border-primary/40 transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`p-2.5 rounded-xl ${mod.bg} ${mod.color}`}>
                      <mod.icon className="h-5 w-5" />
                    </span>
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {mod.badge}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                      {mod.titleBn}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                  <span>মডিউল খুলুন</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* CATEGORY 2: ক্লিনিক্যাল ও প্রেসক্রিপশন তদারকি */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600">
              <Stethoscope className="h-3.5 w-3.5" />
            </span>
            <h3 className="font-extrabold text-sm sm:text-base text-foreground">
              ডাক্তার, আরএক্স ও ক্লিনিক্যাল তদারকি
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {CLINICAL_MODULES.map((mod) => (
              <Link
                key={mod.to}
                to={mod.to as any}
                className="group flex flex-col justify-between p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted/30 hover:border-primary/40 transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`p-2.5 rounded-xl ${mod.bg} ${mod.color}`}>
                      <mod.icon className="h-5 w-5" />
                    </span>
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {mod.badge}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                      {mod.titleBn}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                  <span>মডিউল খুলুন</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* CATEGORY 3: পেমেন্ট, গেটওয়ে ও মনিটাইজেশন */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CreditCard className="h-3.5 w-3.5" />
            </span>
            <h3 className="font-extrabold text-sm sm:text-base text-foreground">
              পেমেন্ট গেটওয়ে, ক্রেডিট ও মনিটাইজেশন
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {BILLING_MODULES.map((mod) => (
              <Link
                key={mod.to}
                to={mod.to as any}
                className="group flex flex-col justify-between p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted/30 hover:border-primary/40 transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`p-2.5 rounded-xl ${mod.bg} ${mod.color}`}>
                      <mod.icon className="h-5 w-5" />
                    </span>
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {mod.badge}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                      {mod.titleBn}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                  <span>মডিউল খুলুন</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
