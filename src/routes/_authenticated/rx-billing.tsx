import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Gift,
  PhoneCall,
  Calendar,
  History,
  Smartphone,
  Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { usePlatformSubscription } from "@/hooks/use-platform-subscription";
import { startBkashPayment } from "@/lib/bkash-pay.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/rx-billing")({
  head: () => ({
    meta: [
      { title: "My Subscription — Sheikh Pharma" },
      {
        name: "description",
        content: "View monthly subscription status, due dates, pay via bKash, and track billing history.",
      },
    ],
  }),
  component: MySubscriptionPage,
});

function MySubscriptionPage() {
  const { data: business } = useCurrentBusiness();
  const { sub, isLocked, isDueWarning, isPaid, isFree, refetch } = usePlatformSubscription();
  const startBkash = useServerFn(startBkashPayment);
  const [loading, setLoading] = useState(false);

  // Billing history
  const billsQuery = useQuery({
    queryKey: ["my-subscription-bills", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rx_bills")
        .select("id, period_start, amount, status, due_date, paid_at")
        .eq("business_id", business!.id)
        .is("user_id", null)
        .order("period_start", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const amount = sub?.monthly_amount || 800;
  const helpline = sub?.helpline || "01712472839";

  async function handlePayNow() {
    if (!sub?.business_id || !sub?.bill_id) {
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
      }
    } catch (e: any) {
      toast.error(e?.message || "বিকাশ পেমেন্ট শুরু করা যায়নি");
      setLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <span>আমার সাবস্ক্রিপশন ও বিলিং</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {business?.name || "আপনার প্রতিষ্ঠান"}-এর মাসিক সাবস্ক্রিপশন স্ট্যাটাস ও বিকাশ পেমেন্ট।
        </p>
      </div>

      {/* Main Status Hero Card */}
      <Card className="rounded-2xl overflow-hidden border border-border shadow-sm">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                বর্তমান সাবস্ক্রিপশন স্ট্যাটাস
              </span>
              <div className="mt-1 flex items-center gap-2">
                {isFree ? (
                  <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 gap-1.5 font-bold text-sm px-3 py-1">
                    <Gift className="h-4 w-4" /> ফ্রি / লাইফটাইম অ্যাক্টিভ
                  </Badge>
                ) : isPaid ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 font-bold text-sm px-3 py-1">
                    <CheckCircle2 className="h-4 w-4" /> চলতি মাসের বিল পরিশোধিত (Active)
                  </Badge>
                ) : isLocked ? (
                  <Badge variant="destructive" className="gap-1.5 font-bold text-sm px-3 py-1">
                    <Lock className="h-4 w-4" /> বিল বকেয়া (স্থগিত / Locked)
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1.5 font-bold text-sm px-3 py-1">
                    <AlertTriangle className="h-4 w-4" /> বকেয়া (Due - ০৭ তারিখের মধ্যে প্রদেয়)
                  </Badge>
                )}
              </div>
            </div>

            {/* Price Box */}
            <div className="sm:text-right">
              <span className="text-xs font-medium text-muted-foreground">মাসিক সাবস্ক্রিপশন ফি</span>
              <div className="text-3xl font-black text-foreground font-mono">
                {isFree ? "৳০" : `৳${amount}`}
                <span className="text-xs font-normal text-muted-foreground"> / মাস</span>
              </div>
            </div>
          </div>

          {/* Details / Instructions */}
          {isFree ? (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 text-xs text-purple-950 dark:text-purple-200 leading-relaxed">
              🎉 আপনার প্রতিষ্ঠানকে সুপার অ্যাডমিন কর্তৃক <strong>লাইফটাইম ফ্রি অ্যাক্সেস</strong> দেওয়া হয়েছে। আপনার
              সফটওয়্যারে কোনো মাসিক বিল বা ডেডলাইন প্রযোজ্য নয়। সকল ফিচার আনলিমিটেড ব্যবহার করতে পারবেন।
            </div>
          ) : isPaid ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>
                চলতি মাসের বিল পরিশোধ সম্পন্ন হয়েছে। আপনার সফটওয়্যার সম্পূর্ণ সচল রয়েছে। পরবর্তী মাসের ০১ তারিখে নতুন
                ইনভয়েস তৈরি হবে।
              </span>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 text-amber-950 dark:text-amber-200">
                  <p className="font-bold text-sm">
                    {isLocked ? "সাবস্ক্রিপশন ফি বকেয়া থাকায় সেবা স্থগিত রয়েছে" : "চলতি মাসের সাবস্ক্রিপশন ফি প্রদেয়"}
                  </p>
                  <p>
                    পরিশোধের নির্ধারিত শেষ সময়:{" "}
                    <strong className="underline">{sub?.due_date || "০৭ তারিখ"}</strong>। সফটওয়্যার নিরবচ্ছিন্নভাবে ব্যবহার
                    করতে বিকাশ দিয়ে ফি পরিশোধ করুন।
                  </p>
                </div>
              </div>

              {/* bKash Payment Trigger */}
              <div className="pt-2 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-muted-foreground">
                  মোট প্রদেয় বকেয়া: <strong className="text-foreground text-sm font-mono">৳{amount}</strong>
                </div>

                <Button
                  type="button"
                  onClick={handlePayNow}
                  disabled={loading}
                  className="w-full sm:w-auto h-11 px-6 rounded-xl bg-[#E2136E] hover:bg-[#C20E5E] text-white font-bold text-sm shadow-md shadow-[#E2136E]/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>বিকাশে সংযোগ হচ্ছে…</span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-4 w-4" />
                      <span>বিকাশ দিয়ে পরিশোধ করুন (৳{amount})</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Helpline Card */}
      <Card className="rounded-2xl border border-border/80 bg-muted/30 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <PhoneCall className="h-4 w-4 text-primary shrink-0" />
            <span>কোনো জিজ্ঞাসা বা অফলাইন ক্যাশ পেমেন্টের জন্য যোগাযোগ করুন:</span>
          </div>
          <a
            href={`tel:${helpline}`}
            className="font-bold text-primary hover:underline text-sm font-mono"
          >
            {helpline}
          </a>
        </div>
      </Card>

      {/* Billing History */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <span>পূর্ববর্তী বিলিং হিস্ট্রি</span>
        </h2>

        <Card className="rounded-2xl overflow-hidden border border-border/70">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase">
                <tr>
                  <th className="p-3">মাস</th>
                  <th className="p-3">টাকার পরিমাণ</th>
                  <th className="p-3">নির্ধারিত তারিখ</th>
                  <th className="p-3">স্ট্যাটাস</th>
                  <th className="p-3 text-right">পরিশোধের তারিখ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {billsQuery.isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      লোড হচ্ছে…
                    </td>
                  </tr>
                ) : (billsQuery.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      কোনো পূর্ববর্তী বিলের তথ্য নেই।
                    </td>
                  </tr>
                ) : (
                  (billsQuery.data ?? []).map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="p-3 font-semibold text-foreground">
                        {new Date(b.period_start).toLocaleDateString("bn-BD", { month: "long", year: "numeric" })}
                      </td>
                      <td className="p-3 font-mono font-bold">৳{b.amount}</td>
                      <td className="p-3 text-muted-foreground">{b.due_date}</td>
                      <td className="p-3">
                        {b.status === "paid" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                            পরিশোধিত
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            বকেয়া
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {b.paid_at ? new Date(b.paid_at).toLocaleDateString("bn-BD") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
