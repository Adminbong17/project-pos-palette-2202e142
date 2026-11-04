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
  due_day: number; // e.g. 7, 10, 15, 20
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
  due_day: number;
  is_free: boolean;
  is_paid: boolean;
  is_locked: boolean;
  is_due_warning: boolean;
  due_date: string | null;
  bill_id: string | null;
  helpline: string;
};

export function parseBillingConfig(notes: string | null | undefined): { dueDay: number; note: string } {
  let dueDay = 7;
  let note = "";
  if (notes) {
    try {
      const parsed = JSON.parse(notes);
      if (typeof parsed.due_day === "number" && parsed.due_day >= 1 && parsed.due_day <= 31) {
        dueDay = parsed.due_day;
      }
      if (typeof parsed.note === "string") {
        note = parsed.note;
      }
    } catch {
      const n = parseInt(notes, 10);
      if (!isNaN(n) && n >= 1 && n <= 31) dueDay = n;
      else note = notes;
    }
  }
  return { dueDay, note };
}

function getDhakaMonthDates(customDueDay: number = 7) {
  const now = new Date();
  // Get date in Asia/Dhaka (+6 hrs)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const dhakaNow = new Date(utc + 3600000 * 6);

  const y = dhakaNow.getFullYear();
  const m = String(dhakaNow.getMonth() + 1).padStart(2, "0");
  const periodStart = `${y}-${m}-01`;
  const safeDay = Math.min(31, Math.max(1, customDueDay));
  const dueDate = `${y}-${m}-${String(safeDay).padStart(2, "0")}`;
  const todayStr = `${y}-${m}-${String(dhakaNow.getDate()).padStart(2, "0")}`;

  return { y, m, periodStart, dueDate, todayStr };
}

/**
 * Super Admin: List all businesses with their subscription configuration,
 * custom billing due day, current month bill, and status.
 */
export const listAllSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { y, m, periodStart, todayStr } = getDhakaMonthDates();

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
          .select("id, business_id, user_id, mode, monthly_amount, helpline, notes")
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
            notes: JSON.stringify({ due_day: 7 }),
            helpline: "01712472839",
          } as never)
          .select("id, business_id, user_id, mode, monthly_amount, helpline, notes")
          .single();
        acc = createdAcc as any;
      }

      const { dueDay } = parseBillingConfig(acc?.notes);
      const clientDueDate = `${y}-${m}-${String(dueDay).padStart(2, "0")}`;

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
            due_date: clientDueDate,
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
        const effectiveDue = currentBill?.due_date || clientDueDate;
        if (todayStr >= effectiveDue) {
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
        due_day: dueDay,
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
 * Super Admin: Update recurring billing day of month for a client (e.g., 1 to 28).
 */
export const updateSubscriptionDueDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { business_id: string; due_day: number }) => {
    if (!input?.business_id) throw new Error("business_id required");
    const dueDay = Math.min(28, Math.max(1, Math.trunc(Number(input.due_day) || 7)));
    return { business_id: input.business_id, due_day: dueDay };
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { y, m, periodStart } = getDhakaMonthDates(data.due_day);
    const newDueDate = `${y}-${m}-${String(data.due_day).padStart(2, "0")}`;

    // 1. Get existing notes
    const { data: existing } = await supabaseAdmin
      .from("rx_billing_accounts")
      .select("id, notes")
      .eq("business_id", data.business_id)
      .is("user_id", null)
      .maybeSingle();

    const currentNotes = parseBillingConfig((existing as any)?.notes);
    const updatedNotes = JSON.stringify({ ...currentNotes, due_day: data.due_day });

    const { error: accErr } = await supabaseAdmin
      .from("rx_billing_accounts")
      .update({ notes: updatedNotes } as never)
      .eq("business_id", data.business_id)
      .is("user_id", null);
    if (accErr) throw new Error(accErr.message);

    // 2. Also update current unpaid month bill's due_date
    await supabaseAdmin
      .from("rx_bills")
      .update({ due_date: newDueDate } as never)
      .eq("business_id", data.business_id)
      .is("user_id", null)
      .eq("period_start", periodStart)
      .eq("status", "unpaid");

    return { ok: true, due_day: data.due_day, new_due_date: newDueDate };
  });

