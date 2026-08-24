import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPER_ADMIN_EMAIL = "admin@bongbangla.top";

function assertSuperAdmin(claims: any) {
  const email = String(claims?.email ?? "").toLowerCase();
  if (email !== SUPER_ADMIN_EMAIL) throw new Error("Only the platform super admin can do this");
}

/** Every doctor on the platform (all businesses/clinics) + billing accounts, month counts and bills. */
export const listRxBillingAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertSuperAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: businesses }, { data: roles }, { data: userRoles }, { data: members }] =
      await Promise.all([
        supabaseAdmin.from("businesses").select("id, name"),
        supabaseAdmin.from("roles").select("id, name, business_id"),
        supabaseAdmin.from("user_roles").select("user_id, role_id, business_id"),
        supabaseAdmin.from("business_users").select("user_id, business_id, is_active"),
      ]);

    const bizName = new Map((businesses ?? []).map((b: any) => [b.id, b.name as string]));
    const roleById = new Map((roles ?? []).map((r: any) => [r.id, String(r.name ?? "")]));

    const doctorRows = (userRoles ?? []).filter((ur: any) =>
      (roleById.get(ur.role_id) ?? "").startsWith("Doctor"),
    );
    const activeSet = new Set(
      (members ?? [])
        .filter((m: any) => m.is_active !== false)
        .map((m: any) => `${m.user_id}:${m.business_id}`),
    );

    const ids = Array.from(new Set(doctorRows.map((r: any) => r.user_id)));
    const { data: profiles } = ids.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, email, first_name, last_name, doctor_name")
          .in("id", ids)
      : { data: [] as any[] };
    const profById = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const doctors = doctorRows
      .filter((r: any) => activeSet.has(`${r.user_id}:${r.business_id}`))
      .map((r: any) => {
        const p = profById.get(r.user_id);
        return {
          id: r.user_id as string,
          business_id: r.business_id as string,
          business_name: bizName.get(r.business_id) ?? "—",
          label:
            p?.doctor_name ||
            [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
            p?.email ||
            r.user_id,
        };
      })
      .sort((a, b) => a.business_name.localeCompare(b.business_name) || a.label.localeCompare(b.label));

    const [{ data: accounts }, { data: bills }] = await Promise.all([
      supabaseAdmin
        .from("rx_billing_accounts")
        .select("id, business_id, user_id, mode, credits, phone, phone_verified_at, payment_link, helpline"),
      supabaseAdmin
        .from("rx_bills")
        .select("id, business_id, user_id, period_start, prescriptions_count, amount, status, due_date, payment_link")
        .order("period_start", { ascending: false })
        .limit(200),
    ]);

    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const { data: rx } = await supabaseAdmin
      .from("prescriptions")
      .select("created_by")
      .gte("created_at", start.toISOString())
      .limit(20000);
    const counts: Record<string, number> = {};
    for (const r of rx ?? []) {
      const k = (r as any).created_by ?? "unknown";
      counts[k] = (counts[k] ?? 0) + 1;
    }

    return { doctors, accounts: accounts ?? [], bills: bills ?? [], counts };
  });

/** Create/update a doctor's (or a business pool's) billing account from the super-admin page. */
export const saveRxBillingAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    business_id: string;
    user_id: string | null;
    patch: Record<string, unknown>;
  }) => {
    if (!input?.business_id) throw new Error("business_id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("rx_billing_accounts")
      .select("id")
      .eq("business_id", data.business_id);
    q = data.user_id ? q.eq("user_id", data.user_id) : q.is("user_id", null);
    const { data: existing } = await q.maybeSingle();

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("rx_billing_accounts")
        .update(data.patch as never)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: created, error } = await supabaseAdmin
      .from("rx_billing_accounts")
      .insert({
        business_id: data.business_id,
        user_id: data.user_id,
        mode: "credit",
        credits: 0,
        ...data.patch,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (created as any).id as string };
  });

/** Add / remove prescription credits for a billing account. */
export const grantRxCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { account_id: string; delta: number }) => {
    if (!input?.account_id) throw new Error("account_id required");
    return { account_id: input.account_id, delta: Number(input.delta) || 0 };
  })
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("rx_grant_credits", {
      _account_id: data.account_id,
      _delta: data.delta,
      _reason: data.delta >= 0 ? "admin top-up" : "admin deduction",
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Mark a monthly bill paid/waived or attach a payment link. */
export const patchRxBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; patch: Record<string, unknown> }) => {
    if (!input?.id) throw new Error("id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("rx_bills")
      .update(data.patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
