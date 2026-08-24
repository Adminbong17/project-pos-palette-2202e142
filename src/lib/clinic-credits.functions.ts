import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Rx credit distribution inside a clinic.
 *
 * A clinic buys prescription credits from the platform (super admin tops up the
 * clinic pool account: business_id + user_id NULL). The clinic admin then hands
 * those credits out to the doctors working under the clinic. Doctors under a
 * clinic never see the platform billing page — their clinic pays for them.
 * Independent doctors keep their own account and are topped up by the super admin.
 */

async function assertClinicAdmin(context: any, businessId: string) {
  const { data: isAdmin, error } = await context.supabase.rpc("is_business_admin", {
    _user_id: context.userId,
    _business_id: businessId,
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Only the clinic admin can manage Rx credits");
}

/** Clinic pool balance + each doctor's credit balance. */
export const listClinicCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { business_id: string }) => {
    if (!input?.business_id) throw new Error("business_id required");
    return { business_id: input.business_id };
  })
  .handler(async ({ data, context }) => {
    await assertClinicAdmin(context, data.business_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: accounts, error } = await supabaseAdmin
      .from("rx_billing_accounts")
      .select("id, user_id, mode, credits")
      .eq("business_id", data.business_id);
    if (error) throw new Error(error.message);

    const rows = (accounts ?? []) as any[];
    const pool = rows.find((a) => a.user_id === null) ?? null;
    return {
      pool_credits: Number(pool?.credits ?? 0),
      pool_exists: !!pool,
      doctors: rows
        .filter((a) => a.user_id)
        .map((a) => ({ user_id: a.user_id as string, credits: Number(a.credits ?? 0) })),
    };
  });

/** Move credits from the clinic pool to one doctor (negative delta pulls them back). */
export const grantClinicCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { business_id: string; user_id: string; delta: number }) => {
    if (!input?.business_id) throw new Error("business_id required");
    if (!input?.user_id) throw new Error("Pick a doctor");
    const delta = Math.trunc(Number(input.delta) || 0);
    if (!delta) throw new Error("Enter how many credits to move");
    return { business_id: input.business_id, user_id: input.user_id, delta };
  })
  .handler(async ({ data, context }) => {
    await assertClinicAdmin(context, data.business_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clinic pool (create an empty pool row on first use)
    const { data: poolRow } = await supabaseAdmin
      .from("rx_billing_accounts")
      .select("id, credits")
      .eq("business_id", data.business_id)
      .is("user_id", null)
      .maybeSingle();
    let pool = poolRow as any;
    if (!pool) {
      const { data: createdPool, error: poolErr } = await supabaseAdmin
        .from("rx_billing_accounts")
        .insert({ business_id: data.business_id, user_id: null, mode: "credit", credits: 0 } as never)
        .select("id, credits")
        .single();
      if (poolErr) throw new Error(poolErr.message);
      pool = createdPool as any;
    }
    const poolCredits = Number(pool.credits ?? 0);
    if (data.delta > 0 && poolCredits < data.delta)
      throw new Error(
        poolCredits === 0
          ? "Clinic credit pool is empty — ask the platform admin to top it up"
          : `Clinic pool has only ${poolCredits} credit(s)`,
      );

    // Doctor account (create on first grant)
    const { data: docRow } = await supabaseAdmin
      .from("rx_billing_accounts")
      .select("id, credits")
      .eq("business_id", data.business_id)
      .eq("user_id", data.user_id)
      .maybeSingle();

    let doctorId = (docRow as any)?.id as string | undefined;
    let doctorCredits = Number((docRow as any)?.credits ?? 0);
    if (!doctorId) {
      const { data: created, error: insErr } = await supabaseAdmin
        .from("rx_billing_accounts")
        .insert({
          business_id: data.business_id,
          user_id: data.user_id,
          mode: "credit",
          credits: 0,
        } as never)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      doctorId = (created as any).id as string;
      doctorCredits = 0;
    }

    const move = data.delta > 0 ? data.delta : Math.max(-doctorCredits, data.delta);
    if (!move) throw new Error("That doctor has no credits to pull back");

    const { error: e1 } = await supabaseAdmin
      .from("rx_billing_accounts")
      .update({ credits: doctorCredits + move } as never)
      .eq("id", doctorId);
    if (e1) throw new Error(e1.message);

    const { error: e2 } = await supabaseAdmin
      .from("rx_billing_accounts")
      .update({ credits: Math.max(0, poolCredits - move) } as never)
      .eq("id", pool.id);
    if (e2) throw new Error(e2.message);

    await supabaseAdmin.from("rx_credit_ledger").insert([
      {
        account_id: doctorId,
        delta: move,
        reason: move > 0 ? "clinic grant" : "clinic pull-back",
        created_by: context.userId,
      },
      {
        account_id: pool.id,
        delta: -move,
        reason: move > 0 ? "granted to doctor" : "returned from doctor",
        created_by: context.userId,
      },
    ] as never);

    return { ok: true as const, moved: move, pool_credits: Math.max(0, poolCredits - move) };
  });
