import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { bkashPayEnabled, startBkashPayment } from "@/lib/bkash-pay.functions";

/** Buy Rx credits online with bKash (Tokenized Checkout). */
export function BkashPayCard({
  businessId,
  creditRate,
}: {
  businessId?: string;
  /** Admin-set price per credit for this account. */
  creditRate?: number;
}) {
  const enabledQ = useQuery({
    queryKey: ["bkash-pay-enabled"],
    queryFn: async () => await bkashPayEnabled(),
    staleTime: 5 * 60_000,
  });
  const start = useServerFn(startBkashPayment);
  const [credits, setCredits] = useState("");
  const [busy, setBusy] = useState(false);

  const rate = Number(creditRate) > 0 ? Number(creditRate) : (enabledQ.data?.rate_per_credit ?? 3);
  const count = Math.max(0, Math.trunc(Number(credits) || 0));
  const payable = Math.round(count * rate);

  const enabled = enabledQ.data?.enabled === true;
  const unavailableMessage = enabledQ.isLoading
    ? "Checking bKash availability…"
    : enabledQ.isError
      ? "bKash status could not be checked. Please refresh and try again."
      : "bKash payment is not active yet. Ask the super admin to add the gateway credentials and enable it.";

  async function pay() {
    if (!businessId) return;
    setBusy(true);
    try {
      const res = await start({
        data: {
          business_id: businessId,
          kind: "credits" as const,
          credits: count,
          origin: window.location.origin,
        },
      });
      window.location.href = res.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start bKash payment");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4 text-primary" /> Pay with bKash
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!enabled && (
          <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {unavailableMessage}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Buy prescription credits instantly — ৳{rate} per credit. Credits are added to your account
          as soon as bKash confirms the payment.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium">
            Credits
            <Input
              className="mt-1 h-9 w-32 text-sm"
              inputMode="numeric"
              placeholder="10"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
            />
          </label>
          <p className="pb-2 text-sm">
            Payable: <span className="font-semibold">৳{payable}</span>
          </p>
          <Button
            className="mb-0.5"
            disabled={!enabled || busy || count < 1 || !businessId}
            onClick={pay}
          >
            {busy ? "Opening bKash…" : enabled ? "Pay with bKash" : "bKash unavailable"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Small "Pay with bKash" button for one monthly bill row. */
export function BkashBillPayButton({
  businessId,
  billId,
}: {
  businessId?: string;
  billId: string;
}) {
  const enabledQ = useQuery({
    queryKey: ["bkash-pay-enabled"],
    queryFn: async () => await bkashPayEnabled(),
    staleTime: 5 * 60_000,
  });
  const start = useServerFn(startBkashPayment);
  const [busy, setBusy] = useState(false);

  const enabled = enabledQ.data?.enabled === true;

  return (
    <Button
      size="sm"
      disabled={!enabled || busy || !businessId}
      title={enabled ? "Pay this bill with bKash" : "bKash is not enabled by the super admin"}
      onClick={async () => {
        if (!businessId) return;
        setBusy(true);
        try {
          const res = await start({
            data: {
              business_id: businessId,
              kind: "bill" as const,
              bill_id: billId,
              origin: window.location.origin,
            },
          });
          window.location.href = res.url;
        } catch (e: any) {
          toast.error(e?.message ?? "Could not start bKash payment");
          setBusy(false);
        }
      }}
    >
      <Smartphone className="mr-1 h-3.5 w-3.5" />{
        busy ? "Opening…" : enabled ? "Pay with bKash" : "bKash unavailable"
      }
    </Button>
  );
}
