import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useRxBillingState } from "@/hooks/use-rx-billing";
import { BkashPayCard } from "@/components/bkash-pay-card";
import { RxCreditBuyCard } from "@/components/rx-credit-buy-card";

export const Route = createFileRoute("/_authenticated/rx-billing/buy")({
  component: BuyCreditsPage,
});

function BuyCreditsPage() {
  const { data: business } = useCurrentBusiness();
  const { state, refetch } = useRxBillingState();

  // bKash bounces back here with ?bkash=success|failed|cancelled
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("bkash");
    if (!r) return;
    if (r === "success") toast.success("bKash payment received — your account is updated");
    else if (r === "cancelled") toast.info("bKash payment cancelled");
    else toast.error(q.get("reason") ?? "bKash payment failed");
    window.history.replaceState({}, "", window.location.pathname);
    refetch();
  }, []);

  return (
    <div className="space-y-4">
      <BkashPayCard businessId={business?.id} creditRate={state.credit_rate} />
      <RxCreditBuyCard businessId={business?.id} />
    </div>
  );
}
