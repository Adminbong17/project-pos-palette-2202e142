import { formatDate, formatDateTime } from "@/lib/utils";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Plus, Truck, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

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

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["purchases", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, ref_no, transaction_date, status, payment_status, final_total, total_paid, contact:contacts(name), location:business_locations(name)"
        )
        .eq("business_id", business!.id)
        .eq("type", "purchase")
        .order("transaction_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseRow[];
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(n || 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Truck className="h-6 w-6" /> Purchases
          </h1>
          <p className="text-sm text-muted-foreground">All stock-in purchase transactions.</p>
        </div>
        <Button asChild>
          <Link to="/purchases/new">
            <Plus className="h-4 w-4 mr-1" /> Add Purchase
          </Link>
        </Button>

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
              <th className="text-left p-3">Payment</th>
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
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No purchases found.</td></tr>
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
                    <td className="p-3 capitalize">{r.payment_status}</td>
                    <td className="p-3 text-right">{fmt(Number(r.final_total))}</td>
                    <td className="p-3 text-right">{fmt(Number(r.total_paid))}</td>
                    <td className="p-3 text-right">{fmt(due)}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button asChild size="sm" variant="ghost"><Link to="/purchases/$id" params={{ id: r.id }}><Eye className="h-4 w-4" /></Link></Button>
                        <Button asChild size="sm" variant="ghost"><Link to="/purchases/$id/edit" params={{ id: r.id }}><Pencil className="h-4 w-4" /></Link></Button>
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
