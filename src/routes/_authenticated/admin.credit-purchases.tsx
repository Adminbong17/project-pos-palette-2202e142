import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fmtDateTime } from "@/lib/format-date";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Wallet } from "lucide-react";

import { useIsSuperAdmin } from "@/hooks/use-super-admin";
import { listCreditPurchases } from "@/lib/admin-credit-purchases.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/credit-purchases")({
  head: () => ({
    meta: [
      { title: "Credit Purchases — QweekRx Admin" },
      {
        name: "description",
        content:
          "See which clinic or doctor bought how many Rx credits through the bKash payment gateway or manual payment links.",
      },
      { property: "og:title", content: "Credit Purchases — QweekRx Admin" },
      {
        property: "og:description",
        content: "Track gateway credit purchases, amounts paid and credits delivered per user.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminCreditPurchasesPage,
});

const money = (n: number) => `৳${Number(n || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
const when = (v?: string | null) =>
  v ? new Date(v).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }) : "—";

function AdminCreditPurchasesPage() {
  const { isSuperAdmin, isLoading } = useIsSuperAdmin();
  const load = useServerFn(listCreditPurchases);
  const [search, setSearch] = useState("");
  const [onlyGateway, setOnlyGateway] = useState(false);

  const q = useQuery({
    queryKey: ["admin-credit-purchases"],
    enabled: isSuperAdmin,
    queryFn: async () => await load({ data: undefined as never }),
  });

  const filtered = useMemo(() => {
    const list = q.data?.purchases ?? [];
    const t = search.trim().toLowerCase();
    return list.filter((p: any) => {
      if (onlyGateway && !p.gateway) return false;
      if (!t) return true;
      return [p.buyer_name, p.buyer_email, p.business_name, p.txn_ref, p.payment_id, p.payer_phone, p.status]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(t));
    });
  }, [q.data, search, onlyGateway]);

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isSuperAdmin)
    return <div className="p-6 text-destructive">Only the platform admin can view credit purchases.</div>;

  const totals = q.data?.totals;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Wallet className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Credit Purchases</h1>
          <p className="text-sm text-muted-foreground">
            Every gateway (bKash) and manual credit payment — who bought, how much and how many credits.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total collected</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{money(totals?.amount ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Via payment gateway</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{money(totals?.gatewayAmount ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Credits sold</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{totals?.credits ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {totals?.approved ?? 0}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              approved / {totals?.pending ?? 0} pending
            </span>
          </CardContent>
        </Card>
      </div>

      <Card foldable>
        <CardHeader>
          <CardTitle>Per user summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Buyer</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data?.buyers ?? []).map((b: any) => (
                <TableRow key={b.key}>
                  <TableCell>
                    <div className="font-medium">{b.buyer_name}</div>
                    <div className="text-xs text-muted-foreground">{b.buyer_email}</div>
                  </TableCell>
                  <TableCell>{b.business_name}</TableCell>
                  <TableCell className="text-right">{b.count}</TableCell>
                  <TableCell className="text-right font-semibold">{b.credits}</TableCell>
                  <TableCell className="text-right">{money(b.amount)}</TableCell>
                </TableRow>
              ))}
              {!(q.data?.buyers ?? []).length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No approved credit payments yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card foldable>
        <CardHeader className="gap-3">
          <CardTitle>All payments</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-64 pl-8"
                placeholder="Search buyer, email, txn / payment id…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyGateway} onChange={(e) => setOnlyGateway(e.target.checked)} />
              Gateway payments only
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-xs">{when(p.paid_at ?? p.created_at)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{p.buyer_name}</div>
                    <div className="text-xs text-muted-foreground">{p.buyer_email || p.payer_phone || ""}</div>
                  </TableCell>
                  <TableCell>{p.business_name}</TableCell>
                  <TableCell className="text-xs">{p.channel}</TableCell>
                  <TableCell className="text-xs">{p.kind}</TableCell>
                  <TableCell className="text-right font-semibold">{p.bill_id ? "—" : p.credits}</TableCell>
                  <TableCell className="text-right">{p.rate_per_credit || "—"}</TableCell>
                  <TableCell className="text-right">{money(p.amount)}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs">{p.payment_id || p.txn_ref || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        p.status === "approved" ? "default" : p.status === "pending" ? "secondary" : "destructive"
                      }
                    >
                      {p.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    {q.isLoading ? "Loading…" : "No payments found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
