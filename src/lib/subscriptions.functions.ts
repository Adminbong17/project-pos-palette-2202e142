import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/super-admin-auth";

export type BusinessSubscriptionRow = {
  business_id: string;
  business_name: string;
  biz_kind: string;
  clinic_mode: boolean;
  owner_name: string | null;
  owner_email: string | null;
  account_id: string | null;
  mode: "subscription" | "free";
  monthly_amount: number;
  helpline: string | null;
  current_bill: {
    id: string;
    amount: number;
    due_date: string;
    status: string;
    period_start: string;
    paid_at: string | null;
  } | null;
  status: "free" | "paid" | "due" | "locked";
};

export type CurrentSubscriptionStatus = {
  business_id: string;
  business_name: string;
  mode: "subscription" | "free";
  monthly_amount: number;
  is_free: boolean;
  is_paid: boolean;
  is_locked: boolean;
  is_due_warning: boolean;
  due_date: string | null;
  bill_id: string | null;
  helpline: string;
};

function getDhakaMonthDates() {
  const now = new Date();
  // Get date in Asia/Dhaka (+6 hrs)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const dhakaNow = new Date(utc + 3600000 * 6);

  const y = dhakaNow.getFullYear();
  const m = String(dhakaNow.getMonth() + 1).padStart(2, "0");
  const periodStart = `${y}-${m}-01`;
  const dueDate = `${y}-${m}-07`;
  const todayStr = `${y}-${m}-${String(dhakaNow.getDate()).padStart(2, "0")}`;

  return { periodStart, dueDate, todayStr };
}

/**
 * Super Admin: List all businesses with their subscription configuration,
 * current month bill, and status (Free / Paid / Due by 7th / Locked).
 */
export const listAllSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { periodStart, dueDate, todayStr } = getDhakaMonthDates();

    // 1. Fetch businesses & active members
    const [{ data: businesses }, { data: members }, { data: accounts }, { data: bills }] =
      await Promise.all([
        supabaseAdmin
          .from("businesses")
          .select("id, name, biz_kind, clinic_mode, owner_id")
          .order("name"),
        supabaseAdmin
          .from("business_users")
          .select("user_id, business_id, is_active")
          .eq("is_active", true),
        supabaseAdmin
          .from("rx_billing_accounts")
          .select("id, business_id, user_id, mode, monthly_amount, helpline")
          .is("user_id", null),
        supabaseAdmin
          .from("rx_bills")
          .select("id, business_id, user_id, period_start, due_date, amount, status, paid_at")
          .is("user_id", null)
          .eq("period_start", periodStart),
      ]);

    const activeBizIds = new Set((members ?? []).map((m: any) => m.business_id as string));
    const activeBusinesses = (businesses ?? []).filter((b: any) => activeBizIds.has(b.id));

    // Fetch owners
    const ownerIds = Array.from(new Set(activeBusinesses.map((b: any) => b.owner_id).filter(Boolean)));
    const { data: ownerProfiles } = ownerIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, email, first_name, last_name, doctor_name")
          .in("id", ownerIds)
      : { data: [] as any[] };

    const ownerById = new Map((ownerProfiles ?? []).map((p: any) => [p.id, p]));
    const accountByBiz = new Map((accounts ?? []).map((a: any) => [a.business_id, a]));
    const billByBiz = new Map((bills ?? []).map((b: any) => [b.business_id, b]));

    const result: BusinessSubscriptionRow[] = [];

    for (const b of activeBusinesses) {
      let acc = accountByBiz.get(b.id);

      // Auto-provision subscription account if missing
      if (!acc) {
        const { data: createdAcc } = await supabaseAdmin
          .from("rx_billing_accounts")
          .insert({
            business_id: b.id,
            user_id: null,
            mode: "subscription",
            monthly_amount: 800,
            helpline: "01712472839",
          } as never)
          .select("id, business_id, user_id, mode, monthly_amount, helpline")
          .single();
        acc = createdAcc as any;
      }

      const mode = (acc?.mode === "free" ? "free" : "subscription") as "subscription" | "free";
      const monthlyAmount = Number(acc?.monthly_amount ?? 800);

      let currentBill = billByBiz.get(b.id);

      // Auto-create current month bill if missing and mode is subscription
      if (!currentBill && mode === "subscription" && monthlyAmount > 0) {
        const { data: createdBill } = await supabaseAdmin
          .from("rx_bills")
          .insert({
            business_id: b.id,
            user_id: null,
            period_start: periodStart,
            due_date: dueDate,
            amount: monthlyAmount,
            status: "unpaid",
          } as never)
          .select("id, business_id, user_id, period_start, due_date, amount, status, paid_at")
          .single();
        currentBill = createdBill as any;
      }

      // Determine clean status
      let status: "free" | "paid" | "due" | "locked" = "paid";
      if (mode === "free" || monthlyAmount <= 0) {
        status = "free";
      } else if (currentBill?.status === "paid") {
        status = "paid";
      } else {
        // Unpaid
        const effectiveDue = currentBill?.due_date || dueDate;
        if (todayStr > effectiveDue) {
          status = "locked";
        } else {
          status = "due";
        }
      }

      const owner = ownerById.get(b.owner_id);
      const ownerName =
        owner?.doctor_name ||
        [owner?.first_name, owner?.last_name].filter(Boolean).join(" ") ||
        owner?.email ||
        null;

      result.push({
        business_id: b.id,
        business_name: b.name || "Untitled Business",
        biz_kind: b.biz_kind || (b.clinic_mode ? "clinic" : "pos"),
        clinic_mode: !!b.clinic_mode,
        owner_name: ownerName,
        owner_email: owner?.email || null,
        account_id: acc?.id || null,
        mode,
        monthly_amount: monthlyAmount,
        helpline: acc?.helpline || "01712472839",
        current_bill: currentBill
          ? {
              id: currentBill.id,
              amount: Number(currentBill.amount) || monthlyAmount,
              due_date: currentBill.due_date,
              status: currentBill.status,
              period_start: currentBill.period_start,
              paid_at: currentBill.paid_at,
            }
          : null,
        status,
      });
    }

    return {
      periodStart,
      dueDate,
      todayStr,
      subscriptions: result,
    };
  });

