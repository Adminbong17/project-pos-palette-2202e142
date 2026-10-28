import { checkIsSuperAdmin } from "@/lib/super-admin-auth";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Super-admin view of every credit purchase made through a payment gateway
 * (bKash) as well as manual payment-link top-ups, so the platform admin can
 * see exactly which user bought how many credits and how much they paid.
 */
export const listCreditPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isSuper = await checkIsSuperAdmin(context);
    if (!isSuper) throw new Error("Only the platform admin can do this");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: orders }, { data: businesses }, { data: members }] = await Promise.all([
      supabaseAdmin
        .from("rx_credit_orders")
        .select(
          "id, business_id, user_id, amount, credits, rate_per_credit, method, gateway, payment_id, txn_ref, payer_name, payer_phone, status, bill_id, paid_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      supabaseAdmin.from("businesses").select("id, name").order("name"),
      supabaseAdmin.from("business_users").select("user_id, business_id, is_active"),
    ]);

    const activeBusinessIds = new Set(
      (members ?? []).filter((m: any) => m.is_active !== false).map((m: any) => m.business_id as string),
    );
    const nameById = new Map(((businesses ?? []) as any[]).map((b) => [b.id as string, b.name as string]));

    const rows = ((orders ?? []) as any[]).filter((o) => activeBusinessIds.has(o.business_id));

    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
    let userById = new Map<string, { name: string; email: string }>();
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email, first_name, last_name, doctor_name")
        .in("id", userIds);
      userById = new Map(
        (profiles ?? []).map((p: any) => [
          p.id as string,
          {
            name:
              (p.doctor_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || p.id) as string,
            email: (p.email ?? "") as string,
          },
        ]),
      );
    }

    const purchases = rows.map((r) => {
      const u = r.user_id ? userById.get(r.user_id) : undefined;
      return {
        ...r,
        amount: Number(r.amount ?? 0),
        credits: Number(r.credits ?? 0),
        rate_per_credit: Number(r.rate_per_credit ?? 0),
        business_name: nameById.get(r.business_id) ?? "—",
        buyer_name: u?.name ?? (r.user_id ? "Doctor" : "Clinic pool"),
        buyer_email: u?.email ?? "",
        channel: r.gateway ? `Gateway (${r.gateway})` : `Manual (${r.method ?? "—"})`,
        kind: r.bill_id ? "Bill payment" : "Credit purchase",
      };
    });

    const approved = purchases.filter((p) => p.status === "approved");
    const totals = {
      orders: purchases.length,
      approved: approved.length,
      pending: purchases.filter((p) => p.status === "pending").length,
      amount: approved.reduce((s, p) => s + p.amount, 0),
      credits: approved.reduce((s, p) => s + (p.bill_id ? 0 : p.credits), 0),
      gatewayAmount: approved.filter((p) => p.gateway).reduce((s, p) => s + p.amount, 0),
    };

    // per buyer summary
    const map = new Map<string, any>();
    for (const p of approved) {
      const key = `${p.business_id}:${p.user_id ?? "pool"}`;
      const cur =
        map.get(key) ??
        {
          key,
          business_name: p.business_name,
          buyer_name: p.buyer_name,
          buyer_email: p.buyer_email,
          credits: 0,
          amount: 0,
          count: 0,
          last_at: p.paid_at ?? p.created_at,
        };
      cur.credits += p.bill_id ? 0 : p.credits;
      cur.amount += p.amount;
      cur.count += 1;
      map.set(key, cur);
    }

    return {
      purchases,
      totals,
      buyers: Array.from(map.values()).sort((a, b) => b.amount - a.amount),
    };
  });
