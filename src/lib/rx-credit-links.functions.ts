import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Manual credit purchase links.
 *
 * The platform (super) admin creates a link for one clinic pool or one
 * independent doctor. The clinic/doctor opens the public link, types how much
 * money they are sending (30tk = 10 credits at 3tk each), pays by
 * bKash/Nagad/bank and submits the transaction reference. The super admin
 * approves the request and the credits land on that account automatically.
 */

function makeToken() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function assertSuperAdmin(context: any) {
  const { data, error } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only the platform admin can do this");
}

/* ------------------------------- admin side ------------------------------- */

export const listCreditLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: links }, { data: orders }, { data: businesses }] = await Promise.all([
      supabaseAdmin
        .from("rx_credit_links")
        .select("id, token, business_id, user_id, label, rate_per_credit, active, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("rx_credit_orders")
        .select(
          "id, link_id, business_id, user_id, amount, credits, rate_per_credit, method, payer_name, payer_phone, txn_ref, status, notes, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin.from("businesses").select("id, name").order("name"),
    ]);

    const nameById = new Map((businesses ?? []).map((b: any) => [b.id, b.name as string]));
    const userIds = Array.from(
      new Set([
        ...(links ?? []).map((l: any) => l.user_id),
        ...(orders ?? []).map((o: any) => o.user_id),
      ]),
    ).filter(Boolean) as string[];

    let doctorById = new Map<string, string>();
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email, first_name, last_name, doctor_name")
        .in("id", userIds);
      doctorById = new Map(
        (profiles ?? []).map((p: any) => [
          p.id as string,
          (p.doctor_name ||
            [p.first_name, p.last_name].filter(Boolean).join(" ") ||
            p.email ||
            p.id) as string,
        ]),
      );
    }

    const decorate = (r: any) => ({
      ...r,
      business_name: nameById.get(r.business_id) ?? "—",
      target_name: r.user_id ? (doctorById.get(r.user_id) ?? "Doctor") : "Clinic pool",
    });

    return {
      links: (links ?? []).map(decorate),
      orders: (orders ?? []).map(decorate),
      businesses: (businesses ?? []) as { id: string; name: string }[],
    };
  });

export const createCreditLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      business_id: string;
      user_id?: string | null;
      label?: string;
      rate_per_credit?: number;
    }) => {
      if (!input?.business_id) throw new Error("Pick a clinic / business");
      const rate = Number(input.rate_per_credit ?? 3);
      if (!(rate > 0)) throw new Error("Rate per credit must be more than 0");
      return {
        business_id: input.business_id,
        user_id: input.user_id || null,
        label: String(input.label ?? "").trim() || null,
        rate_per_credit: rate,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("rx_credit_links")
      .insert({ ...data, token: makeToken(), created_by: context.userId } as never)
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string; token: string };
  });

export const setCreditLinkActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) => {
    if (!input?.id) throw new Error("id required");
    return { id: input.id, active: !!input.active };
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("rx_credit_links")
      .update({ active: data.active } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Approve (credits are added) or reject a manual payment request. */
export const reviewCreditOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; action: "approve" | "reject"; notes?: string }) => {
    if (!input?.id) throw new Error("id required");
    if (input.action !== "approve" && input.action !== "reject") throw new Error("Bad action");
    return { id: input.id, action: input.action, notes: String(input.notes ?? "").trim() || null };
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await supabaseAdmin
      .from("rx_credit_orders")
      .select("id, business_id, user_id, credits, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Request not found");
    if ((order as any).status !== "pending") throw new Error("This request is already reviewed");

    if (data.action === "reject") {
      await supabaseAdmin
        .from("rx_credit_orders")
        .update({ status: "rejected", notes: data.notes, approved_by: context.userId } as never)
        .eq("id", data.id);
      return { ok: true as const, credited: 0 };
    }

    const o = order as any;
    // Find (or create) the target billing account: clinic pool = user_id NULL.
    let q = supabaseAdmin
      .from("rx_billing_accounts")
      .select("id, credits")
      .eq("business_id", o.business_id);
    q = o.user_id ? q.eq("user_id", o.user_id) : q.is("user_id", null);
    const { data: acc } = await q.maybeSingle();

    let accountId = (acc as any)?.id as string | undefined;
    let current = Number((acc as any)?.credits ?? 0);
    if (!accountId) {
      const { data: created, error: insErr } = await supabaseAdmin
        .from("rx_billing_accounts")
        .insert({
          business_id: o.business_id,
          user_id: o.user_id,
          mode: "credit",
          credits: 0,
        } as never)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      accountId = (created as any).id as string;
      current = 0;
    }

    const credits = Number(o.credits ?? 0);
    const { error: upErr } = await supabaseAdmin
      .from("rx_billing_accounts")
      .update({ credits: current + credits } as never)
      .eq("id", accountId);
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("rx_credit_ledger").insert({
      account_id: accountId,
      delta: credits,
      reason: "manual payment approved",
      created_by: context.userId,
    } as never);

    await supabaseAdmin
      .from("rx_credit_orders")
      .update({
        status: "paid",
        notes: data.notes,
        approved_by: context.userId,
        paid_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);

    return { ok: true as const, credited: credits };
  });

