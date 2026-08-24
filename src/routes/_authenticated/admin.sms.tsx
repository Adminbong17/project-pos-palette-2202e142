import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getSmsSettings, saveSmsSettings, sendTestSms } from "@/lib/sms-admin.functions";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";

export const Route = createFileRoute("/_authenticated/admin/sms")({
  head: () => ({
    meta: [
      { title: "SMS Gateway — QweekPOS" },
      {
        name: "description",
        content: "Super-admin only SMS gateway settings: API key, secret key, sender ID and test message.",
      },
      { property: "og:title", content: "SMS Gateway — QweekPOS" },
      { property: "og:description", content: "Configure the SMS gateway used for clinic and billing messages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SmsSettingsPage,
});

const input = "w-full h-9 rounded-lg border border-border bg-input px-3 text-sm";

function SmsSettingsPage() {
  const { isSuperAdmin, isLoading } = useIsSuperAdmin();
  const load = useServerFn(getSmsSettings);
  const save = useServerFn(saveSmsSettings);
  const test = useServerFn(sendTestSms);

  const q = useQuery({
    queryKey: ["sms-settings"],
    enabled: isSuperAdmin,
    queryFn: () => load({ data: undefined as never }),
  });

  const [form, setForm] = useState({
    base_url: "http://smpp.revesms.com:7788",
    caller_id: "",
    enabled: true,
    api_key: "",
    secret_key: "",
  });
  const [testPhone, setTestPhone] = useState("");

  useEffect(() => {
    if (q.data)
      setForm((f) => ({
        ...f,
        base_url: q.data!.base_url,
        caller_id: q.data!.caller_id,
        enabled: q.data!.enabled,
      }));
  }, [q.data]);

  const saving = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: () => {
      toast.success("SMS settings saved");
      setForm((f) => ({ ...f, api_key: "", secret_key: "" }));
      q.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testing = useMutation({
    mutationFn: () => test({ data: { phone: testPhone } }),
    onSuccess: (r: any) =>
      r?.ok ? toast.success("Test SMS accepted by the gateway") : toast.error(r?.error ?? "Sending failed"),
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isSuperAdmin)
    return (
      <div className="p-6">
        <h1 className="font-display text-xl font-semibold">SMS Gateway</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only the platform super admin can view or change SMS credentials.
        </p>
      </div>
    );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold sm:text-2xl">SMS Gateway</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          REVESMS / SMSServer HTTP API. Keys stay on the server — they are never sent to any browser.
        </p>
      </div>

      <form
        className="max-w-2xl space-y-4 rounded-2xl border border-border/60 bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          saving.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>API base URL</Label>
            <input
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="http://smpp.revesms.com:7788"
              className={input}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              /sendtext is appended automatically. Examples: http://smpp.revesms.com:7788,
              https://smpp.revesms.com:7790, http://apismpp.revesms.com
            </p>
          </div>
          <div>
            <Label>API key</Label>
            <input
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder={q.data?.has_api_key ? q.data.api_key_masked : "apikey"}
              autoComplete="off"
              className={input}
            />
          </div>
          <div>
            <Label>Secret key</Label>
            <input
              value={form.secret_key}
              onChange={(e) => setForm({ ...form, secret_key: e.target.value })}
              placeholder={q.data?.has_secret_key ? q.data.secret_key_masked : "secretkey"}
              autoComplete="off"
              className={input}
            />
          </div>
          <div>
            <Label>Sender / caller ID</Label>
            <input
              value={form.caller_id}
              onChange={(e) => setForm({ ...form, caller_id: e.target.value })}
              placeholder="8801XXXXXXXXX"
              className={input}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              SMS sending enabled
            </label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leave API key / secret key blank to keep the saved values.
        </p>
        <button
          type="submit"
          disabled={saving.isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving.isPending ? "Saving…" : "Save settings"}
        </button>
      </form>

      <div className="max-w-2xl space-y-3 rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="text-sm font-semibold">Send a test SMS</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            inputMode="tel"
            placeholder="01XXXXXXXXX"
            className={`${input} max-w-xs`}
          />
          <button
            type="button"
            onClick={() => testing.mutate()}
            disabled={testing.isPending}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {testing.isPending ? "Sending…" : "Send test"}
          </button>
        </div>
        {testing.data && (
          <p className="text-xs text-muted-foreground">
            Gateway response: {(testing.data as any).status ?? "—"} {(testing.data as any).text ?? ""}
          </p>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{children}</span>;
}
