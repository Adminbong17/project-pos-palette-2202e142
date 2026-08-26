import { createFileRoute } from "@tanstack/react-router";

/**
 * bKash sends the payer back here after they approve (or cancel) the payment.
 * We execute the payment with bKash, then either add the purchased credits or
 * mark the monthly bill paid, and finally bounce the payer back to /rx-billing.
 */

function back(origin: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return new Response(null, { status: 302, headers: { Location: `${origin}/rx-billing?${qs}` } });
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const paymentID = url.searchParams.get("paymentID") ?? "";
  const status = (url.searchParams.get("status") ?? "").toLowerCase();

  if (!paymentID) return back(origin, { bkash: "failed", reason: "Missing payment reference" });
  if (status && status !== "success")
    return back(origin, { bkash: status === "cancel" ? "cancelled" : "failed" });

  const { getBkashConfig, bkashGetToken, bkashExecutePayment, bkashQueryPayment } = await import(
    "@/lib/bkash.server"
  );
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const cfg = await getBkashConfig();
  if (!cfg) return back(origin, { bkash: "failed", reason: "bKash is not configured" });

  const tok = await bkashGetToken(cfg);
  if (!tok.ok) return back(origin, { bkash: "failed", reason: tok.error });

  let result: any = await bkashExecutePayment(cfg, tok.idToken, paymentID);
  if (result?.transactionStatus !== "Completed" && !result?.trxID) {
    // Execute can fail if the payer refreshed; the status query is authoritative.
    result = await bkashQueryPayment(cfg, tok.idToken, paymentID);
  }
  const completed = result?.transactionStatus === "Completed" && !!result?.trxID;

  const { data: order } = await supabaseAdmin
    .from("rx_credit_orders")
    .select("id, business_id, user_id, credits, amount, bill_id, status")
    .eq("payment_id", paymentID)
    .maybeSingle();

  if (!order) return back(origin, { bkash: "failed", reason: "Payment record not found" });
  const o = order as any;
  if (o.status === "paid") return back(origin, { bkash: "success" });

  if (!completed) {
    await supabaseAdmin
      .from("rx_credit_orders")
      .update({
        status: "rejected",
        notes: String(result?.statusMessage ?? result?.errorMessage ?? "bKash payment not completed"),
      } as never)
      .eq("id", o.id);
    return back(origin, {
      bkash: "failed",
      reason: String(result?.statusMessage ?? result?.errorMessage ?? "Payment not completed"),
    });
  }

  // Payment is real — apply it.
  if (o.bill_id) {
    await supabaseAdmin
      .from("rx_bills")
      .update({ status: "paid", paid_at: new Date().toISOString() } as never)
      .eq("id", o.bill_id);
  } else if (Number(o.credits) > 0) {
    let accQuery = supabaseAdmin
      .from("rx_billing_accounts")
      .select("id, credits")
      .eq("business_id", o.business_id);
    accQuery = o.user_id ? accQuery.eq("user_id", o.user_id) : accQuery.is("user_id", null);
    const { data: acc } = await accQuery.maybeSingle();

    let accountId = (acc as any)?.id as string | undefined;
    const current = Number((acc as any)?.credits ?? 0);
    if (!accountId) {
      const { data: created } = await supabaseAdmin
        .from("rx_billing_accounts")
        .insert({
          business_id: o.business_id,
          user_id: o.user_id,
          mode: "credit",
          credits: 0,
        } as never)
        .select("id")
        .single();
      accountId = (created as any)?.id as string | undefined;
    }
    if (accountId) {
      await supabaseAdmin
        .from("rx_billing_accounts")
        .update({ credits: current + Number(o.credits) } as never)
        .eq("id", accountId);
      await supabaseAdmin.from("rx_credit_ledger").insert({
        account_id: accountId,
        delta: Number(o.credits),
        reason: `bKash payment ${result.trxID}`,
      } as never);
    }
  }

  await supabaseAdmin
    .from("rx_credit_orders")
    .update({
      status: "paid",
      txn_ref: String(result.trxID),
      paid_at: new Date().toISOString(),
      notes: "Paid online with bKash",
    } as never)
    .eq("id", o.id);

  return back(origin, { bkash: "success" });
}

export const Route = createFileRoute("/api/public/bkash/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => await handle(request),
      POST: async ({ request }) => await handle(request),
    },
  },
});
