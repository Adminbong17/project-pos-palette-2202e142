import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { assertSuperAdmin } from "@/lib/super-admin-auth";

function mask(v: string | null | undefined) {
  const s = String(v ?? "");
  if (!s) return "";
  if (s.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, s.length - 4))}${s.slice(-4)}`;
}

export type BkashSettingsView = {
  environment: "live" | "sandbox";
  rate_per_credit: number;
  enabled: boolean;
  app_key_masked: string;
  app_secret_masked: string;
  username_masked: string;
  has_app_key: boolean;
  has_app_secret: boolean;
  has_username: boolean;
  has_password: boolean;
  updated_at: string | null;
};

export const getBkashSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BkashSettingsView> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("bkash_settings" as never)
      .select("environment, app_key, app_secret, username, password, rate_per_credit, enabled, updated_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = (data ?? {}) as any;
    return {
      environment: row.environment === "sandbox" ? "sandbox" : "live",
      rate_per_credit: Number(row.rate_per_credit ?? 3),
      enabled: !!row.enabled,
      app_key_masked: mask(row.app_key),
      app_secret_masked: mask(row.app_secret),
      username_masked: mask(row.username),
      has_app_key: !!row.app_key,
      has_app_secret: !!row.app_secret,
      has_username: !!row.username,
      has_password: !!row.password,
      updated_at: row.updated_at ?? null,
    };
  });

export const saveBkashSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      environment: string;
      rate_per_credit: number;
      enabled: boolean;
      app_key?: string;
      app_secret?: string;
      username?: string;
      password?: string;
    }) => {
      const rate = Number(input?.rate_per_credit);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error("Rate per credit must be more than 0");
      return {
        environment: input?.environment === "sandbox" ? "sandbox" : "live",
        rate_per_credit: rate,
        enabled: !!input?.enabled,
        // Blank means "keep the stored value".
        app_key: String(input?.app_key ?? "").trim(),
        app_secret: String(input?.app_secret ?? "").trim(),
        username: String(input?.username ?? "").trim(),
        password: String(input?.password ?? "").trim(),
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {
      environment: data.environment,
      rate_per_credit: data.rate_per_credit,
      enabled: data.enabled,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    if (data.app_key) patch["app_key"] = data.app_key;
    if (data.app_secret) patch["app_secret"] = data.app_secret;
    if (data.username) patch["username"] = data.username;
    if (data.password) patch["password"] = data.password;

    const { error } = await supabaseAdmin
      .from("bkash_settings" as never)
      .upsert({ id: true, ...patch } as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    // Credentials/environment may have changed — drop the cached token.
    const { bkashClearTokenCache } = await import("./bkash.server");
    await bkashClearTokenCache();
    return { ok: true };
  });

/**
 * Verifies the stored credentials. Reuses the cached token when it is still
 * valid so the strict bKash grant-token rate limit is respected.
 */
export const testBkashCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { getBkashConfig, bkashGetToken } = await import("./bkash.server");
    const cfg = await getBkashConfig();
    if (!cfg) return { ok: false, error: "Fill in all four bKash credentials first" };
    const res = await bkashGetToken(cfg);
    return res.ok
      ? { ok: true, environment: cfg.environment }
      : { ok: false, error: res.error };
  });
