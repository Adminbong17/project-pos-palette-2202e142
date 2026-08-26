/**
 * bKash Tokenized Checkout (PGW) helper.
 *
 * Credentials live in the `bkash_settings` table, which only the service role
 * can read — the super admin edits them through /admin/bkash. Environment
 * variables act as a fallback so older deployments keep working.
 */

export type BkashConfig = {
  environment: "live" | "sandbox";
  app_key: string;
  app_secret: string;
  username: string;
  password: string;
  rate_per_credit: number;
  enabled: boolean;
};

export function bkashBaseUrl(environment: string) {
  return environment === "sandbox"
    ? "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout"
    : "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout";
}

export async function getBkashConfig(): Promise<BkashConfig | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("bkash_settings" as never)
      .select("environment, app_key, app_secret, username, password, rate_per_credit, enabled")
      .maybeSingle();
    const row = data as any;
    const environment = (String(row?.environment ?? process.env["BKASH_ENV"] ?? "live").trim() ===
    "sandbox"
      ? "sandbox"
      : "live") as "live" | "sandbox";
    const app_key = String(row?.app_key ?? process.env["BKASH_APP_KEY"] ?? "").trim();
    const app_secret = String(row?.app_secret ?? process.env["BKASH_APP_SECRET"] ?? "").trim();
    const username = String(row?.username ?? process.env["BKASH_USERNAME"] ?? "").trim();
    const password = String(row?.password ?? process.env["BKASH_PASSWORD"] ?? "").trim();
    const rate_per_credit = Number(row?.rate_per_credit ?? 3) || 3;
    const enabled = row ? !!row.enabled : false;
    if (!app_key || !app_secret || !username || !password) return null;
    return { environment, app_key, app_secret, username, password, rate_per_credit, enabled };
  } catch {
    return null;
  }
}

export type BkashToken = { id_token: string; refresh_token?: string };

/** Grant token — also the cheapest way to verify the stored credentials. */
export async function bkashGrantToken(cfg: BkashConfig): Promise<
  { ok: true; token: BkashToken } | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${bkashBaseUrl(cfg.environment)}/token/grant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        username: cfg.username,
        password: cfg.password,
      },
      body: JSON.stringify({ app_key: cfg.app_key, app_secret: cfg.app_secret }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (json?.id_token) return { ok: true, token: json as BkashToken };
    const msg =
      json?.statusMessage ??
      json?.errorMessage ??
      json?.message ??
      `bKash returned HTTP ${res.status}`;
    return { ok: false, error: String(msg) };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Could not reach bKash" };
  }
}

/**
 * bKash only issues a couple of grant tokens per hour, so the token is cached
 * in `bkash_settings` and reused for 55 minutes. When it expires we try the
 * cheaper /token/refresh call first and only fall back to a fresh grant.
 */
const TOKEN_TTL_MS = 55 * 60 * 1000;

/** In-process cache so repeated calls in one request don't hit the DB. */
let memoryToken: { id_token: string; refresh_token?: string; expires: number } | null = null;

async function readCachedToken() {
  if (memoryToken && memoryToken.expires > Date.now()) return memoryToken;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("bkash_settings" as never)
      .select("cached_id_token, cached_refresh_token, cached_token_expires_at")
      .maybeSingle();
    const row = data as any;
    if (!row?.cached_id_token || !row?.cached_token_expires_at) return null;
    const expires = new Date(row.cached_token_expires_at).getTime();
    if (!Number.isFinite(expires) || expires <= Date.now()) {
      memoryToken = null;
      return { id_token: "", refresh_token: row.cached_refresh_token ?? undefined, expires: 0 };
    }
    memoryToken = {
      id_token: String(row.cached_id_token),
      refresh_token: row.cached_refresh_token ?? undefined,
      expires,
    };
    return memoryToken;
  } catch {
    return null;
  }
}

async function storeToken(token: BkashToken) {
  const expires = Date.now() + TOKEN_TTL_MS;
  memoryToken = { id_token: token.id_token, refresh_token: token.refresh_token, expires };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("bkash_settings" as never)
      .update({
        cached_id_token: token.id_token,
        cached_refresh_token: token.refresh_token ?? null,
        cached_token_expires_at: new Date(expires).toISOString(),
      } as never)
      .not("id", "is", null);
  } catch {
    /* cache is best-effort */
  }
}

async function bkashRefreshToken(cfg: BkashConfig, refreshToken: string) {
  try {
    const res = await fetch(`${bkashBaseUrl(cfg.environment)}/token/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        username: cfg.username,
        password: cfg.password,
      },
      body: JSON.stringify({
        app_key: cfg.app_key,
        app_secret: cfg.app_secret,
        refresh_token: refreshToken,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (json?.id_token) return json as BkashToken;
    return null;
  } catch {
    return null;
  }
}

/**
 * Preferred way to get an id_token: reuses the cached token for 55 minutes,
 * then refreshes / re-grants once and caches the new one.
 */
export async function bkashGetToken(
  cfg: BkashConfig,
): Promise<{ ok: true; idToken: string } | { ok: false; error: string }> {
  const cached = await readCachedToken();
  if (cached?.id_token) return { ok: true, idToken: cached.id_token };

  if (cached?.refresh_token) {
    const refreshed = await bkashRefreshToken(cfg, cached.refresh_token);
    if (refreshed?.id_token) {
      await storeToken(refreshed);
      return { ok: true, idToken: refreshed.id_token };
    }
  }

  const granted = await bkashGrantToken(cfg);
  if (!granted.ok) return granted;
  await storeToken(granted.token);
  return { ok: true, idToken: granted.token.id_token };
}

/** Drop the cached token (e.g. after credentials change or a 401 from bKash). */
export async function bkashClearTokenCache() {
  memoryToken = null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("bkash_settings" as never)
      .update({
        cached_id_token: null,
        cached_refresh_token: null,
        cached_token_expires_at: null,
      } as never)
      .not("id", "is", null);
  } catch {
    /* ignore */
  }
}

function authHeaders(cfg: BkashConfig, idToken: string) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: idToken,
    "X-App-Key": cfg.app_key,
  };
}

/** Create payment — returns the bKash URL the payer should be sent to. */
export async function bkashCreatePayment(
  cfg: BkashConfig,
  idToken: string,
  input: { amount: number; invoice: string; callbackURL: string; payerReference?: string },
) {
  const res = await fetch(`${bkashBaseUrl(cfg.environment)}/create`, {
    method: "POST",
    headers: authHeaders(cfg, idToken),
    body: JSON.stringify({
      mode: "0011",
      payerReference: input.payerReference ?? input.invoice,
      callbackURL: input.callbackURL,
      amount: input.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: input.invoice,
    }),
  });
  return (await res.json().catch(() => ({}))) as any;
}

export async function bkashExecutePayment(cfg: BkashConfig, idToken: string, paymentID: string) {
  const res = await fetch(`${bkashBaseUrl(cfg.environment)}/execute`, {
    method: "POST",
    headers: authHeaders(cfg, idToken),
    body: JSON.stringify({ paymentID }),
  });
  return (await res.json().catch(() => ({}))) as any;
}

export async function bkashQueryPayment(cfg: BkashConfig, idToken: string, paymentID: string) {
  const res = await fetch(`${bkashBaseUrl(cfg.environment)}/payment/status`, {
    method: "POST",
    headers: authHeaders(cfg, idToken),
    body: JSON.stringify({ paymentID }),
  });
  return (await res.json().catch(() => ({}))) as any;
}
