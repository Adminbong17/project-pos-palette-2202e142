import { formatDate, formatDateTime } from "@/lib/utils";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Plus, Truck, Eye, Pencil, Trash2, Trash, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/purchases")({
  component: PurchasesPage,
});

type PurchaseRow = {
  id: string;
  ref_no: string | null;
  transaction_date: string;
  status: string;
  payment_status: string;
  final_total: number;
  total_paid: number;
  deleted_at?: string | null;
  contact: { name: string | null } | null;
  location: { name: string | null } | null;
};

function PurchasesPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/purchases") {
    return <Outlet />;
  }

  return <PurchasesList />;
}

function PurchasesList() {
  const { data: business } = useCurrentBusiness();
  const [showBin, setShowBin] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["purchases", business?.id, showBin ? "deleted" : "active"],
    enabled: !!business?.id,
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select(
          "id, ref_no, transaction_date, status, payment_status, final_total, total_paid, deleted_at, contact:contacts(name), location:business_locations(name)"
        )
        .eq("business_id", business!.id)
        .eq("type", "purchase");
      q = showBin ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
      const { data, error } = await q.order("transaction_date", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseRow[];
    },
  });

  const { data: binCount = 0 } = useQuery({
    queryKey: ["purchases-bin-count", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business!.id)
        .eq("type", "purchase")
        .not("deleted_at", "is", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["purchases"] });
    qc.invalidateQueries({ queryKey: ["purchases-bin-count"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_purchase" as any, { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase moved to recycle bin and stock reverted");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("restore_purchase" as any, { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase restored with stock and prices");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Restore failed"),
  });

  const purge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("purge_purchase" as any, { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase permanently deleted");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Permanent delete failed"),
  });

  const busy = del.isPending || restore.isPending || purge.isPending;

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(n || 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Truck className="h-6 w-6" /> {showBin ? "Recycle Bin — Purchases" : "Purchases"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {showBin
              ? "Deleted purchases. Restore to bring back stock and cost prices."
              : "All stock-in purchase transactions."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={showBin ? "default" : "outline"} onClick={() => setShowBin((v) => !v)}>
            <Trash className="h-4 w-4 mr-1" /> {showBin ? "Back to purchases" : `Recycle bin${binCount ? ` (${binCount})` : ""}`}
          </Button>
          {!showBin && (
            <Button asChild>
              <Link to="/purchases/new">
                <Plus className="h-4 w-4 mr-1" /> Add Purchase
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Ref No</th>
              <th className="text-left p-3">Supplier</th>
              <th className="text-left p-3">Location</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">{showBin ? "Deleted at" : "Payment"}</th>
              <th className="text-right p-3">Total</th>
              <th className="text-right p-3">Paid</th>
              <th className="text-right p-3">Due</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">{showBin ? "Recycle bin is empty." : "No purchases found."}</td></tr>
            ) : (
              rows.map((r) => {
                const due = Number(r.final_total || 0) - Number(r.total_paid || 0);
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap">{formatDate(r.transaction_date)}</td>
                    <td className="p-3 font-mono text-xs">{r.ref_no ?? "—"}</td>
                    <td className="p-3">{r.contact?.name ?? "—"}</td>
                    <td className="p-3">{r.location?.name ?? "—"}</td>
                    <td className="p-3 capitalize">{r.status}</td>
                    <td className="p-3 capitalize whitespace-nowrap">
                      {showBin ? (r.deleted_at ? formatDateTime(r.deleted_at) : "—") : r.payment_status}
                    </td>
                    <td className="p-3 text-right">{fmt(Number(r.final_total))}</td>
                    <td className="p-3 text-right">{fmt(Number(r.total_paid))}</td>
                    <td className="p-3 text-right">{fmt(due)}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        {showBin ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => restore.mutate(r.id)}
                            >
                              <Undo2 className="h-4 w-4" /> <span className="ml-1 hidden sm:inline">Restore</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => {
                                if (confirm("Permanently delete this purchase? This cannot be undone.")) purge.mutate(r.id);
                              }}
                            >
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button asChild size="sm" variant="ghost"><Link to="/purchases/$id" params={{ id: r.id }}><Eye className="h-4 w-4" /></Link></Button>
                            <Button asChild size="sm" variant="ghost"><Link to="/purchases/$id/edit" params={{ id: r.id }}><Pencil className="h-4 w-4" /></Link></Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => {
                                if (confirm("Delete this purchase? Stock will be reduced and it will move to the recycle bin.")) del.mutate(r.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

