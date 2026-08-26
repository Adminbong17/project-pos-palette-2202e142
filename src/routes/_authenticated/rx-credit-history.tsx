import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Search, Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

import { useCurrentBusiness } from "@/hooks/use-current-business";
import { getRxCreditHistory } from "@/lib/rx-credit-history.functions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FoldTable } from "@/components/fold-table";

export const Route = createFileRoute("/_authenticated/rx-credit-history")({
  head: () => ({
    meta: [
      { title: "Rx Credit & Payment History — QweekRx" },
      {
        name: "description",
        content:
          "Full audit trail of prescription credit purchases, approvals, rejections, clinic grants and per-prescription credit usage for every doctor and clinic pool.",
      },
      { property: "og:title", content: "Rx Credit & Payment History — QweekRx" },
      {
        property: "og:description",
        content: "Track every credit payment approval, rejection and balance change.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RxCreditHistoryPage,
});

function when(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: string) {
  const cls =
    status === "paid"
      ? "bg-primary/10 text-primary"
      : status === "rejected"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  const label = status === "paid" ? "approved" : status;
  return <span className={`rounded px-1.5 py-0.5 text-xs capitalize ${cls}`}>{label}</span>;
}

function RxCreditHistoryPage() {
  const { data: business } = useCurrentBusiness();
  const load = useServerFn(getRxCreditHistory);
  const [account, setAccount] = useState<string>("all");
  const [search, setSearch] = useState("");

  const history = useQuery({
    queryKey: ["rx-credit-history", business?.id],
    enabled: !!business?.id,
    queryFn: async () => await load({ data: { business_id: business!.id } }),
  });

  const accounts = history.data?.accounts ?? [];
  const selected = accounts.find((a) => a.id === account);
  const q = search.trim().toLowerCase();

  const orders = useMemo(() => {
    let rows = history.data?.orders ?? [];
    if (selected) rows = rows.filter((o) => (o.user_id ?? null) === selected.user_id);
    if (!q) return rows;
    return rows.filter((o) =>
      [o.target, o.method, o.txn_ref, o.payer_name, o.payer_phone, o.status, o.notes, o.amount, o.credits]
        .some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [history.data, selected, q]);

  const ledger = useMemo(() => {
    let rows = history.data?.ledger ?? [];
    if (selected) rows = rows.filter((l) => l.account_id === selected.id);
    if (!q) return rows;
    return rows.filter((l) =>
      [l.account_label, l.reason, l.actor, l.delta].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [history.data, selected, q]);

  const approved = orders.filter((o) => o.status === "paid");
  const totals = {
    paidMoney: approved.reduce((s, o) => s + o.amount, 0),
    paidCredits: approved.reduce((s, o) => s + o.credits, 0),
    pending: orders.filter((o) => o.status === "pending").length,
    rejected: orders.filter((o) => o.status === "rejected").length,
    used: ledger.filter((l) => l.delta < 0).reduce((s, l) => s + Math.abs(l.delta), 0),
  };

  const cards = [
    { label: "Paid (৳)", value: totals.paidMoney.toFixed(2), icon: Wallet },
    { label: "Credits bought", value: totals.paidCredits.toLocaleString(), icon: ArrowUpCircle },
    { label: "Credits spent", value: totals.used.toLocaleString(), icon: ArrowDownCircle },
    { label: "Pending / Rejected", value: `${totals.pending} / ${totals.rejected}`, icon: History },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Rx Credit &amp; Payment History</h1>
          <p className="text-sm text-muted-foreground">
            Every top-up request, approval, rejection and credit change · {business?.name ?? "—"}
          </p>
        </div>
        <Link
          to="/rx-billing"
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
        >
          Rx Billing
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {history.data?.can_see_all && (
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Account</label>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="h-9 rounded-lg border border-border bg-input px-3 text-sm"
            >
              <option value="all">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} · {a.credits} credit(s)
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="relative min-w-[200px] flex-1">
          <label className="mb-1.5 block text-xs text-muted-foreground">Search</label>
          <Search className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-muted-foreground" />
          <Input
            className="h-9 pl-9 text-sm"
            placeholder="Txn ref, doctor, method, reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 font-display text-2xl font-semibold">
              {history.isLoading ? "…" : c.value}
            </div>
          </div>
        ))}
      </div>

      {history.data?.can_see_all && accounts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current balances</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <Badge key={a.id} variant="secondary" className="text-xs">
                {a.label}: {a.credits} credit(s)
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Payments &amp; approvals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment requests yet.</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <FoldTable className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Account</th>
                      <th className="px-2 py-2">Method</th>
                      <th className="px-2 py-2">Txn ref</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2 text-right">Credits</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Reviewed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-border/40 align-top">
                        <td className="whitespace-nowrap px-2 py-2 text-xs">{when(o.created_at)}</td>
                        <td className="px-2 py-2">{o.target}</td>
                        <td className="px-2 py-2 capitalize">{o.method ?? "—"}</td>
                        <td className="px-2 py-2 font-mono text-xs">{o.txn_ref ?? "—"}</td>
                        <td className="px-2 py-2 text-right">৳{o.amount.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right">{o.credits}</td>
                        <td className="px-2 py-2">{statusBadge(o.status)}</td>
                        <td className="px-2 py-2 text-xs text-muted-foreground">
                          {o.reviewed_by ? `${o.reviewed_by}${o.paid_at ? ` · ${when(o.paid_at)}` : ""}` : "—"}
                          {o.notes ? <div className="italic">{o.notes}</div> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </FoldTable>
              </div>
              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {orders.map((o) => (
                  <div key={o.id} className="rounded-lg border border-border/60 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{o.target}</span>
                      {statusBadge(o.status)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{when(o.created_at)}</span>
                      <span className="capitalize">{o.method ?? "—"}</span>
                      <span className="font-mono">{o.txn_ref ?? "—"}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                      <span className="font-semibold">৳{o.amount.toFixed(2)}</span>
                      <span>{o.credits} credit(s)</span>
                      {o.reviewed_by && <span className="text-muted-foreground">by {o.reviewed_by}</span>}
                    </div>
                    {o.notes && <p className="mt-1 text-xs italic text-muted-foreground">{o.notes}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Credit balance changes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">No credit movement yet.</p>
          ) : (
            ledger.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">{l.account_label}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.reason || "—"} · {l.actor}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{when(l.created_at)}</span>
                  <span
                    className={`font-semibold ${l.delta >= 0 ? "text-primary" : "text-destructive"}`}
                  >
                    {l.delta >= 0 ? "+" : ""}
                    {l.delta}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
