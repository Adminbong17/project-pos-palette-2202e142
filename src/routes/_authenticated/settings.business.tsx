import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/business")({
  component: BusinessSettings,
});

function BusinessSettings() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin, isClinicAdmin } = useCurrentRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", sku_prefix: "", time_zone: "UTC", tax_number_1: "", tax_label_1: "",
    default_profit_percent: 25, fy_start_month: 1, accounting_method: "fifo",
    address: "", notify_phone: "", sms_sender_id: "",
  });

  const isOwner = !!business && !!user && business.owner_id === user.id;
  const canEdit = isOwner || isAdmin || isClinicAdmin;

  const { data: currencies = [] } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => (await supabase.from("currencies").select("id, code, currency, symbol").order("code")).data ?? [],
  });

  useEffect(() => {
    if (business) {
      supabase.from("businesses").select("*").eq("id", business.id).single().then(({ data }) => {
        if (data) setForm({
          name: data.name, sku_prefix: data.sku_prefix ?? "", time_zone: data.time_zone,
          tax_number_1: data.tax_number_1 ?? "", tax_label_1: data.tax_label_1 ?? "",
          default_profit_percent: Number(data.default_profit_percent),
          fy_start_month: data.fy_start_month, accounting_method: data.accounting_method,
          address: (data as any).address ?? "", notify_phone: (data as any).notify_phone ?? "",
          sms_sender_id: (data as any).sms_sender_id ?? "",
        });
      });
    }
  }, [business?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!business) return;
      const payload = {
        ...form,
        address: form.address.trim() || null,
        notify_phone: form.notify_phone.trim() || null,
        sms_sender_id: form.sms_sender_id.trim() || null,
      };
      const { error } = await supabase.from("businesses").update(payload as never).eq("id", business.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Business updated");
      qc.invalidateQueries({ queryKey: ["current-business"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!business) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <form className="rounded-2xl border border-border/60 bg-card p-6 space-y-4 max-w-2xl"
      onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      {!canEdit && (
        <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Only the owner or an admin can change these settings.
        </p>
      )}
      <fieldset disabled={!canEdit} className="space-y-4 disabled:opacity-70">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business / clinic name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
        </Field>
        <Field label="SKU prefix">
          <input value={form.sku_prefix} onChange={(e) => setForm({ ...form, sku_prefix: e.target.value.toUpperCase() })} maxLength={5} className={input} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address (printed on receipts & invoices)">
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2}
              placeholder="House, road, area, city" className={`${input} h-auto py-2`} />
          </Field>
        </div>
        <Field label="Clinic SMS / contact number">
          <input value={form.notify_phone} onChange={(e) => setForm({ ...form, notify_phone: e.target.value })}
            inputMode="tel" placeholder="01XXXXXXXXX" className={input} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="SMS sender name / ID (shown to customers)">
            <input value={form.sms_sender_id} onChange={(e) => setForm({ ...form, sms_sender_id: e.target.value })}
              placeholder="e.g. SHEIKHRX or 8801XXXXXXXXX" maxLength={20} className={input} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Leave empty to use the system default sender. The ID must be approved by the SMS gateway,
              otherwise messages will fail.
            </p>
          </Field>
        </div>
        <Field label="Time zone">
          <input value={form.time_zone} onChange={(e) => setForm({ ...form, time_zone: e.target.value })} className={input} />
        </Field>
        <Field label="Default profit %">
          <input type="number" step="0.01" value={form.default_profit_percent}
            onChange={(e) => setForm({ ...form, default_profit_percent: Number(e.target.value) })} className={input} />
        </Field>
        <Field label="Tax label 1">
          <input value={form.tax_label_1} onChange={(e) => setForm({ ...form, tax_label_1: e.target.value })} placeholder="GSTIN" className={input} />
        </Field>
        <Field label="Tax number 1">
          <input value={form.tax_number_1} onChange={(e) => setForm({ ...form, tax_number_1: e.target.value })} className={input} />
        </Field>
        <Field label="Fiscal year start month">
          <select value={form.fy_start_month} onChange={(e) => setForm({ ...form, fy_start_month: Number(e.target.value) })} className={input}>
            {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Accounting method">
          <select value={form.accounting_method} onChange={(e) => setForm({ ...form, accounting_method: e.target.value })} className={input}>
            <option value="fifo">FIFO</option>
            <option value="lifo">LIFO</option>
            <option value="avco">Average</option>
          </select>
        </Field>
      </div>
      <button type="submit" disabled={save.isPending || !canEdit}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {save.isPending ? "Saving…" : "Save changes"}
      </button>
      </fieldset>
    </form>
  );
}

const input = "w-full h-9 rounded-lg border border-border bg-input px-3 text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</span>{children}</label>;
}
