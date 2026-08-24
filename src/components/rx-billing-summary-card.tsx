import { Link } from "@tanstack/react-router";
import { Wallet, History } from "lucide-react";

import { useRxBillingState, rxTierRate } from "@/hooks/use-rx-billing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Compact Rx billing widget for the doctor and clinic dashboards: credits left,
 * this month's prescription bill and links to billing + full history.
 */
export function RxBillingSummaryCard({ showBillingLink = true }: { showBillingLink?: boolean }) {
  const { state, isLoading } = useRxBillingState();

  const items = [
    { label: "Credits left", value: isLoading ? "…" : state.credits.toLocaleString() },
    { label: "Prescriptions this month", value: isLoading ? "…" : state.month_count.toLocaleString() },
    { label: "This month's bill", value: isLoading ? "…" : `৳${Number(state.month_amount ?? 0).toFixed(2)}` },
    { label: "Rate / Rx", value: isLoading ? "…" : `৳${rxTierRate(state.month_count)}` },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-primary" /> Rx Billing
          {state.shared_pool && <Badge variant="secondary">Clinic pool</Badge>}
          {state.locked && <Badge variant="destructive">Locked</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((it) => (
            <div key={it.label} className="rounded-lg border border-border/60 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{it.label}</div>
              <div className="mt-1 font-display text-lg font-semibold">{it.value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {showBillingLink && (
            <Link
              to="/rx-billing"
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
            >
              Billing &amp; credits
            </Link>
          )}
          <Link
            to="/rx-credit-history"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
          >
            <History className="h-3.5 w-3.5" /> Payment &amp; credit history
          </Link>
        </div>
        {state.overdue_bill && (
          <p className="text-xs text-destructive">
            Unpaid bill for {String(state.overdue_bill.period_start).slice(0, 7)}: ৳
            {state.overdue_bill.amount} (due {state.overdue_bill.due_date})
          </p>
        )}
      </CardContent>
    </Card>
  );
}