/* ------------------------------ public payment ----------------------------- */

/** Public: read a payment link by its code (no login needed). */
export const getCreditLink = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({
    token: String(input?.token ?? "")
      .trim()
      .toUpperCase(),
  }))
  .handler(async ({ data }) => {
    if (!data.token) throw new Error("Missing payment code");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("rx_credit_links")
      .select("id, token, business_id, user_id, label, rate_per_credit, active")
      .eq("token", data.token)
      .maybeSingle();
    if (!link) return { found: false as const };

    const l = link as any;
    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("name")
      .eq("id", l.business_id)
      .maybeSingle();

    let targetName = "Clinic credit pool";
    if (l.user_id) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("email, first_name, last_name, doctor_name")
        .eq("id", l.user_id)
        .maybeSingle();
      const pr = p as any;
      targetName =
        pr?.doctor_name ||
        [pr?.first_name, pr?.last_name].filter(Boolean).join(" ") ||
        pr?.email ||
        "Doctor";
    }

    return {
      found: true as const,
      token: l.token as string,
      active: !!l.active,
      label: (l.label as string | null) ?? null,
      rate_per_credit: Number(l.rate_per_credit ?? 3),
      business_name: ((biz as any)?.name as string) ?? "—",
      target_name: targetName,
    };
  });

/** Public: submit a manual payment (bKash / Nagad / bank) against a link. */
export const submitCreditOrder = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      amount: number;
      method?: string;
      payer_name?: string;
      payer_phone?: string;
      txn_ref?: string;
    }) => {
      const token = String(input?.token ?? "")
        .trim()
        .toUpperCase();
      if (!token) throw new Error("Missing payment code");
      const amount = Math.round(Number(input?.amount) || 0);
      if (amount <= 0) throw new Error("Enter the amount you paid");
      const txn = String(input?.txn_ref ?? "").trim();
      if (txn.length < 4) throw new Error("Enter the transaction ID / reference");
      const phone = String(input?.payer_phone ?? "").replace(/[^\d+]/g, "");
      if (phone.replace(/\D/g, "").length < 11) throw new Error("Enter a valid 11-digit phone number");
      return {
        token,
        amount,
        method: String(input?.method ?? "bkash").trim() || "bkash",
        payer_name: String(input?.payer_name ?? "").trim() || null,
        payer_phone: phone,
        txn_ref: txn,
      };
    },
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("rx_credit_links")
      .select("id, business_id, user_id, rate_per_credit, active")
      .eq("token", data.token)
      .maybeSingle();
    if (!link) throw new Error("This payment link is not valid");
    const l = link as any;
    if (!l.active) throw new Error("This payment link is closed — contact the platform admin");

    const rate = Number(l.rate_per_credit ?? 3);
    const credits = Math.floor(data.amount / rate);
    if (credits < 1) throw new Error(`Minimum payment is ${rate} tk (1 credit)`);

    const { error } = await supabaseAdmin.from("rx_credit_orders").insert({
      link_id: l.id,
      business_id: l.business_id,
      user_id: l.user_id,
      amount: data.amount,
      credits,
      rate_per_credit: rate,
      method: data.method,
      payer_name: data.payer_name,
      payer_phone: data.payer_phone,
      txn_ref: data.txn_ref,
      status: "pending",
    } as never);
    if (error) throw new Error(error.message);

    return { ok: true as const, credits, amount: data.amount };
  });