/**
 * Super Admin: Update a business's monthly subscription fee (e.g. ৳800, ৳500, ৳1000).
 */
export const updateSubscriptionPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { business_id: string; monthly_amount: number }) => {
    if (!input?.business_id) throw new Error("business_id required");
    return {
      business_id: input.business_id,
      monthly_amount: Math.max(0, Math.trunc(Number(input.monthly_amount) || 0)),
    };
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { periodStart } = getDhakaMonthDates();

    // 1. Update account
    const { error: accErr } = await supabaseAdmin
      .from("rx_billing_accounts")
      .update({ monthly_amount: data.monthly_amount } as never)
      .eq("business_id", data.business_id)
      .is("user_id", null);
    if (accErr) throw new Error(accErr.message);

    // 2. Also update current unpaid month bill amount if present
    await supabaseAdmin
      .from("rx_bills")
      .update({ amount: data.monthly_amount } as never)
      .eq("business_id", data.business_id)
      .is("user_id", null)
      .eq("period_start", periodStart)
      .eq("status", "unpaid");

    return { ok: true, monthly_amount: data.monthly_amount };
  });

/**
 * Super Admin: Toggle subscription Free vs Paid mode (1-click Free = Lifetime Active).
 */
export const setSubscriptionMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { business_id: string; mode: "subscription" | "free" }) => {
    if (!input?.business_id) throw new Error("business_id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { periodStart } = getDhakaMonthDates();

    const { error } = await supabaseAdmin
      .from("rx_billing_accounts")
      .update({ mode: data.mode } as never)
      .eq("business_id", data.business_id)
      .is("user_id", null);
    if (error) throw new Error(error.message);

    // If made free, mark any unpaid bill for this month as paid so they are unlocked immediately
    if (data.mode === "free") {
      await supabaseAdmin
        .from("rx_bills")
        .update({ status: "paid", paid_at: new Date().toISOString() } as never)
        .eq("business_id", data.business_id)
        .is("user_id", null)
        .eq("period_start", periodStart);
    }

    return { ok: true, mode: data.mode };
  });

/**
 * Super Admin: Mark a bill as paid manually (Cash or direct offline payment).
 */
