import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Full payment + credit audit trail for one clinic pool / doctor account.
 *
 * - Super admin and the clinic (business) admin see every account of the business.
 * - A doctor / assistant only sees their own account.
 *
 * "Payments" are the manual top-up requests (rx_credit_orders) with their
 * approval / rejection outcome; "credit changes" are the ledger rows
 * (rx_credit_ledger): grants, pull-backs and per-prescription charges.
 */

function personName(p: any) {
  return (
    (p?.doctor_name ?? "").trim() ||
    [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() ||
    p?.email ||
    "User"
  );
}

export const getRxCreditHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { business_id: string }) => {
    if (!input?.business_id) throw new Error("business_id required");
    return { business_id: input.business_id };
  })
  .handler(async ({ data, context }) => {
    const [{ data: isSuper }, { data: isAdmin }] = await Promise.all([
      context.supabase.rpc("is_super_admin", { _user_id: context.userId }),
      context.supabase.rpc("is_business_admin", {
        _user_id: context.userId,
        _business_id: data.business_id,
      }),
    ]);
    const canSeeAll = !!isSuper || !!isAdmin;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let accQuery = supabaseAdmin
      .from("rx_billing_accounts")
      .select("id, user_id, mode, credits, phone, created_at")
      .eq("business_id", data.business_id);
    if (!canSeeAll) accQuery = accQuery.eq("user_id", context.userId);
    const { data: accountRows, error: accErr } = await accQuery;
    if (accErr) throw new Error(accErr.message);

    const accounts = (accountRows ?? []) as any[];
    const accountIds = accounts.map((a) => a.id as string);
    const userIds = accounts.map((a) => a.user_id).filter(Boolean) as string[];

    let ordersQuery = supabaseAdmin
      .from("rx_credit_orders")
      .select(
        "id, business_id, user_id, amount, credits, rate_per_credit, method, payer_name, payer_phone, txn_ref, status, notes, approved_by, paid_at, created_at",
      )
      .eq("business_id", data.business_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!canSeeAll) ordersQuery = ordersQuery.eq("user_id", context.userId);

    const ledgerQuery = accountIds.length
      ? supabaseAdmin
          .from("rx_credit_ledger")
          .select("id, account_id, delta, reason, created_by, created_at")
          .in("account_id", accountIds)
          .order("created_at", { ascending: false })
          .limit(1000)
      : null;

    const [{ data: orderRows, error: ordErr }, ledgerRes] = await Promise.all([
      ordersQuery,
      ledgerQuery ?? Promise.resolve({ data: [], error: null } as any),
    ]);
    if (ordErr) throw new Error(ordErr.message);
    if (ledgerRes?.error) throw new Error(ledgerRes.error.message);

    const orders = (orderRows ?? []) as any[];
    const ledger = (ledgerRes?.data ?? []) as any[];

    const peopleIds = Array.from(
      new Set([
        ...userIds,
        ...orders.map((o) => o.user_id),
        ...orders.map((o) => o.approved_by),
        ...ledger.map((l) => l.created_by),
      ]),
    ).filter(Boolean) as string[];

    const nameById = new Map<string, string>();
    if (peopleIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email, first_name, last_name, doctor_name")
        .in("id", peopleIds);
      for (const p of (profiles ?? []) as any[]) nameById.set(p.id, personName(p));
    }

    const label = (userId: string | null) =>
      userId ? `Dr. ${nameById.get(userId) ?? "Doctor"}` : "Clinic pool";

    const accountLabel = new Map(accounts.map((a) => [a.id as string, label(a.user_id)]));

    return {
      can_see_all: canSeeAll,
      accounts: accounts
        .map((a) => ({
          id: a.id as string,
          user_id: (a.user_id ?? null) as string | null,
          label: label(a.user_id),
          mode: (a.mode ?? "credit") as string,
          credits: Number(a.credits ?? 0),
          created_at: a.created_at as string,
        }))
        .sort((x, y) => (x.user_id === null ? -1 : y.user_id === null ? 1 : x.label.localeCompare(y.label))),
      orders: orders.map((o) => ({
        id: o.id as string,
        target: label(o.user_id ?? null),
        user_id: (o.user_id ?? null) as string | null,
        amount: Number(o.amount ?? 0),
        credits: Number(o.credits ?? 0),
        rate_per_credit: Number(o.rate_per_credit ?? 0),
        method: o.method as string | null,
        payer_name: o.payer_name as string | null,
        payer_phone: o.payer_phone as string | null,
        txn_ref: o.txn_ref as string | null,
        status: o.status as string,
        notes: o.notes as string | null,
        reviewed_by: o.approved_by ? (nameById.get(o.approved_by) ?? "Platform admin") : null,
        paid_at: o.paid_at as string | null,
        created_at: o.created_at as string,
      })),
      ledger: ledger.map((l) => ({
        id: l.id as string,
        account_id: l.account_id as string,
        account_label: accountLabel.get(l.account_id) ?? "Account",
        delta: Number(l.delta ?? 0),
        reason: (l.reason ?? "") as string,
        actor: l.created_by ? (nameById.get(l.created_by) ?? "System") : "System",
        created_at: l.created_at as string,
      })),
    };
  });
