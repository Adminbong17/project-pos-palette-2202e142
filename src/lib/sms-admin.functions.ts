import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPER_ADMIN_EMAIL = "admin@bongbangla.top";

async function assertSuperAdmin(context: any) {
  let email = String((context?.claims as any)?.email ?? "").toLowerCase();
  if (!email) {
    const { data } = await context.supabase.auth.getUser();
    email = String(data?.user?.email ?? "").toLowerCase();
  }
  if (email !== SUPER_ADMIN_EMAIL) throw new Error("Only the super admin can manage SMS settings");
}

function mask(v: string | null | undefined) {
  const s = String(v ?? "");
  if (!s) return "";
  if (s.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, s.length - 4))}${s.slice(-4)}`;
}

export type SmsSettingsView = {
  base_url: string;
  caller_id: string;
  enabled: boolean;
  api_key_masked: string;
  secret_key_masked: string;
  has_api_key: boolean;
  has_secret_key: boolean;
  updated_at: string | null;
};

export const getSmsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SmsSettingsView> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("sms_settings" as never)
      .select("base_url, caller_id, enabled, api_key, secret_key, updated_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = (data ?? {}) as any;
    return {
      base_url: row.base_url ?? "http://smpp.revesms.com:7788",
      caller_id: row.caller_id ?? "",
      enabled: row.enabled ?? true,
      api_key_masked: mask(row.api_key),
      secret_key_masked: mask(row.secret_key),
      has_api_key: !!row.api_key,
      has_secret_key: !!row.secret_key,
      updated_at: row.updated_at ?? null,
    };
  });

export const saveSmsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      base_url: string;
      caller_id: string;
      enabled: boolean;
      api_key?: string;
      secret_key?: string;
    }) => {
      const base_url = String(input?.base_url ?? "").trim();
      if (!/^https?:\/\//i.test(base_url)) throw new Error("Base URL must start with http:// or https://");
      return {
        base_url,
        caller_id: String(input?.caller_id ?? "").trim(),
        enabled: !!input?.enabled,
        // Blank means "keep the stored value".
        api_key: String(input?.api_key ?? "").trim(),
        secret_key: String(input?.secret_key ?? "").trim(),
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {
      base_url: data.base_url,
      caller_id: data.caller_id || null,
      enabled: data.enabled,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    if (data.api_key) patch["api_key"] = data.api_key;
    if (data.secret_key) patch["secret_key"] = data.secret_key;

    const { error } = await supabaseAdmin
      .from("sms_settings" as never)
      .upsert({ id: true, ...patch } as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string; message?: string }) => {
    const phone = String(input?.phone ?? "").replace(/\D/g, "");
    if (phone.length < 11) throw new Error("Enter a valid phone number");
    return { phone, message: String(input?.message ?? "").trim() || "QweekPOS SMS gateway test" };
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { sendSms } = await import("./sms.server");
    return await sendSms(data.phone, data.message);
  });
