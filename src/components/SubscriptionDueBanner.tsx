import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, ArrowRight, Loader2 } from "lucide-react";
import { startBkashPayment } from "@/lib/bkash-pay.functions";
import type { CurrentSubscriptionStatus } from "@/lib/subscriptions.functions";
import { Button } from "@/components/ui/button";

export function SubscriptionDueBanner({ sub }: { sub: CurrentSubscriptionStatus }) {
  const startBkash = useServerFn(startBkashPayment);
  const [loading, setLoading] = useState(false);

  const amount = sub.monthly_amount || 800;

  async function handlePayNow() {
    if (!sub.business_id || !sub.bill_id) {
      toast.error("বিলের তথ্য পাওয়া যায়নি");
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
      }
    } catch (e: any) {
      toast.error(e?.message || "বিকাশ পেমেন্ট শুরু করা যায়নি");
      setLoading(false);
    }
  }

  return (
    <div className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 text-amber-950 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
          <CalendarClock className="h-3.5 w-3.5" />
        </span>
        <span>
          সম্মানিত গ্রাহক, চলতি মাসের সাবস্ক্রিপশন ফি{" "}
          <strong className="font-mono font-bold text-foreground">৳{amount}</strong>। আগামী{" "}
          <strong className="underline underline-offset-2">{sub.due_date || "০৭ তারিখ"}</strong>-এর মধ্যে পরিশোধের
          অনুরোধ করা হলো।
        </span>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={handlePayNow}
        disabled={loading}
        className="h-7 px-3 text-[11px] rounded-lg bg-[#E2136E] hover:bg-[#C20E5E] text-white font-bold cursor-pointer transition-all shadow-xs"
      >
        {loading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            <span>অপেক্ষা করুন…</span>
          </>
        ) : (
          <>
            <span>বিকাশে বিল পরিশোধ করুন (৳{amount})</span>
            <ArrowRight className="h-3 w-3 ml-1" />
          </>
        )}
      </Button>
    </div>
  );
}
