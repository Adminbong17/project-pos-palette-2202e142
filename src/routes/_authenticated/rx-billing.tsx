import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wallet, ShieldCheck, Receipt } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { useRxBillingState, rxTierRate } from "@/hooks/use-rx-billing";
import { RxBillingBanner } from "@/components/rx-billing-banner";
import { RxCreditBuyCard } from "@/components/rx-credit-buy-card";
import { sendRxBillingOtp, verifyRxBillingOtp } from "@/lib/rx-billing.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/rx-billing")({
  head: () => ({
    meta: [
      { title: "Rx Billing & Credits — QweekRx" },
      {
        name: "description",
        content:
          "See your prescription credits, this month's prescription bill, verify your phone number for SMS bills and pay outstanding invoices.",
      },
      { property: "og:title", content: "Rx Billing & Credits — QweekRx" },
      {
        property: "og:description",
        content: "Prescription credits, monthly billing and phone verification for doctors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RxBillingPage,
});

function RxBillingPage() {
  const { data: business } = useCurrentBusiness();
  const { isDoctor, isAdmin } = useCurrentRole();
  // Doctors working under a clinic are funded by their clinic, not the platform.
  const clinicFunded = !!business?.clinic_mode && isDoctor && !isAdmin;
  const { state, isLoading, refetch } = useRxBillingState();
  const send = useServerFn(sendRxBillingOtp);
  const verify = useServerFn(verifyRxBillingOtp);

  const [phone, setPhone] = useState(state.phone ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const bills = useQuery({
    queryKey: ["rx-my-bills", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rx_bills")
        .select("id, period_start, prescriptions_count, amount, status, due_date, payment_link")
        .order("period_start", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  async function onSend() {
    setBusy(true);
    try {
      const r = await send({ data: { phone } });
      setSent(true);
      toast.success(
        r.delivered ? "Code sent by SMS" : `SMS gateway not configured — your code is ${r.code}`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (!business?.id) return;
    setBusy(true);
    try {
      await verify({ data: { phone, code, businessId: business.id } });
      toast.success("Phone verified");
      setSent(false);
      setCode("");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not verify");
    } finally {
      setBusy(false);
    }
  }

  if (clinicFunded) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <h1 className="font-display text-2xl font-semibold">Rx Credits</h1>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-primary" /> Credits from your clinic
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{isLoading ? "…" : state.credits}</p>
            <p className="text-xs text-muted-foreground">
              You are under a clinic, so your clinic provides your prescription credits — there is no
              platform bill for you. Ask your clinic admin to add more when they run out.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Rx Billing &amp; Credits</h1>
        <p className="text-sm text-muted-foreground">
          1 credit = 1 prescription. On subscription: first 100 prescriptions ৳5 each, above 100 all
          become ৳4 each, above 200 all become ৳3 each — counted fresh every month and billed by SMS.
        </p>
      </div>

      <RxBillingBanner />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-primary" /> Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">{isLoading ? "…" : state.mode}</p>
            {state.mode === "credit" && (
              <p className="text-xs text-muted-foreground">{state.credits} credit(s) left</p>
            )}
            {state.mode === "free" && (
              <p className="text-xs text-muted-foreground">No charge for your account.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Receipt className="h-4 w-4 text-primary" /> This month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{state.month_count} prescriptions</p>
            <p className="text-xs text-muted-foreground">
              ৳{state.month_amount} at ৳{rxTierRate(state.month_count)} each
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" /> Bill SMS number
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {state.phone_verified ? `Verified: ${state.phone}` : "Not verified yet"}
            </p>
            <Input
              className="h-9 text-sm"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {sent && (
              <Input
                className="h-9 text-sm"
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy || !phone} onClick={onSend}>
                {sent ? "Resend code" : "Send code"}
              </Button>
              {sent && (
                <Button size="sm" disabled={busy || code.length < 6} onClick={onVerify}>
                  Verify
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <RxCreditBuyCard businessId={business?.id} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monthly bills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bills.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !bills.data?.length ? (
            <p className="text-sm text-muted-foreground">No bills yet.</p>
          ) : (
            bills.data.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
              >
                <span className="font-medium">{String(b.period_start).slice(0, 7)}</span>
                <span className="text-muted-foreground">{b.prescriptions_count} Rx</span>
                <span className="font-semibold">৳{b.amount}</span>
                <span className="text-xs text-muted-foreground">due {b.due_date}</span>
                <span
                  className={
                    b.status === "paid"
                      ? "rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                      : b.status === "waived"
                        ? "rounded bg-muted px-1.5 py-0.5 text-xs"
                        : "rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive"
                  }
                >
                  {b.status}
                </span>
                {b.status === "unpaid" && b.payment_link && (
                  <Button size="sm" asChild>
                    <a href={b.payment_link} target="_blank" rel="noreferrer">
                      Pay
                    </a>
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
