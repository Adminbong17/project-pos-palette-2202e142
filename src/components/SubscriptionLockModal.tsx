import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, PhoneCall, ShieldAlert, Loader2 } from "lucide-react";
import { startBkashPayment } from "@/lib/bkash-pay.functions";
import type { CurrentSubscriptionStatus } from "@/lib/subscriptions.functions";
import { Button } from "@/components/ui/button";

export function SubscriptionLockModal({ sub }: { sub: CurrentSubscriptionStatus }) {
  const startBkash = useServerFn(startBkashPayment);
  const [loading, setLoading] = useState(false);

  const amount = sub.monthly_amount || 800;
  const helpline = sub.helpline || "01712472839";

  async function handlePayNow() {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg rounded-2xl border border-destructive/40 bg-card p-6 sm:p-8 text-center shadow-2xl space-y-6">
        {/* Urgent Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive ring-8 ring-destructive/10 animate-pulse">
          <ShieldAlert className="h-8 w-8" />
        </div>

        {/* Header */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            সাবস্ক্রিপশন মেয়াদোত্তীর্ণ / সাময়িক স্থগিত
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            সফটওয়্যার সেবা স্থগিত রয়েছে
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            সম্মানিত গ্রাহক, <span className="font-semibold text-foreground">“{sub.business_name}”</span>-এর চলতি মাসের
            সাবস্ক্রিপশন ফি পরিশোধের শেষ সময় ({sub.due_date || "০৭ তারিখ"}) অতিক্রান্ত হয়েছে।
          </p>
        </div>

        {/* Bill Summary Card */}
        <div className="rounded-xl border border-border/80 bg-muted/40 p-4 space-y-2 text-left">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>মাসিক সাবস্ক্রিপশন ফি:</span>
            <span className="font-mono font-bold text-foreground text-sm">৳{amount}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>পরিশোধের নির্ধারিত তারিখ:</span>
            <span className="font-medium text-destructive">{sub.due_date || "০৭ তারিখ"}</span>
          </div>
          <div className="flex justify-between items-center text-xs pt-1 border-t border-border/60">
            <span className="font-medium text-foreground">মোট প্রদেয় বকেয়া:</span>
            <span className="font-mono font-black text-destructive text-base">৳{amount}</span>
          </div>
        </div>

        {/* Action Button: Instant bKash Pay */}
        <div className="space-y-3 pt-1">
          <Button
            type="button"
            onClick={handlePayNow}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-[#E2136E] hover:bg-[#C20E5E] text-white font-bold text-sm sm:text-base shadow-lg shadow-[#E2136E]/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>বিকাশ গেটওয়েতে সংযোগ হচ্ছে…</span>
              </>
            ) : (
              <>
                <img
                  src="https://raw.githubusercontent.com/Sheikh-Pharma/assets/main/bkash-logo.png"
                  alt="bKash"
                  className="h-5 w-auto object-contain brightness-0 invert"
                  onError={(e) => {
                    // Fallback to text if image fails
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <span>বিকাশ দিয়ে এখনই পরিশোধ করুন (৳{amount})</span>
              </>
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground">
            পেমেন্ট সম্পন্ন হওয়ার সাথে সাথেই আপনার একাউন্ট স্বয়ংক্রিয়ভাবে সচল হয়ে যাবে।
          </p>
        </div>

        {/* Helpline */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <PhoneCall className="h-3.5 w-3.5 text-primary" />
          <span>জরুরী প্রয়োজনে সুপার অ্যাডমিন সাপোর্ট:</span>
          <a
            href={`tel:${helpline}`}
            className="font-bold text-primary hover:underline"
          >
            {helpline}
          </a>
        </div>
      </div>
    </div>
  );
}
