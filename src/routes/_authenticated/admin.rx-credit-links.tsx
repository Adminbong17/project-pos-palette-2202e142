import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link2, Copy, Search, Check, X } from "lucide-react";

import { useIsSuperAdmin } from "@/hooks/use-super-admin";
import { supabase } from "@/integrations/supabase/client";
import {
  listCreditLinks,
  createCreditLink,
  setCreditLinkActive,
  reviewCreditOrder,
} from "@/lib/rx-credit-links.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/rx-credit-links")({
  head: () => ({
    meta: [
      { title: "Credit Purchase Links — QweekRx Admin" },
      {
        name: "description",
        content:
          "Create manual bKash/Nagad/bank credit purchase links for clinics and independent doctors and approve their top-up requests.",
      },
      { property: "og:title", content: "Credit Purchase Links — QweekRx Admin" },
      {
        property: "og:description",
        content: "Generate credit payment links and approve manual top-up payments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminCreditLinksPage,
});

function AdminCreditLinksPage() {
  const { isSuperAdmin, isLoading } = useIsSuperAdmin();
  const qc = useQueryClient();
  const load = useServerFn(listCreditLinks);
  const create = useServerFn(createCreditLink);
  const toggle = useServerFn(setCreditLinkActive);
  const review = useServerFn(reviewCreditOrder);

  const [businessId, setBusinessId] = useState("");
  const [userId, setUserId] = useState("");
  const [rate, setRate] = useState("3");
  const [label, setLabel] = useState("");
  const [search, setSearch] = useState("");

  const data = useQuery({
    queryKey: ["credit-links"],
    enabled: isSuperAdmin,
    queryFn: async () => await load({ data: undefined as never }),
  });

  const members = useQuery({
    queryKey: ["credit-link-members", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: bu } = await supabase
        .from("business_users")
        .select("user_id")
        .eq("business_id", businessId)
        .eq("is_active", true);
      const ids = (bu ?? []).map((b) => b.user_id);
      if (!ids.length) return [] as { id: string; label: string }[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, doctor_name")
        .in("id", ids);
      return (profiles ?? []).map((p: any) => ({
        id: p.id as string,
        label:
          p.doctor_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || p.id,
      }));
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["credit-links"] });

  const add = useMutation({
    mutationFn: async () =>
      await create({
        data: {
          business_id: businessId,
          user_id: userId || null,
          rate_per_credit: Number(rate) || 3,
          label,
        },
      }),
    onSuccess: () => {
      toast.success("Payment link created");
      setLabel("");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create link"),
  });

  const flip = useMutation({
    mutationFn: async (vars: { id: string; active: boolean }) => await toggle({ data: vars }),
    onSuccess: refresh,
    onError: (e: any) => toast.error(e?.message ?? "Could not update link"),
  });

  const decide = useMutation({
    mutationFn: async (vars: { id: string; action: "approve" | "reject" }) =>
      await review({ data: vars }),
    onSuccess: (res: any) => {
      toast.success(res.credited ? `${res.credited} credit(s) added` : "Request rejected");
      refresh();
      qc.invalidateQueries({ queryKey: ["clinic-credits"] });
      qc.invalidateQueries({ queryKey: ["rx-billing-state"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not review request"),
  });

  const q = search.trim().toLowerCase();
  const match = (r: any) =>
    !q ||
    [r.business_name, r.target_name, r.token, r.txn_ref, r.payer_phone, r.payer_name]
      .filter(Boolean)
      .some((v: string) => String(v).toLowerCase().includes(q));

  const links = useMemo(() => (data.data?.links ?? []).filter(match), [data.data, q]);
  const orders = useMemo(() => (data.data?.orders ?? []).filter(match), [data.data, q]);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isSuperAdmin)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        This page is only available to the platform admin.
      </div>
    );

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-xl font-semibold sm:text-2xl">Credit purchase links</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate a payment link for a clinic pool or an independent doctor. They pay by
          bKash/Nagad/bank, you approve, credits are added automatically.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" /> New link
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium">
            Clinic / business
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={businessId}
              onChange={(e) => {
                setBusinessId(e.target.value);
                setUserId("");
              }}
            >
              <option value="">Select…</option>
              {(data.data?.businesses ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Target
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Clinic credit pool</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} (doctor)
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Rate per credit (tk)
            <Input
              className="mt-1"
              inputMode="numeric"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium">
            Payment instructions (shown on the link)
            <Input
              className="mt-1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="bKash personal: 01712472839 (Send Money)"
            />
          </label>
          <div className="sm:col-span-2">
            <Button disabled={!businessId || add.isPending} onClick={() => add.mutate()}>
              {add.isPending ? "Creating…" : "Create link"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search clinic, doctor, code, txn…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">No links yet.</p>
          ) : (
            links.map((l: any) => {
              const url = `${origin}/rx-pay/${l.token}`;
              return (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {l.business_name} · {l.target_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{url}</p>
                  </div>
                  <Badge variant="secondary">{Number(l.rate_per_credit)} tk/credit</Badge>
                  <Badge variant={l.active ? "default" : "outline"}>
                    {l.active ? "Active" : "Closed"}
                  </Badge>
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => flip.mutate({ id: l.id, active: !l.active })}
                  >
                    {l.active ? "Close" : "Reopen"}
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Payment requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment requests yet.</p>
          ) : (
            orders.map((o: any) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {o.business_name} · {o.target_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {Number(o.amount)} tk → {o.credits} credit(s) · {String(o.method).toUpperCase()} ·{" "}
                    {o.txn_ref} · {o.payer_name || "—"} {o.payer_phone || ""}
                  </p>
                </div>
                <Badge
                  variant={
                    o.status === "paid" ? "default" : o.status === "rejected" ? "outline" : "secondary"
                  }
                >
                  {o.status}
                </Badge>
                {o.status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: o.id, action: "approve" })}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: o.id, action: "reject" })}
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Reject
                    </Button>
                  </>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
