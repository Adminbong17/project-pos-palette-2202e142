import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wallet, Plus, Minus } from "lucide-react";

import { listClinicCredits, grantClinicCredits } from "@/lib/clinic-credits.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Clinic admin view: the clinic's prescription credit pool (topped up by the
 * platform admin) and how many credits each doctor under the clinic holds.
 */
export function ClinicCreditsCard({
  businessId,
  doctors,
}: {
  businessId?: string;
  doctors: { user_id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const load = useServerFn(listClinicCredits);
  const grant = useServerFn(grantClinicCredits);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const credits = useQuery({
    queryKey: ["clinic-credits", businessId],
    enabled: !!businessId,
    queryFn: async () => await load({ data: { business_id: businessId! } }),
  });

  const move = useMutation({
    mutationFn: async (vars: { user_id: string; delta: number }) =>
      await grant({ data: { business_id: businessId!, ...vars } }),
    onSuccess: (res: any) => {
      toast.success(`${Math.abs(res.moved)} credit(s) moved · pool ${res.pool_credits}`);
      setAmounts({});
      qc.invalidateQueries({ queryKey: ["clinic-credits", businessId] });
      qc.invalidateQueries({ queryKey: ["rx-billing-state"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not move credits"),
  });

  const byDoctor = new Map((credits.data?.doctors ?? []).map((d) => [d.user_id, d.credits]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-primary" /> Rx credits
          <Badge variant="secondary">
            Clinic pool: {credits.isLoading ? "…" : (credits.data?.pool_credits ?? 0)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Doctors under your clinic get their prescription credits from the clinic pool — they are not
          billed by the platform directly. The platform admin tops up this pool for the clinic.
        </p>

        {!credits.isLoading && !credits.data?.pool_exists && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            No clinic credit pool yet — ask the platform admin to create one for your clinic.
          </p>
        )}

        {doctors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a doctor first.</p>
        ) : (
          <div className="space-y-2">
            {doctors.map((d) => {
              const value = amounts[d.user_id] ?? "";
              const n = Math.trunc(Number(value) || 0);
              return (
                <div
                  key={d.user_id}
                  className="flex flex-wrap items-center gap-2 rounded-md border p-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.name}</span>
                  <Badge variant="outline">{byDoctor.get(d.user_id) ?? 0} credits</Badge>
                  <Input
                    className="w-24"
                    inputMode="numeric"
                    placeholder="Qty"
                    value={value}
                    onChange={(e) => setAmounts({ ...amounts, [d.user_id]: e.target.value })}
                  />
                  <Button
                    size="sm"
                    disabled={!n || move.isPending}
                    onClick={() => move.mutate({ user_id: d.user_id, delta: Math.abs(n) })}
                  >
                    <Plus className="h-4 w-4" /> Give
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!n || move.isPending}
                    onClick={() => move.mutate({ user_id: d.user_id, delta: -Math.abs(n) })}
                  >
                    <Minus className="h-4 w-4" /> Take back
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
