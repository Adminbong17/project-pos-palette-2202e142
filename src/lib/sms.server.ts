/**
 * Shared SMS gateway (REVESMS / SMSServer style HTTP API).
 *
 * Credentials live in the `sms_settings` table, which only the service role
 * can read — the super admin edits them through /admin/sms. Environment
 * variables are kept as a fallback so older deployments keep working.
 */

export type SmsConfig = {
  base_url: string;
  api_key: string;
  secret_key: string;
  caller_id: string;
  enabled: boolean;
};

export async function getSmsConfig(): Promise<SmsConfig | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sms_settings" as never)
      .select("base_url, api_key, secret_key, caller_id, enabled")
      .maybeSingle();
    const row = data as any;
    const base_url = String(row?.base_url ?? process.env["SMS_API_URL"] ?? "").trim();
    const api_key = String(row?.api_key ?? process.env["SMS_API_KEY"] ?? "").trim();
    const secret_key = String(row?.secret_key ?? process.env["SMS_SECRET_KEY"] ?? "").trim();
    const caller_id = String(row?.caller_id ?? process.env["SMS_SENDER_ID"] ?? "").trim();
    const enabled = row ? !!row.enabled : true;
    if (!base_url || !api_key || !secret_key) return null;
    return { base_url, api_key, secret_key, caller_id, enabled };
  } catch {
    return null;
  }
}

function sendUrl(cfg: SmsConfig, phone: string, message: string) {
  const base = cfg.base_url.replace(/\/+$/, "");
  const root = /\/sendtext$/i.test(base) ? base : `${base}/sendtext`;
  const q = new URLSearchParams({
    apikey: cfg.api_key,
    secretkey: cfg.secret_key,
    callerID: cfg.caller_id,
    toUser: phone,
    messageContent: message,
  });
  return `${root}?${q.toString()}`;
}

/** Bangladeshi numbers are normalised to 880XXXXXXXXXX. */
export function normalizePhone(raw: unknown) {
  let p = String(raw ?? "").replace(/\D/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.length === 11 && p.startsWith("01")) p = `88${p}`;
  if (p.length === 10 && p.startsWith("1")) p = `880${p}`;
  return p;
}

export type SmsResult = { ok: boolean; status?: string; text?: string; error?: string };

/** Sends one SMS. Never throws — callers treat a false result as "not sent". */
export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  const cfg = await getSmsConfig();
  if (!cfg) return { ok: false, error: "SMS gateway is not configured" };
  if (!cfg.enabled) return { ok: false, error: "SMS sending is turned off" };
  const to = normalizePhone(phone);
  if (to.length < 11) return { ok: false, error: "Invalid phone number" };

  try {
    const res = await fetch(sendUrl(cfg, to, message), { method: "GET" });
    const body = await res.text();
    let status: string | undefined;
    let text: string | undefined;
    try {
      const json = JSON.parse(body);
      status = String(json?.Status ?? "");
      text = String(json?.Text ?? "");
    } catch {
      text = body.slice(0, 200);
    }
    const ok = res.ok && (status === undefined || status === "" || status === "0");
    return { ok, status, text, error: ok ? undefined : text || `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}
