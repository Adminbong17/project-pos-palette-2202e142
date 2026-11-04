import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CreditCard,
  Building2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Gift,
  Calendar,
  Save,
  Clock,
  Sparkles,
  Smartphone,
  RefreshCw,
  ExternalLink,
  CalendarDays,
  Pencil,
  Eye,
  Unlock,
  ShieldAlert,
} from "lucide-react";

import { useIsSuperAdmin } from "@/hooks/use-super-admin";
import {
  listAllSubscriptions,
  updateSubscriptionPrice,
  updateSubscriptionDueDay,
  setSubscriptionMode,
  markSubscriptionBillPaid,
  extendSubscriptionGrace,
  lockSubscriptionNow,
  unlockSubscriptionNow,
  updateClientFullProfile,
  type BusinessSubscriptionRow,
  type CurrentSubscriptionStatus,
} from "@/lib/subscriptions.functions";
import { SubscriptionLockModal } from "@/components/SubscriptionLockModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/rx-billing")({
  head: () => ({
    meta: [
      { title: "Subscription & Billing Master — SaaS Super Admin" },
      {
        name: "description",
        content:
          "Manage monthly subscription prices, custom due dates per client, automatic lock, 1-click Free, and bKash tracking.",
      },
    ],
  }),
  component: AdminSubscriptionsMasterPage,
});

