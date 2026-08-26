import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * bKash Tokenized Checkout for the user side of billing:
 *  - buying Rx credits (credits x the admin-set price per credit)
 *  - paying a monthly Rx bill / subscription invoice
 *
 * The payment is created here, the payer finishes it on bKash, and
 * /api/public/bkash/callback executes it and applies the credits / marks the
 * bill paid.
 */

export type StartBkashInput = {
  business_id: string;
  kind: "credits" | "bill";
  credits?: number;
  bill_id?: string;
  origin: string;
};

export const startBkashPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StartBkashInput) => {
    if (!input?.business_id) throw new Error("business_id required");
    if (input.kind !== "credits" && input.kind !== "bill") throw new Error("Invalid payment type");
    if (input.kind === "credits" && !(Math.trunc(Number(input.credits) || 0) > 0))
      throw new Error("Enter how many credits you want to buy");
    if (input.kind === "bill" && !input.bill_id) throw new Error("bill_id required");
    if (!/^https?:\/\//.test(String(input.origin ?? ""))) throw new Error("Invalid origin");
    return {
      business_id: input.business_id,
      kind: input.kind,
      credits: Math.trunc(Number(input.credits) || 0),
      bill_id: input.bill_id ?? null,
      origin: String(input.origin).replace(/\/$/, ""),
    };
  })
  .handler(async ({ data, context }) => {
    // Caller must be an active member of the business they are paying for.
    const { data: member, error: memberErr } = await context.supabase
      .from("business_users")
      .select("business_id")
      .eq("business_id", data.business_id)
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .maybeSingle();
    if (memberErr) throw new Error(memberErr.message);
    if (!member) throw new Error("You are not a member of this business");

    const { getBkashConfig, bkashGetToken, bkashCreatePayment } = await import("./bkash.server");
    const cfg = await getBkashConfig();
    if (!cfg || !cfg.enabled)
      throw new Error("bKash payment is not enabled yet — contact the platform admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve the account so we can use the admin-set price per credit.
    const { data: account } = await supabaseAdmin
      .from("rx_billing_accounts")
      .select("id, user_id, credit_rate")
      .eq("business_id", data.business_id)
      .or(`user_id.eq.${context.userId},user_id.is.null`)
      .order("user_id", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    let amount = 0;
    let credits = 0;
    let billId: string | null = null;
    let rate = Number((account as any)?.credit_rate ?? 0) || cfg.rate_per_credit || 3;

    if (data.kind === "credits") {
      credits = data.credits;
      amount = Math.round(credits * rate);
    } else {
      const { data: bill, error: billErr } = await supabaseAdmin
        .from("rx_bills")
        .select("id, business_id, user_id, amount, status")
        .eq("id", data.bill_id!)
        .maybeSingle();
      if (billErr) throw new Error(billErr.message);
      if (!bill || (bill as any).business_id !== data.business_id) throw new Error("Bill not found");
      if ((bill as any).status === "paid") throw new Error("This bill is already paid");
      const billUser = (bill as any).user_id as string | null;
      if (billUser && billUser !== context.userId) throw new Error("This bill is not yours");
      amount = Number((bill as any).amount) || 0;
      billId = (bill as any).id as string;
      rate = 0;
    }
    if (amount <= 0) throw new Error("Nothing to pay");

    const tok = await bkashGetToken(cfg);
    if (!tok.ok) throw new Error(tok.error);

    const invoice = `QRX${Date.now().toString(36).toUpperCase()}`;
    const created = await bkashCreatePayment(cfg, tok.idToken, {
      amount,
      invoice,
      callbackURL: `${data.origin}/api/public/bkash/callback`,
      payerReference: invoice,
    });
    const paymentID = created?.paymentID as string | undefined;
    const url = (created?.bkashURL ?? created?.bkashUrl) as string | undefined;
    if (!paymentID || !url)
      throw new Error(
        String(created?.statusMessage ?? created?.errorMessage ?? "bKash could not start the payment"),
      );

    const { error: insErr } = await supabaseAdmin.from("rx_credit_orders").insert({
      business_id: data.business_id,
      user_id: context.userId,
      amount,
      credits,
      rate_per_credit: rate,
      method: "bkash",
      gateway: "bkash",
      payment_id: paymentID,
      bill_id: billId,
      txn_ref: invoice,
      status: "pending",
      notes: data.kind === "bill" ? "Monthly bill payment (bKash)" : "Credit purchase (bKash)",
    } as never);
    if (insErr) throw new Error(insErr.message);

    return { url, paymentID, amount, credits };
  });

/** Is online bKash payment available to users right now? */
export const bkashPayEnabled = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getBkashConfig } = await import("./bkash.server");
    const cfg = await getBkashConfig();
    return { enabled: !!cfg?.enabled, rate_per_credit: cfg?.rate_per_credit ?? 3 };
  });
