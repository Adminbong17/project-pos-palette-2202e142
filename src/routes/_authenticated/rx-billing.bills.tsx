import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { BkashBillPayButton } from "@/components/bkash-pay-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/rx-billing/bills")({
  component: MonthlyBillsPage,
});

function MonthlyBillsPage() {
  const { data: business } = useCurrentBusiness();

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

  return (
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
              {b.status === "unpaid" && (
                <BkashBillPayButton businessId={business?.id} billId={b.id} />
              )}
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
  );
}