const ALL_DUE_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function AdminSubscriptionsMasterPage() {
  const { isSuperAdmin, isLoading: superLoading } = useIsSuperAdmin();
  const qc = useQueryClient();

  const loadSubscriptions = useServerFn(listAllSubscriptions);
  const savePrice = useServerFn(updateSubscriptionPrice);
  const saveDueDay = useServerFn(updateSubscriptionDueDay);
  const saveMode = useServerFn(setSubscriptionMode);
  const markPaid = useServerFn(markSubscriptionBillPaid);
  const extendGrace = useServerFn(extendSubscriptionGrace);
  const lockNow = useServerFn(lockSubscriptionNow);
  const unlockNow = useServerFn(unlockSubscriptionNow);
  const saveFullProfile = useServerFn(updateClientFullProfile);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "due" | "locked" | "free">("all");
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});
  const [previewSub, setPreviewSub] = useState<CurrentSubscriptionStatus | null>(null);

  const [editingClient, setEditingClient] = useState<BusinessSubscriptionRow | null>(null);
  const [formData, setFormData] = useState({
    business_name: "",
    biz_kind: "pos" as "pos" | "doctor" | "clinic",
    owner_name: "",
    owner_email: "",
    monthly_amount: 800,
    due_day: 7,
    current_due_date: "",
    helpline: "01712472839",
    mode: "subscription" as "subscription" | "free",
  });

  const profileMutation = useMutation({
    mutationFn: async (payload: {
      business_id: string;
      business_name?: string;
      biz_kind?: "pos" | "doctor" | "clinic";
      owner_name?: string;
      owner_email?: string;
      monthly_amount?: number;
      due_day?: number;
      current_due_date?: string;
      helpline?: string;
      mode?: "subscription" | "free";
    }) => {
      return await saveFullProfile({ data: payload });
    },
    onSuccess: () => {
      toast.success("ক্লায়েন্ট ও বিলিং তথ্য সফলভাবে আপডেট করা হয়েছে");
      setEditingClient(null);
      qc.invalidateQueries({ queryKey: ["admin-all-subscriptions"] });
    },
    onError: (e: any) => toast.error(e?.message || "তথ্য আপডেট করা সম্ভব হয়নি"),
  });

  function openEdit(s: BusinessSubscriptionRow) {
    setEditingClient(s);
    setFormData({
      business_name: s.business_name || "",
      biz_kind: (s.clinic_mode ? "clinic" : s.biz_kind === "doctor" ? "doctor" : "pos") as any,
      owner_name: s.owner_name || "",
      owner_email: s.owner_email || "",
      monthly_amount: s.monthly_amount ?? 800,
      due_day: s.due_day ?? 7,
      current_due_date: s.current_bill?.due_date || "",
      helpline: s.helpline || "01712472839",
      mode: s.mode || "subscription",
    });
  }

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-all-subscriptions"],
    enabled: isSuperAdmin,
    queryFn: async () => await loadSubscriptions({ data: undefined as never }),
    staleTime: 30_000,
  });

  // Price change mutation
  const priceMutation = useMutation({
    mutationFn: async ({ businessId, amount }: { businessId: string; amount: number }) => {
      return await savePrice({ data: { business_id: businessId, monthly_amount: amount } });
    },
    onSuccess: () => {
      toast.success("মাসিক সাবস্ক্রিপশন ফি আপডেট করা হয়েছে");
      qc.invalidateQueries({ queryKey: ["admin-all-subscriptions"] });
    },
    onError: (e: any) => toast.error(e?.message || "ফি পরিবর্তন করা সম্ভব হয়নি"),
  });

  // Recurring Due Day mutation
  const dueDayMutation = useMutation({
    mutationFn: async ({ businessId, dueDay }: { businessId: string; dueDay: number }) => {
      return await saveDueDay({ data: { business_id: businessId, due_day: dueDay } });
    },
    onSuccess: (res) => {
      toast.success(`বিল পরিশোধের নির্ধারিত মাসিক দিন পরিবর্তন হয়েছে (${res.due_day} তারিখ)`);
      qc.invalidateQueries({ queryKey: ["admin-all-subscriptions"] });
    },
    onError: (e: any) => toast.error(e?.message || "দিন পরিবর্তন ব্যর্থ হয়েছে"),
  });

  // Free / Subscription toggle mutation
  const modeMutation = useMutation({
    mutationFn: async ({ businessId, mode }: { businessId: string; mode: "subscription" | "free" }) => {
      return await saveMode({ data: { business_id: businessId, mode } });
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.mode === "free"
          ? "এই ব্যবসাকে ফ্রি/লাইফটাইম করা হয়েছে (সিস্টেম কখনো লক হবে না)"
          : "পেইড সাবস্ক্রিপশনে রূপান্তর করা হয়েছে"
      );
      qc.invalidateQueries({ queryKey: ["admin-all-subscriptions"] });
    },
    onError: (e: any) => toast.error(e?.message || "মুড পরিবর্তন ব্যর্থ হয়েছে"),
  });

  // Mark bill paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (billId: string) => {
      return await markPaid({ data: { bill_id: billId } });
    },
    onSuccess: () => {
      toast.success("পেমেন্ট সফলভাবে এন্ট্রি হয়েছে! সিস্টেম আনলক করা হয়েছে।");
      qc.invalidateQueries({ queryKey: ["admin-all-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["my-platform-subscription"] });
    },
    onError: (e: any) => toast.error(e?.message || "পেমেন্ট এন্ট্রি ব্যর্থ হয়েছে"),
  });

  // Grace extension mutation
  const graceMutation = useMutation({
    mutationFn: async (billId: string) => {
      return await extendGrace({ data: { bill_id: billId, extraDays: 3 } });
    },
    onSuccess: (res) => {
      toast.success(`৩ দিন সময় বৃদ্ধি করা হয়েছে (নতুন শেষ তারিখ: ${res.new_due_date})`);
      qc.invalidateQueries({ queryKey: ["admin-all-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["my-platform-subscription"] });
    },
    onError: (e: any) => toast.error(e?.message || "সময় বাড়ানো যায়নি"),
  });

  // Instant Lock mutation
  const lockMutation = useMutation({
    mutationFn: async ({ businessId, billId }: { businessId: string; billId?: string }) => {
      return await lockNow({ data: { business_id: businessId, bill_id: billId } });
    },
    onSuccess: () => {
      toast.success("সিস্টেম অবিলম্বে স্থগিত / লক করা হয়েছে! ক্লায়েন্ট এখন শুধুমাত্র বকেয়া বিলের মেসেজ কার্ড দেখতে পাবে।");
      qc.invalidateQueries({ queryKey: ["admin-all-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["my-platform-subscription"] });
    },
    onError: (e: any) => toast.error(e?.message || "লক করা সম্ভব হয়নি"),
  });

  // Instant Unlock mutation
  const unlockMutation = useMutation({
    mutationFn: async ({ businessId, billId }: { businessId: string; billId?: string }) => {
      return await unlockNow({ data: { business_id: businessId, bill_id: billId } });
    },
    onSuccess: (res) => {
      toast.success(`সিস্টেম আনলক করা হয়েছে! (নতুন সময়সীমা: ${res.new_due_date})`);
      qc.invalidateQueries({ queryKey: ["admin-all-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["my-platform-subscription"] });
    },
    onError: (e: any) => toast.error(e?.message || "আনলক করা সম্ভব হয়নি"),
  });

  const allSubs = data?.subscriptions ?? [];

  // Filtered subscriptions
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSubs.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.business_name.toLowerCase().includes(q) ||
        (s.owner_name && s.owner_name.toLowerCase().includes(q)) ||
        (s.owner_email && s.owner_email.toLowerCase().includes(q))
      );
    });
  }, [allSubs, search, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    let total = allSubs.length;
    let paid = 0;
    let due = 0;
    let locked = 0;
    let free = 0;
    for (const s of allSubs) {
      if (s.status === "paid") paid++;
      else if (s.status === "due") due++;
      else if (s.status === "locked") locked++;
      else if (s.status === "free") free++;
    }
    return { total, paid, due, locked, free };
  }, [allSubs]);

  if (superLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="text-center space-y-2">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
          <p className="text-xs text-muted-foreground">লোড হচ্ছে…</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-bold text-destructive">অ্যাক্সেস অনুমোদিত নয়</h2>
        <p className="text-xs text-muted-foreground mt-1">শুধুমাত্র সুপার অ্যাডমিন এই পাতা দেখতে পারবেন।</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              সাবস্ক্রিপশন ও বিলিং মাস্টার হাব
            </h1>
            <Badge variant="outline" className="text-xs border-primary/40 bg-primary/10 text-primary font-bold">
              Super Admin
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            প্রতিটি ক্লায়েন্টের আলাদা মাসিক ফি ও নির্ধারিত তারিখ (Due Date), অটো-লক, ১-ক্লিকে ফ্রি এবং বিকাশ গেটওয়ে ট্র্যাকিং।
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Lock Card Preview Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const target = allSubs.find((s) => s.status === "locked") || allSubs[0];
              setPreviewSub({
                business_id: target?.business_id || "preview-id",
                business_name: target?.business_name || "Sheikh Pharma",
                mode: target?.mode || "subscription",
                monthly_amount: target?.monthly_amount || 800,
                due_day: target?.due_day || 7,
                is_free: target?.mode === "free",
                is_paid: false,
                is_locked: true,
                is_due_warning: false,
                due_date: target?.current_bill?.due_date || `${target?.due_day || 7} তারিখ`,
                bill_id: target?.current_bill?.id || null,
                helpline: target?.helpline || "01712472839",
              });
            }}
            className="h-9 rounded-xl text-xs font-bold border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 cursor-pointer shadow-2xs gap-1.5"
            title="ক্লায়েন্ট বকেয়া বিল না দিলে যে লাল মেসেজ কার্ডটি দেখবে তার প্রিভিউ দেখুন"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>লক মেসেজ কার্ড প্রিভিউ</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-9 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefetching ? "animate-spin" : ""}`} />
            রিফ্রেশ
          </Button>

          <Button asChild size="sm" className="h-9 rounded-xl text-xs font-semibold cursor-pointer bg-[#E2136E] hover:bg-[#C20E5E] text-white">
            <Link to="/admin/bkash">
              <Smartphone className="h-3.5 w-3.5 mr-1.5" />
              বিকাশ গেটওয়ে সেটিংস
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card
          onClick={() => setStatusFilter("all")}
          className={`cursor-pointer transition-all border ${
            statusFilter === "all" ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:border-primary/40"
          }`}
        >
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">মোট ক্লায়েন্ট</span>
            <div className="text-2xl font-black text-foreground font-mono">{stats.total}</div>
            <p className="text-[10px] text-muted-foreground">দোকান, ডাক্তার ও ক্লিনিক</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter("paid")}
          className={`cursor-pointer transition-all border ${
            statusFilter === "paid" ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5" : "hover:border-emerald-500/40"
          }`}
        >
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-emerald-600 uppercase flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> পরিশোধিত (Paid)
            </span>
            <div className="text-2xl font-black text-emerald-600 font-mono">{stats.paid}</div>
            <p className="text-[10px] text-muted-foreground">সচল রয়েছে</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter("due")}
          className={`cursor-pointer transition-all border ${
            statusFilter === "due" ? "ring-2 ring-amber-500 border-amber-500 bg-amber-500/5" : "hover:border-amber-500/40"
          }`}
        >
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-amber-600 uppercase flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> বকেয়া নোটিশ
            </span>
            <div className="text-2xl font-black text-amber-600 font-mono">{stats.due}</div>
            <p className="text-[10px] text-muted-foreground">নির্ধারিত তারিখের মধ্যে</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter("locked")}
          className={`cursor-pointer transition-all border ${
            statusFilter === "locked" ? "ring-2 ring-destructive border-destructive bg-destructive/5" : "hover:border-destructive/40"
          }`}
        >
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-destructive uppercase flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" /> স্থগিত / লকড
            </span>
            <div className="text-2xl font-black text-destructive font-mono">{stats.locked}</div>
            <p className="text-[10px] text-muted-foreground">তারিখ পার হয়েছে</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter("free")}
          className={`cursor-pointer transition-all border col-span-2 sm:col-span-1 ${
            statusFilter === "free" ? "ring-2 ring-purple-500 border-purple-500 bg-purple-500/5" : "hover:border-purple-500/40"
          }`}
        >
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-purple-600 uppercase flex items-center gap-1">
              <Gift className="h-3.5 w-3.5" /> ফ্রি / লাইফটাইম
            </span>
            <div className="text-2xl font-black text-purple-600 font-mono">{stats.free}</div>
            <p className="text-[10px] text-muted-foreground">কখনোই লক হবে না</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ব্যবসার নাম বা ওনারের নাম দিয়ে খুঁজুন…"
            className="pl-9 h-10 rounded-xl text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(["all", "paid", "due", "locked", "free"] as const).map((key) => {
            const labels = {
              all: `সকল (${stats.total})`,
              paid: `পেইড (${stats.paid})`,
              due: `বকেয়া (${stats.due})`,
              locked: `লকড (${stats.locked})`,
              free: `ফ্রি (${stats.free})`,
            };
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === key
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                {labels[key]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table */}
      <Card className="rounded-2xl overflow-hidden border border-border/70 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="p-3.5">ব্যবসার নাম ও ধরণ</th>
                <th className="p-3.5">ওনারের তথ্য</th>
                <th className="p-3.5">মাসিক ফি (৳)</th>
                <th className="p-3.5">বিল পরিশোধের তারিখ</th>
                <th className="p-3.5">স্ট্যাটাস</th>
                <th className="p-3.5 text-right">সুপার অ্যাডমিন অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    লোড হচ্ছে…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    কোনো ক্লায়েন্ট পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const currentPrice =
                    editingPrices[s.business_id] !== undefined
                      ? editingPrices[s.business_id]
                      : s.monthly_amount;
                  const isPriceDirty =
                    editingPrices[s.business_id] !== undefined &&
                    editingPrices[s.business_id] !== s.monthly_amount;

                  return (
                    <tr key={s.business_id} className="hover:bg-muted/30 transition-colors">
                      {/* Business info */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-between gap-1 group">
                          <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-primary shrink-0" />
                            <span>{s.business_name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="opacity-70 hover:opacity-100 hover:text-primary transition-opacity p-1 rounded-md hover:bg-muted cursor-pointer"
                            title="ব্যবসার নাম ও ধরণ এডিট করুন"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                            {s.clinic_mode ? "🏥 ক্লিনিক" : s.biz_kind === "doctor" ? "🩺 ডাক্তার" : "🏪 শপ / POS"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">ID: {s.business_id.slice(0, 8)}…</span>
                        </div>
                      </td>

                      {/* Owner info */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-between gap-1 group">
                          <div>
                            <div className="font-medium text-foreground">{s.owner_name || "—"}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{s.owner_email || "No email"}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="opacity-70 hover:opacity-100 hover:text-primary transition-opacity p-1 rounded-md hover:bg-muted cursor-pointer"
                            title="ওনারের নাম ও ইমেইল এডিট করুন"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* Monthly Fee Control */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                              ৳
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="50"
                              disabled={s.mode === "free"}
                              value={s.mode === "free" ? 0 : currentPrice}
                              onChange={(e) =>
                                setEditingPrices({
                                  ...editingPrices,
                                  [s.business_id]: Number(e.target.value) || 0,
                                })
                              }
                              className={`w-24 h-8 pl-6 pr-2 text-right rounded-lg border text-xs font-mono font-bold outline-none transition-all ${
                                s.mode === "free"
                                  ? "bg-muted text-muted-foreground border-border/50 cursor-not-allowed"
                                  : "bg-input border-border focus:border-primary"
                              }`}
                            />
                          </div>

                          {isPriceDirty && s.mode !== "free" && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={priceMutation.isPending}
                              onClick={() =>
                                priceMutation.mutate({
                                  businessId: s.business_id,
                                  amount: currentPrice,
                                })
                              }
                              className="h-8 px-2.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground cursor-pointer shadow-xs"
                              title="নতুন ফি সেভ করুন"
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                          )}
                        </div>
                        {s.mode === "free" && (
                          <span className="text-[10px] text-purple-600 font-bold block mt-0.5">ফ্রি অ্যাকাউন্টে ফি ৳০</span>
                        )}
                      </td>

                      {/* Due Date Control — Single clean selector */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={s.due_day || 7}
                            disabled={s.mode === "free" || dueDayMutation.isPending}
                            onChange={(e) =>
                              dueDayMutation.mutate({
                                businessId: s.business_id,
                                dueDay: Number(e.target.value) || 7,
                              })
                            }
                            className={`h-8 px-2.5 rounded-lg border text-xs font-bold font-mono outline-none cursor-pointer transition-colors ${
                              s.mode === "free"
                                ? "bg-muted text-muted-foreground border-border/50 cursor-not-allowed"
                                : "bg-input border-border hover:border-primary/60 focus:border-primary"
                            }`}
                            title="প্রতি মাসের নির্ধারিত দিন নির্বাচন করুন (১ থেকে ৩১ তারিখ)"
                          >
                            {ALL_DUE_DAYS.map((day) => (
                              <option key={day} value={day}>
                                প্রতি মাসের {day} তারিখ
                              </option>
                            ))}
                          </select>
                        </div>
                        {s.current_bill && s.mode !== "free" && s.current_bill.due_date && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              চলতি শেষ তারিখ: {s.current_bill.due_date}
                            </span>
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              className="opacity-60 hover:opacity-100 hover:text-primary transition-opacity p-0.5 rounded cursor-pointer"
                              title="চলতি বিলের নির্দিষ্ট শেষ তারিখ পরিবর্তন করুন"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        {s.status === "free" ? (
                          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 gap-1 font-bold">
                            <Gift className="h-3 w-3" /> ফ্রি / লাইফটাইম
                          </Badge>
                        ) : s.status === "paid" ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 font-bold">
                              <CheckCircle2 className="h-3 w-3" /> পরিশোধিত (Paid)
                            </Badge>
                            {s.current_bill?.paid_at && (
                              <div className="text-[10px] text-muted-foreground">
                                তারিখ: {new Date(s.current_bill.paid_at).toLocaleDateString("bn-BD")}
                              </div>
                            )}
                          </div>
                        ) : s.status === "due" ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 font-bold">
                              <Clock className="h-3 w-3" /> বকেয়া (Due)
                            </Badge>
                            <div className="text-[10px] text-amber-800 dark:text-amber-300">
                              পরিশোধের শেষ তারিখ: {s.current_bill?.due_date || `${s.due_day} তারিখ`}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <Badge variant="destructive" className="gap-1 font-bold">
                              <Lock className="h-3 w-3" /> স্থগিত / লকড
                            </Badge>
                            <div className="text-[10px] text-destructive font-medium">
                              মেয়াদ শেষ: {s.current_bill?.due_date}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Super Admin Quick Actions */}
                      <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                        {/* Preview Lock Card for this specific business */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPreviewSub({
                              business_id: s.business_id,
                              business_name: s.business_name,
                              mode: s.mode,
                              monthly_amount: s.monthly_amount,
                              due_day: s.due_day,
                              is_free: s.mode === "free",
                              is_paid: s.status === "paid",
                              is_locked: true,
                              is_due_warning: false,
                              due_date: s.current_bill?.due_date || `${s.due_day} তারিখ`,
                              bill_id: s.current_bill?.id || null,
                              helpline: s.helpline || "01712472839",
                            })
                          }
                          className="h-7 px-2 text-[11px] rounded-lg font-bold border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer shadow-2xs"
                          title="এই ক্লায়েন্টের জন্য বকেয়া বিলের মেসেজ কার্ড প্রিভিউ দেখুন"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          <span>কার্ড প্রিভিউ</span>
                        </Button>

                        {/* Edit Full Profile */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(s)}
                          className="h-7 px-2 text-[11px] rounded-lg font-bold border-primary/40 text-primary hover:bg-primary/10 cursor-pointer shadow-2xs"
                          title="এই ক্লায়েন্টের সকল তথ্য এডিট করুন"
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          <span>এডিট</span>
                        </Button>

                        {/* Toggle Free Mode */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={modeMutation.isPending}
                          onClick={() =>
                            modeMutation.mutate({
                              businessId: s.business_id,
                              mode: s.mode === "free" ? "subscription" : "free",
                            })
                          }
                          className={`h-7 px-2 text-[11px] rounded-lg font-bold transition-all cursor-pointer ${
                            s.mode === "free"
                              ? "border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                              : "border-border hover:bg-muted text-muted-foreground"
                          }`}
                          title={s.mode === "free" ? "পেইড সাবস্ক্রিপশনে রূপান্তর করুন" : "১-ক্লিকে ফ্রি / লাইফটাইম করুন"}
                        >
                          <Gift className="h-3 w-3 mr-1 text-purple-600" />
                          <span>{s.mode === "free" ? "পেইড করুন" : "ফ্রি করুন"}</span>
                        </Button>

                        {/* Mark Paid manually if unpaid bill exists */}
                        {s.current_bill && s.current_bill.status !== "paid" && s.mode !== "free" && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={markPaidMutation.isPending}
                            onClick={() => markPaidMutation.mutate(s.current_bill!.id)}
                            className="h-7 px-2 text-[11px] rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs"
                            title="ক্যাশ বা পার্সোনাল পেমেন্ট পেলে পেইড করুন"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            <span>পেইড করুন</span>
                          </Button>
                        )}

                        {/* Extend Grace Period +3 days if locked or due */}
                        {s.current_bill && s.current_bill.status !== "paid" && s.mode !== "free" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={graceMutation.isPending}
                            onClick={() => graceMutation.mutate(s.current_bill!.id)}
                            className="h-7 px-2 text-[11px] rounded-lg font-bold cursor-pointer text-amber-900 dark:text-amber-100 hover:bg-amber-500/20"
                            title="লক সাময়িকভাবে খুলে ৩ দিন সময় বাড়িয়ে দিন"
                          >
                            <Calendar className="h-3 w-3 mr-1 text-amber-600" />
                            <span>+৩ দিন</span>
                          </Button>
                        )}

                        {/* Unlock button if locked */}
                        {s.status === "locked" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={unlockMutation.isPending}
                            onClick={() =>
                              unlockMutation.mutate({
                                businessId: s.business_id,
                                billId: s.current_bill?.id,
                              })
                            }
                            className="h-7 px-2 text-[11px] rounded-lg font-bold border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer shadow-2xs"
                            title="সিস্টেম আনলক করুন (+৩ দিন গ্রেস বাড়িয়ে দেওয়া হবে)"
                          >
                            <Unlock className="h-3 w-3 mr-1 text-amber-600" />
                            <span>আনলক করুন</span>
                          </Button>
                        )}

                        {/* Instant Lock button: if unpaid and not locked yet */}
                        {s.status !== "locked" && s.mode !== "free" && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={lockMutation.isPending}
                            onClick={() =>
                              lockMutation.mutate({
                                businessId: s.business_id,
                                billId: s.current_bill?.id,
                              })
                            }
                            className="h-7 px-2 text-[11px] rounded-lg font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer shadow-2xs"
                            title="সিস্টেম এখনই লক করুন (ক্লায়েন্ট শুধুমাত্র বকেয়া বিল কার্ড দেখতে পাবে)"
                          >
                            <Lock className="h-3 w-3 mr-1" />
                            <span>লক করুন</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Client & Billing Modal Dialog */}
      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Pencil className="h-4 w-4 text-primary" />
              <span>ক্লায়েন্ট ও বিলিং তথ্য সম্পাদনা</span>
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingClient) return;
              profileMutation.mutate({
                business_id: editingClient.business_id,
                ...formData,
              });
            }}
            className="space-y-4 pt-2 text-xs"
          >
            {/* 1. Business Name */}
            <div className="space-y-1">
              <label className="font-bold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                ব্যবসার নাম:
              </label>
              <Input
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                required
                className="h-9 text-xs"
                placeholder="যেমন: Sheikh Pharma"
              />
            </div>

            {/* 2. Business Type & Mode */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-foreground">ব্যবসার ধরণ:</label>
                <select
                  value={formData.biz_kind}
                  onChange={(e) => setFormData({ ...formData, biz_kind: e.target.value as any })}
                  className="w-full h-9 px-2.5 rounded-lg border border-border bg-input text-xs font-medium outline-none focus:border-primary"
                >
                  <option value="pos">🏪 শপ / ফার্মেসি POS</option>
                  <option value="doctor">🩺 ডাক্তার প্রেসক্রিপশন</option>
                  <option value="clinic">🏥 ক্লিনিক ও ডায়াগনস্টিক</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">অ্যাকাউন্ট মোড:</label>
                <select
                  value={formData.mode}
                  onChange={(e) => setFormData({ ...formData, mode: e.target.value as any })}
                  className="w-full h-9 px-2.5 rounded-lg border border-border bg-input text-xs font-medium outline-none focus:border-primary"
                >
                  <option value="subscription">💳 পেইড সাবস্ক্রিপশন</option>
                  <option value="free">🎁 ফ্রি / লাইফটাইম</option>
                </select>
              </div>
            </div>

            {/* 3. Owner Name & Email */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-foreground">ওনারের নাম:</label>
                <Input
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  className="h-9 text-xs"
                  placeholder="ওনার বা ডাক্তারের নাম"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">ওনারের ইমেইল (লগইন):</label>
                <Input
                  type="email"
                  value={formData.owner_email}
                  onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                  className="h-9 text-xs font-mono"
                  placeholder="owner@gmail.com"
                />
              </div>
            </div>

            {/* 4. Monthly Fee & Due Day */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-foreground">মাসিক ফি (৳):</label>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  disabled={formData.mode === "free"}
                  value={formData.mode === "free" ? 0 : formData.monthly_amount}
                  onChange={(e) => setFormData({ ...formData, monthly_amount: Number(e.target.value) || 0 })}
                  className="h-9 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">প্রতি মাসের বিলিং দিন:</label>
                <select
                  value={formData.due_day}
                  disabled={formData.mode === "free"}
                  onChange={(e) => setFormData({ ...formData, due_day: Number(e.target.value) || 7 })}
                  className="w-full h-9 px-2.5 rounded-lg border border-border bg-input text-xs font-bold font-mono outline-none focus:border-primary"
                >
                  {ALL_DUE_DAYS.map((day) => (
                    <option key={day} value={day}>
                      প্রতি মাসের {day} তারিখ
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 5. Specific Current Month Due Date & Helpline */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-foreground">চলতি বিলের শেষ তারিখ:</label>
                <Input
                  type="date"
                  disabled={formData.mode === "free"}
                  value={formData.current_due_date}
                  onChange={(e) => setFormData({ ...formData, current_due_date: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">হেল্পলাইন নম্বর:</label>
                <Input
                  value={formData.helpline}
                  onChange={(e) => setFormData({ ...formData, helpline: e.target.value })}
                  className="h-9 text-xs font-mono"
                  placeholder="01712472839"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingClient(null)}
                className="h-9 text-xs font-semibold cursor-pointer"
              >
                বাতিল করুন
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={profileMutation.isPending}
                className="h-9 text-xs font-bold bg-primary text-primary-foreground cursor-pointer shadow-xs"
              >
                {profileMutation.isPending ? "সেভ হচ্ছে…" : "💾 পরিবর্তন সংরক্ষণ করুন"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Live Lock Modal Preview */}
      {previewSub && (
        <SubscriptionLockModal
          sub={previewSub}
          isPreview={true}
          onClosePreview={() => setPreviewSub(null)}
        />
      )}
    </div>
  );
}