export const markSubscriptionBillPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bill_id: string }) => {
    if (!input?.bill_id) throw new Error("bill_id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("rx_bills")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      } as never)
      .eq("id", data.bill_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/**
 * Super Admin: Extend grace period (+3 days or custom date) so system unlocks temporarily.
 */
export const extendSubscriptionGrace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bill_id: string; extraDays?: number }) => {
    if (!input?.bill_id) throw new Error("bill_id required");
    return { bill_id: input.bill_id, extraDays: input.extraDays ?? 3 };
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: bill, error: billErr } = await supabaseAdmin
      .from("rx_bills")
      .select("id, due_date")
      .eq("id", data.bill_id)
      .maybeSingle();
    if (billErr) throw new Error(billErr.message);
    if (!bill) throw new Error("Bill not found");

    const currentDue = new Date(bill.due_date);
    const now = new Date();
    // Base extension on either current due or today (whichever is later)
    const base = currentDue.getTime() > now.getTime() ? currentDue : now;
    base.setDate(base.getDate() + data.extraDays);

    const newDueStr = base.toISOString().slice(0, 10);

    const { error } = await supabaseAdmin
      .from("rx_bills")
      .update({ due_date: newDueStr, status: "unpaid" } as never)
      .eq("id", data.bill_id);
    if (error) throw new Error(error.message);

    return { ok: true, new_due_date: newDueStr };
  });

/**
 * Regular User / Authed Layout: Get the signed-in business's subscription status.
 */
export const getMyBusinessSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentSubscriptionStatus | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Get active business of user
    const { data: member } = await context.supabase
      .from("business_users")
      .select("business_id, businesses:businesses(name, owner_id)")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!member?.business_id) return null;
    const businessId = member.business_id;
    const businessName = (member as any)?.businesses?.name || "Sheikh Pharma";

    const { periodStart, dueDate, todayStr } = getDhakaMonthDates();

    // 2. Fetch business account & current bill
    const [{ data: acc }, { data: bills }] = await Promise.all([
      supabaseAdmin
        .from("rx_billing_accounts")
        .select("id, mode, monthly_amount, helpline")
        .eq("business_id", businessId)
        .is("user_id", null)
        .maybeSingle(),
      supabaseAdmin
        .from("rx_bills")
        .select("id, amount, due_date, status, paid_at")
        .eq("business_id", businessId)
        .is("user_id", null)
        .eq("period_start", periodStart)
        .maybeSingle(),
    ]);

    const mode = (acc?.mode === "free" ? "free" : "subscription") as "subscription" | "free";
    const monthlyAmount = Number(acc?.monthly_amount ?? 800);
    const helpline = acc?.helpline || "01712472839";

    // Auto-create bill if in subscription mode and monthly_amount > 0 and bill missing
    let currentBill = bills as any;
    if (!currentBill && mode === "subscription" && monthlyAmount > 0) {
      const { data: createdBill } = await supabaseAdmin
        .from("rx_bills")
        .insert({
          business_id: businessId,
          user_id: null,
          period_start: periodStart,
          due_date: dueDate,
          amount: monthlyAmount,
          status: "unpaid",
        } as never)
        .select("id, amount, due_date, status, paid_at")
        .single();
      currentBill = createdBill;
    }

    if (mode === "free" || monthlyAmount <= 0) {
      return {
        business_id: businessId,
        business_name: businessName,
        mode: "free",
        monthly_amount: 0,
        is_free: true,
        is_paid: true,
        is_locked: false,
        is_due_warning: false,
        due_date: null,
        bill_id: null,
        helpline,
      };
    }

    const isPaid = currentBill?.status === "paid";
    const effectiveDue = currentBill?.due_date || dueDate;
    const isOverdue = !isPaid && todayStr > effectiveDue;
    const isDueWarning = !isPaid && todayStr <= effectiveDue;

    return {
      business_id: businessId,
      business_name: businessName,
      mode: "subscription",
      monthly_amount: Number(currentBill?.amount ?? monthlyAmount),
      is_free: false,
      is_paid: isPaid,
      is_locked: isOverdue,
      is_due_warning: isDueWarning,
      due_date: effectiveDue,
      bill_id: currentBill?.id || null,
      helpline,
    };
  });
