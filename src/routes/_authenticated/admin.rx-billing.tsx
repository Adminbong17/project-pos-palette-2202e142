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
  type BusinessSubscriptionRow,
} from "@/lib/subscriptions.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "due" | "locked" | "free">("all");
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});

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
    },
    onError: (e: any) => toast.error(e?.message || "সময় বাড়ানো যায়নি"),
  });

  // Instant Lock mutation
  const lockMutation = useMutation({
    mutationFn: async (billId: string) => {
      return await lockNow({ data: { bill_id: billId } });
    },
    onSuccess: () => {
      toast.success("সিস্টেম অবিলম্বে স্থগিত / লক করা হয়েছে!");
      qc.invalidateQueries({ queryKey: ["admin-all-subscriptions"] });
    },
    onError: (e: any) => toast.error(e?.message || "লক করা সম্ভব হয়নি"),
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
                        <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          <span>{s.business_name}</span>
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
                        <div className="font-medium text-foreground">{s.owner_name || "—"}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{s.owner_email || "No email"}</div>
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
                          <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                            চলতি শেষ তারিখ: {s.current_bill.due_date}
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

                        {/* Instant Lock button: if unpaid and not locked yet */}
                        {s.current_bill && s.current_bill.status !== "paid" && s.mode !== "free" && s.status !== "locked" && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={lockMutation.isPending}
                            onClick={() => lockMutation.mutate(s.current_bill!.id)}
                            className="h-7 px-2 text-[11px] rounded-lg font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer shadow-2xs"
                            title="সিস্টেম এখনই লক করুন"
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
    </div>
  );
}