/**
 * Super Admin: Update the exact due date for a specific bill (Custom Date Picker).
 */
export const updateBillExactDueDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bill_id: string; due_date: string }) => {
    if (!input?.bill_id) throw new Error("bill_id required");
    if (!input?.due_date) throw new Error("due_date required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("rx_bills")
      .update({ due_date: data.due_date } as never)
      .eq("id", data.bill_id);
    if (error) throw new Error(error.message);

    return { ok: true, due_date: data.due_date };
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
 * Super Admin: Instantly lock a client's system (sets due date to yesterday).
 */
export const lockSubscriptionNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bill_id: string }) => {
    if (!input?.bill_id) throw new Error("bill_id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const dhakaNow = new Date(utc + 3600000 * 6);
    dhakaNow.setDate(dhakaNow.getDate() - 1);
    const yestStr = `${dhakaNow.getFullYear()}-${String(dhakaNow.getMonth() + 1).padStart(2, "0")}-${String(dhakaNow.getDate()).padStart(2, "0")}`;

    const { error } = await supabaseAdmin
      .from("rx_bills")
      .update({ due_date: yestStr, status: "unpaid" } as never)
      .eq("id", data.bill_id);
    if (error) throw new Error(error.message);

    return { ok: true, due_date: yestStr };
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

    // 2. Fetch business account, oldest unpaid bill (if any), and latest bill
    const [{ data: acc }, { data: unpaidBill }, { data: latestBill }] = await Promise.all([
      supabaseAdmin
        .from("rx_billing_accounts")
        .select("id, mode, monthly_amount, helpline, notes")
        .eq("business_id", businessId)
        .is("user_id", null)
        .maybeSingle(),
      supabaseAdmin
        .from("rx_bills")
        .select("id, amount, due_date, status, paid_at, period_start")
        .eq("business_id", businessId)
        .is("user_id", null)
        .eq("status", "unpaid")
        .order("period_start", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("rx_bills")
        .select("id, amount, due_date, status, paid_at, period_start")
        .eq("business_id", businessId)
        .is("user_id", null)
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const { dueDay } = parseBillingConfig((acc as any)?.notes);
    const { y, m, periodStart, todayStr } = getDhakaMonthDates(dueDay);
    const clientDueDate = `${y}-${m}-${String(dueDay).padStart(2, "0")}`;

    const mode = (acc?.mode === "free" ? "free" : "subscription") as "subscription" | "free";
    const monthlyAmount = Number(acc?.monthly_amount ?? 800);
    const helpline = acc?.helpline || "01712472839";

    // If an unpaid bill exists anywhere, that bill takes absolute priority
    let currentBill = (unpaidBill || latestBill) as any;
    if (currentBill && currentBill.status === "paid" && currentBill.period_start !== periodStart) {
      // Prior month was paid, but new month started - need new bill
      currentBill = null;
    }

    if (!currentBill && mode === "subscription" && monthlyAmount > 0) {
      const { data: createdBill } = await supabaseAdmin
        .from("rx_bills")
        .insert({
          business_id: businessId,
          user_id: null,
          period_start: periodStart,
          due_date: clientDueDate,
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
        due_day: dueDay,
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
    const effectiveDue = currentBill?.due_date || clientDueDate;
    const isOverdue = !isPaid && todayStr >= effectiveDue;
    const isDueWarning = !isPaid && todayStr < effectiveDue;

    return {
      business_id: businessId,
      business_name: businessName,
      mode: "subscription",
      monthly_amount: Number(currentBill?.amount ?? monthlyAmount),
      due_day: dueDay,
      is_free: false,
      is_paid: isPaid,
      is_locked: isOverdue,
      is_due_warning: isDueWarning,
      due_date: effectiveDue,
      bill_id: currentBill?.id || null,
      helpline,
    };
  });
