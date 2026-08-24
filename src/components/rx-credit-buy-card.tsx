import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet, Copy, ExternalLink } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shows the credit purchase link the platform admin generated for this
 * clinic / doctor, plus the status of manual top-up payments already sent.
 */
export function RxCreditBuyCard({
  businessId,
  userId,
}: {
  businessId?: string;
  /** Pass the doctor's user id for a personal link; omit for the clinic pool link. */
  userId?: string | null;
}) {
  const links = useQuery({
    queryKey: ["my-credit-links", businessId, userId ?? null],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rx_credit_links")
        .select("id, token, user_id, label, rate_per_credit, active")
        .eq("business_id", businessId!)
        .eq("active", true);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return userId ? rows.filter((r) => r.user_id === userId || r.user_id === null) : rows;
    },
  });

  const orders = useQuery({
    queryKey: ["my-credit-orders", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rx_credit_orders")
        .select("id, amount, credits, status, txn_ref, created_at")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" /> Buy Rx credits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(links.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payment link yet — ask the platform admin to generate one for you.
          </p>
        ) : (
          (links.data ?? []).map((l: any) => {
            const url = `${origin}/rx-pay/${l.token}`;
            return (
              <div key={l.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{Number(l.rate_per_credit)} tk = 1 credit</Badge>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{url}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard?.writeText(url);
                      toast.success("Link copied");
                    }}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button size="sm" asChild>
                    <a href={url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
                    </a>
                  </Button>
                </div>
                {l.label ? (
                  <p className="mt-2 text-xs text-muted-foreground">{l.label}</p>
                ) : null}
              </div>
            );
          })
        )}

        {(orders.data ?? []).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Recent payments</p>
            {(orders.data ?? []).map((o: any) => (
              <div key={o.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">
                  {Number(o.amount)} tk · {o.credits} credit(s) · {o.txn_ref}
                </span>
                <Badge
                  variant={
                    o.status === "paid" ? "default" : o.status === "rejected" ? "outline" : "secondary"
                  }
                >
                  {o.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
