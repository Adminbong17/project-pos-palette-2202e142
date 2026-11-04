import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  PhoneCall,
  ShieldAlert,
  Loader2,
  RefreshCw,
  LogOut,
  Smartphone,
  Calendar,
  Building2,
} from "lucide-react";
import { startBkashPayment } from "@/lib/bkash-pay.functions";
import type { CurrentSubscriptionStatus } from "@/lib/subscriptions.functions";
import { Button } from "@/components/ui/button";

export function SubscriptionLockModal({
  sub,
  onSignOut,
  onRefresh,
  isPreview = false,
  onClosePreview,
}: {
  sub: CurrentSubscriptionStatus;
  onSignOut?: () => void;
  onRefresh?: () => void;
  isPreview?: boolean;
  onClosePreview?: () => void;
}) {
  const startBkash = useServerFn(startBkashPayment);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const amount = sub.monthly_amount || 800;
  const helpline = sub.helpline || "01712472839";

  async function handlePayNow() {
    if (isPreview) {
      toast.info(`প্রিভিউ মুড: বিকাশ গেটওয়ে সম্পূর্ণ সচল আছে (৳${amount})। লাইভ বিলের ক্ষেত্রে এটি সরাসরি বিকাশ পেজে নিয়ে যাবে।`);
      return;
    }
    if (!sub.business_id || !sub.bill_id) {
      toast.error("বিলের তথ্য পাওয়া যায়নি। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।");
      return;
    }
    setLoading(true);
    try {
      const res = await startBkash({
        data: {
          business_id: sub.business_id,
          kind: "bill",
          bill_id: sub.bill_id,
          origin: window.location.origin,
        },
      });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        throw new Error("বিকাশ গেটওয়ে লিঙ্ক তৈরি করা সম্ভব হয়নি");
      }
    } catch (e: any) {
      toast.error(e?.message || "বিকাশ পেমেন্ট শুরু করা যায়নি");
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        window.location.reload();
      }
      toast.info("সাবস্ক্রিপশন স্ট্যাটাস যাচাই করা হয়েছে");
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  }

  return (
    <div className="fixed inset-0 z-50 min-h-screen w-full bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-6 select-none overflow-y-auto">
      {/* Centered Square Box */}
      <div className="relative w-full max-w-md rounded-3xl border-2 border-destructive/40 bg-card p-6 sm:p-8 text-center shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Glow behind the box */}
        <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-b from-destructive/20 to-transparent blur-xl -z-10 pointer-events-none" />

        {/* Admin Preview Header */}
        {isPreview && (
          <div className="rounded-2xl border border-amber-500/50 bg-amber-500/15 p-3 text-left space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-500">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                অ্যাডমিন প্রিভিউ মুড (প্রদর্শনী)
              </span>
              {onClosePreview && (
                <button
                  type="button"
                  onClick={onClosePreview}
                  className="text-[11px] font-bold text-amber-400 hover:text-white underline cursor-pointer"
                >
                  প্রিভিউ বন্ধ করুন ✕
                </button>
              )}
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              বকেয়া বিল পরিশোধ না করলে বা সফটওয়্যার লক করা থাকলে ক্লায়েন্টদের স্ক্রিন ঠিক এভাবেই সম্পূর্ণ অফ হয়ে শুধুমাত্র এই মেসেজ কার্ডটি দেখাবে।
            </p>
          </div>
        )}

        {/* Urgent Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive ring-8 ring-destructive/10 animate-pulse">
          <ShieldAlert className="h-8 w-8" />
        </div>

        {/* Header */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            বকেয়া বিল নোটিশ
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            সফটওয়্যার সেবা স্থগিত রয়েছে
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            সম্মানিত গ্রাহক, <span className="font-semibold text-foreground">“{sub.business_name}”</span>-এর মাসিক
            সাবস্ক্রিপশন ফি পরিশোধের নির্ধারিত তারিখ ({sub.due_date || "০৭ তারিখ"}) অতিক্রান্ত হওয়ায় সফটওয়্যার অ্যাক্সেস সাময়িকভাবে বন্ধ রাখা হয়েছে।
          </p>
        </div>

        {/* Bill Summary Square Card */}
        <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 space-y-2.5 text-left text-xs">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              প্রতিষ্ঠান:
            </span>
            <span className="font-semibold text-foreground truncate max-w-[180px]">
              {sub.business_name}
            </span>
          </div>

          <div className="flex justify-between items-center text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-destructive" />
              পরিশোধের শেষ তারিখ:
            </span>
            <span className="font-medium text-destructive">{sub.due_date || "০৭ তারিখ"}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border/60">
            <span className="font-bold text-foreground text-sm">মোট বকেয়া বিল:</span>
            <span className="font-mono font-black text-destructive text-lg">৳{amount}</span>
          </div>
        </div>

        {/* Primary Action: Direct Instant bKash Pay */}
        <div className="space-y-2.5 pt-1">
          <Button
            type="button"
            onClick={handlePayNow}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-[#E2136E] hover:bg-[#C20E5E] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#E2136E]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>বিকাশ গেটওয়েতে সংযোগ হচ্ছে…</span>
              </>
            ) : (
              <>
                <Smartphone className="h-5 w-5" />
                <span>বিকাশ দিয়ে এখনই পরিশোধ করুন (৳{amount})</span>
              </>
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground">
            বিকাশে পেমেন্ট সম্পন্ন হওয়া মাত্রই আপনার সফটওয়্যার স্বয়ংক্রিয়ভাবে আনলক হয়ে যাবে।
          </p>
        </div>

        {/* Secondary Actions: Check payment & Helpline */}
        <div className="space-y-3 pt-2 border-t border-border/60">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <PhoneCall className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>ক্যাশ পেমেন্ট বা সহায়তার জন্য কল:</span>
            <a
              href={`tel:${helpline}`}
              className="font-bold text-primary hover:underline font-mono text-xs"
            >
              {helpline}
            </a>
          </div>

          <div className="flex items-center justify-center gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-8 rounded-lg text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
              <span>পেমেন্ট চেক করুন</span>
            </Button>

            {onSignOut && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSignOut}
                className="h-8 rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive gap-1.5 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>লগআউট</span>
              </Button>
            )}
          </div>

          {isPreview && onClosePreview && (
            <div className="pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClosePreview}
                className="w-full h-8 rounded-lg text-xs font-bold bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
              >
                প্রিভিউ বন্ধ করুন (Exit Preview)
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
