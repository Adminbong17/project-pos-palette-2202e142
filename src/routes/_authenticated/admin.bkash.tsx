import { createFileRoute } from "@tanstack/react-router";
import { fmtDateTime } from "@/lib/format-date";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getBkashSettings, saveBkashSettings, testBkashCredentials } from "@/lib/bkash-admin.functions";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";

export const Route = createFileRoute("/_authenticated/admin/bkash")({
  head: () => ({
    meta: [
      { title: "bKash Payment Gateway — QweekRx" },
      {
        name: "description",
        content:
          "Super-admin only bKash Tokenized Checkout settings: app key, app secret, username, password and credit rate.",
      },
      { property: "og:title", content: "bKash Payment Gateway — QweekRx" },
      {
        property: "og:description",
        content: "Configure the bKash gateway used for Rx credit top-ups and monthly bills.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BkashSettingsPage,
});

const inputCls = "w-full h-9 rounded-lg border border-border bg-input px-3 text-sm";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-xs font-medium text-muted-foreground">{children}</div>;
}

function BkashSettingsPage() {
  const { isSuperAdmin, isLoading } = useIsSuperAdmin();
  const load = useServerFn(getBkashSettings);
  const save = useServerFn(saveBkashSettings);
  const test = useServerFn(testBkashCredentials);

  const q = useQuery({
    queryKey: ["bkash-settings"],
    enabled: isSuperAdmin,
    queryFn: () => load({ data: undefined as never }),
  });

  const [form, setForm] = useState({
    environment: "live" as "live" | "sandbox",
    rate_per_credit: 3,
    enabled: false,
    app_key: "",
    app_secret: "",
    username: "",
    password: "",
  });

  useEffect(() => {
    if (q.data)
      setForm((f) => ({
        ...f,
        environment: q.data!.environment,
        rate_per_credit: q.data!.rate_per_credit,
        enabled: q.data!.enabled,
      }));
  }, [q.data]);

  const saving = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: () => {
      toast.success("bKash settings saved");
      setForm((f) => ({ ...f, app_key: "", app_secret: "", username: "", password: "" }));
      q.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testing = useMutation({
    mutationFn: () => test({ data: undefined as never }),
    onSuccess: (r: any) =>
      r?.ok
        ? toast.success(`bKash credentials are working (${r.environment})`)
        : toast.error(r?.error ?? "bKash rejected the credentials"),
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isSuperAdmin)
    return (
      <div className="p-6">
        <h1 className="font-display text-xl font-semibold">bKash Payment Gateway</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only the platform super admin can view or change bKash credentials.
        </p>
      </div>
    );

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-xl font-semibold sm:text-2xl">bKash Payment Gateway</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          bKash Tokenized Checkout (PGW). Credentials stay on the server — they are never sent to any
          browser.
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
          <div>
            <Label>Environment</Label>
            <select
              value={form.environment}
              onChange={(e) => setForm({ ...form, environment: e.target.value as "live" | "sandbox" })}
              className={inputCls}
            >
              <option value="live">Live (tokenized.pay.bka.sh)</option>
              <option value="sandbox">Sandbox (test)</option>
            </select>
          </div>
          <div>
            <Label>Rate per credit (tk)</Label>
            <input
              inputMode="decimal"
              value={form.rate_per_credit}
              onChange={(e) => setForm({ ...form, rate_per_credit: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div>
            <Label>App key</Label>
            <input
              value={form.app_key}
              onChange={(e) => setForm({ ...form, app_key: e.target.value })}
              placeholder={q.data?.has_app_key ? q.data.app_key_masked : "app_key"}
              autoComplete="off"
              className={inputCls}
            />
          </div>
          <div>
            <Label>App secret</Label>
            <input
              value={form.app_secret}
              onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
              placeholder={q.data?.has_app_secret ? q.data.app_secret_masked : "app_secret"}
              autoComplete="off"
              className={inputCls}
            />
          </div>
          <div>
            <Label>Merchant username</Label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder={q.data?.has_username ? q.data.username_masked : "username"}
              autoComplete="off"
              className={inputCls}
            />
          </div>
          <div>
            <Label>Merchant password</Label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={q.data?.has_password ? "••••••••" : "password"}
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              bKash payments enabled
            </label>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Leave any credential blank to keep the saved value. Used for Rx credit top-ups, monthly Rx
          bills and monthly business bills.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving.isPending ? "Saving…" : "Save settings"}
          </button>
          <button
            type="button"
            disabled={testing.isPending}
            onClick={() => testing.mutate()}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {testing.isPending ? "Checking…" : "Verify credentials"}
          </button>
        </div>

        {q.data?.updated_at ? (
          <p className="text-xs text-muted-foreground">
            Last updated: {fmtDateTime(q.data.updated_at)}
          </p>
        ) : null}
      </form>
    </div>
  );
}
