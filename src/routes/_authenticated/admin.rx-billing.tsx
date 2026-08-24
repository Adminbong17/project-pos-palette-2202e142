import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wallet, Receipt, CalendarClock, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";
import { rxTierAmount, rxTierRate } from "@/hooks/use-rx-billing";
import {
  listRxBillingAll,
  saveRxBillingAccount,
  grantRxCredits,
  patchRxBill,
} from "@/lib/rx-billing-admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DoctorRow = { id: string; label: string; business_id: string; business_name: string };

export const Route = createFileRoute("/_authenticated/admin/rx-billing")({
  head: () => ({
    meta: [
      { title: "Rx Billing Management — QweekRx Admin" },
      {
        name: "description",
        content:
          "Give doctors prescription credits, switch between credit, subscription and free plans, set payment links and close monthly prescription bills.",
      },
      { property: "og:title", content: "Rx Billing Management — QweekRx Admin" },
      {
        property: "og:description",
        content: "Credits, subscription tiers, payment links and monthly prescription bills.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminRxBillingPage,
});

type Account = {
  id: string;
  business_id: string;
  user_id: string | null;
  mode: "credit" | "subscription" | "free";
  credits: number;
  phone: string | null;
  phone_verified_at: string | null;
  payment_link: string | null;
  helpline: string | null;
};

function AdminRxBillingPage() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin, isLoading: roleLoading } = useCurrentRole();
  const { isSuperAdmin } = useIsSuperAdmin();
  const businessId = business?.id;
  const qc = useQueryClient();
  const [month, setMonth] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [billSearch, setBillSearch] = useState("");

  const accounts = useQuery({
    queryKey: ["rx-billing-accounts", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rx_billing_accounts")
        .select("id, business_id, user_id, mode, credits, phone, phone_verified_at, payment_link, helpline")
        .eq("business_id", businessId!);
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  const doctors = useQuery({
    queryKey: ["rx-billing-doctors", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: bus } = await supabase
        .from("business_users")
        .select("user_id")
        .eq("business_id", businessId!)
        .eq("is_active", true);
      const ids = (bus ?? []).map((b) => b.user_id);
      if (!ids.length) return [] as { id: string; label: string }[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, doctor_name")
        .in("id", ids);
      return (profiles ?? []).map((p: any) => ({
        id: p.id,
        label:
          p.doctor_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || p.id,
      }));
    },
  });

  const counts = useQuery({
    queryKey: ["rx-billing-counts", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("prescriptions")
        .select("created_by")
        .eq("business_id", businessId!)
        .gte("created_at", start.toISOString())
        .limit(5000);
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        const k = (r as any).created_by ?? "unknown";
        map[k] = (map[k] ?? 0) + 1;
      }
      return map;
    },
  });

  const bills = useQuery({
    queryKey: ["rx-bills-admin", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rx_bills")
        .select("id, user_id, period_start, prescriptions_count, amount, status, due_date, payment_link")
        .eq("business_id", businessId!)
        .order("period_start", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // The platform owner manages every doctor of every business/clinic, not just their own.
  const loadAll = useServerFn(listRxBillingAll);
  const all = useQuery({
    queryKey: ["rx-billing-all"],
    enabled: isSuperAdmin,
    queryFn: () => loadAll({}),
  });

  const doctorList: DoctorRow[] = isSuperAdmin
    ? ((all.data?.doctors ?? []) as DoctorRow[])
    : (doctors.data ?? []).map((d) => ({
        ...d,
        business_id: businessId ?? "",
        business_name: business?.name ?? "",
      }));
  const accountList: Account[] = isSuperAdmin
    ? ((all.data?.accounts ?? []) as Account[])
    : accounts.data ?? [];
  const billList: any[] = isSuperAdmin ? (all.data?.bills ?? []) : bills.data ?? [];
  const countMap: Record<string, number> = (isSuperAdmin ? all.data?.counts : counts.data) ?? {};
  const listLoading = isSuperAdmin ? all.isLoading : doctors.isLoading;
  const billsLoading = isSuperAdmin ? all.isLoading : bills.isLoading;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["rx-billing-accounts", businessId] });
    qc.invalidateQueries({ queryKey: ["rx-bills-admin", businessId] });
    qc.invalidateQueries({ queryKey: ["rx-billing-all"] });
    qc.invalidateQueries({ queryKey: ["rx-billing-state"] });
  };

  const saveAccountFn = useServerFn(saveRxBillingAccount);
  const grantFn = useServerFn(grantRxCredits);
  const patchBillFn = useServerFn(patchRxBill);

  const upsertAccount = useMutation({
    mutationFn: async (
      row: Partial<Account> & { user_id: string | null; business_id?: string },
    ) => {
      const { business_id, user_id, ...patch } = row;
      const target = business_id || businessId;
      if (!target) throw new Error("No business");
      if (isSuperAdmin) {
        await saveAccountFn({ data: { business_id: target, user_id, patch } });
        return;
      }
      const existing = accountList.find((a) => a.user_id === user_id);
      if (existing) {
        const { error } = await (supabase as any)
          .from("rx_billing_accounts")
          .update(patch)
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any)
        .from("rx_billing_accounts")
        .insert({ business_id: target, user_id, mode: "credit", credits: 0, ...patch });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  const grant = useMutation({
    mutationFn: async ({ accountId, delta }: { accountId: string; delta: number }) => {
      if (isSuperAdmin) {
        await grantFn({ data: { account_id: accountId, delta } });
        return;
      }
      const { error } = await (supabase as any).rpc("rx_grant_credits", {
        _account_id: accountId,
        _delta: delta,
        _reason: delta >= 0 ? "admin top-up" : "admin deduction",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credits updated");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update credits"),
  });

  const closeMonth = useMutation({
    mutationFn: async () => {
      const _month = month ? `${month}-01` : null;
      const { data, error } = await (supabase as any).rpc("rx_close_month", { _month });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`${n} bill(s) generated`);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not close the month"),
  });

  const setBill = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      if (isSuperAdmin) {
        await patchBillFn({ data: { id, patch } });
        return;
      }
      const { error } = await (supabase as any).from("rx_bills").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bill updated");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update the bill"),
  });


  const pool =
    accountList.find((a) => a.user_id === null && (!businessId || a.business_id === businessId)) ??
    null;
  const byUser = new Map(
    accountList.filter((a) => a.user_id).map((a) => [`${a.user_id}:${a.business_id}`, a]),
  );
  const accOf = (d: DoctorRow) => byUser.get(`${d.id}:${d.business_id}`) ?? null;

  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    if (!q) return doctorList;
    return doctorList.filter((d) => {
      const acc = byUser.get(`${d.id}:${d.business_id}`);
      return [d.label, d.business_name, acc?.mode, acc?.phone, acc?.payment_link, acc?.helpline]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ")
        .includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorList, doctorSearch, accountList]);

  const filteredBills = useMemo(() => {
    const q = billSearch.trim().toLowerCase();
    if (!q) return billList;
    return billList.filter((b) => {
      const label = b.user_id
        ? doctorList.find((d) => d.id === b.user_id)?.label ?? "Doctor"
        : "Whole clinic";
      return [label, String(b.period_start).slice(0, 7), b.prescriptions_count, b.amount, b.status, b.due_date]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ")
        .includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billList, billSearch, doctorList]);

  if (!roleLoading && !isAdmin) {
    return (
      <div className="p-6">
        <h1 className="font-display text-xl font-semibold">Rx Billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only business admins can open this page.</p>
      </div>
    );
  }



  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Rx Billing Management</h1>
        <p className="text-sm text-muted-foreground">
          Credit mode: 1 credit = 1 prescription. Subscription mode: first 100 prescriptions of a
          month ৳5 each, above 100 the whole month becomes ৳4 each, above 200 ৳3 each. Bills are due
          on the 5th of the next month — after that the doctor is locked until payment. Free mode is
          never charged or locked.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" /> Clinic-wide pool (fallback for every doctor)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AccountEditor
            label="Whole clinic"
            account={pool}
            monthCount={Object.values(countMap).reduce((a, b) => a + b, 0)}
            onSave={(patch) => upsertAccount.mutate({ user_id: null, ...patch })}
            onGrant={(delta) =>
              pool ? grant.mutate({ accountId: pool.id, delta }) : toast.error("Create the pool first")
            }
            busy={upsertAccount.isPending || grant.isPending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" /> Per-doctor accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search doctors…" value={doctorSearch} onChange={(e) => setDoctorSearch(e.target.value)} />
          </div>
          {listLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !doctorList.length ? (
            <p className="text-sm text-muted-foreground">No doctors found.</p>
          ) : filteredDoctors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No match</p>
          ) : (
            filteredDoctors.map((d) => (
              <AccountEditor
                key={`${d.id}:${d.business_id}`}
                label={d.business_name ? `${d.label} — ${d.business_name}` : d.label}
                account={accOf(d)}
                monthCount={countMap[d.id] ?? 0}
                onSave={(patch) =>
                  upsertAccount.mutate({ user_id: d.id, business_id: d.business_id, ...patch })
                }
                onGrant={(delta) => {
                  const acc = accOf(d);
                  if (!acc) toast.error("Save the account first");
                  else grant.mutate({ accountId: acc.id, delta });
                }}
                busy={upsertAccount.isPending || grant.isPending}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" /> Monthly bills
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="month"
              className="h-9 w-40 text-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <Button size="sm" disabled={closeMonth.isPending} onClick={() => closeMonth.mutate()}>
              <CalendarClock className="mr-1 h-4 w-4" />
              Generate bills {month ? `for ${month}` : "for last month"}
            </Button>
            <span className="text-xs text-muted-foreground">
              (super admin only — subscription accounts)
            </span>
          </div>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search bills…" value={billSearch} onChange={(e) => setBillSearch(e.target.value)} />
          </div>
          {billsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !billList.length ? (
            <p className="text-sm text-muted-foreground">No bills generated yet.</p>
          ) : filteredBills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No match</p>
          ) : (
            filteredBills.map((b) => (
              <BillRow
                key={b.id}
                bill={b}
                label={
                  b.user_id
                    ? doctorList.find((d) => d.id === b.user_id)?.label ?? "Doctor"
                    : "Whole clinic"
                }
                busy={setBill.isPending}
                onPatch={(patch) => setBill.mutate({ id: b.id, patch })}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AccountEditor({
  label,
  account,
  monthCount,
  onSave,
  onGrant,
  busy,
}: {
  label: string;
  account: Account | null;
  monthCount: number;
  onSave: (patch: Partial<Account>) => void;
  onGrant: (delta: number) => void;
  busy: boolean;
}) {
  const [mode, setMode] = useState<Account["mode"]>(account?.mode ?? "credit");
  const [link, setLink] = useState(account?.payment_link ?? "");
  const [helpline, setHelpline] = useState(account?.helpline ?? "");
  const [topUp, setTopUp] = useState("");

  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-xs text-muted-foreground">
            {account
              ? `${account.credits} credit(s) · ${monthCount} Rx this month · ৳${rxTierAmount(
                  monthCount,
                )} (৳${rxTierRate(monthCount)}/Rx)`
              : "No billing account yet"}
            {account?.phone && ` · ${account.phone}${account.phone_verified_at ? " ✓" : " (unverified)"}`}
          </div>
        </div>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as Account["mode"])}
          className="h-9 rounded-lg border border-border bg-input px-2 text-sm"
        >
          <option value="credit">Credit (prepaid)</option>
          <option value="subscription">Subscription (monthly bill)</option>
          <option value="free">Free</option>
        </select>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input
          className="h-9 text-sm"
          placeholder="Payment link (bKash / invoice URL)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <Input
          className="h-9 text-sm"
          placeholder="Helpline number (default 01712472839)"
          value={helpline}
          onChange={(e) => setHelpline(e.target.value)}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            onSave({
              mode,
              payment_link: link.trim() || null,
              helpline: helpline.trim() || null,
            })
          }
        >
          {account ? "Save" : "Create account"}
        </Button>
        <Input
          className="h-9 w-28 text-sm"
          placeholder="Credits"
          inputMode="numeric"
          value={topUp}
          onChange={(e) => setTopUp(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !topUp}
          onClick={() => {
            const n = Number(topUp);
            if (!Number.isFinite(n) || n === 0) return;
            onGrant(Math.round(n));
            setTopUp("");
          }}
        >
          Add credits
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !topUp}
          onClick={() => {
            const n = Number(topUp);
            if (!Number.isFinite(n) || n === 0) return;
            onGrant(-Math.round(n));
            setTopUp("");
          }}
        >
          Deduct
        </Button>
      </div>
    </div>
  );
}

function BillRow({
  bill,
  label,
  busy,
  onPatch,
}: {
  bill: any;
  label: string;
  busy: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const [link, setLink] = useState(bill.payment_link ?? "");
  return (
    <div className="rounded-md border border-border/60 p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{String(bill.period_start).slice(0, 7)}</span>
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{bill.prescriptions_count} Rx</span>
        <span className="font-semibold">৳{bill.amount}</span>
        <span className="text-xs text-muted-foreground">due {bill.due_date}</span>
        <span
          className={
            bill.status === "paid"
              ? "rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
              : bill.status === "waived"
                ? "rounded bg-muted px-1.5 py-0.5 text-xs"
                : "rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive"
          }
        >
          {bill.status}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          className="h-8 flex-1 text-xs"
          placeholder="Payment link for this bill"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onPatch({ payment_link: link.trim() || null })}
        >
          Save link
        </Button>
        {bill.status !== "paid" && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onPatch({ status: "paid", paid_at: new Date().toISOString() })}
          >
            Mark paid
          </Button>
        )}
        {bill.status === "unpaid" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onPatch({ status: "waived" })}>
            Waive (free)
          </Button>
        )}
      </div>
    </div>
  );
}
