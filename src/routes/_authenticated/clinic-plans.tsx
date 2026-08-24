import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarClock,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Wallet,

  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useBusinessDoctors } from "@/hooks/use-business-doctors";
import { sendPlanCreatedSms, sendPlanPaymentSms } from "@/lib/clinic-plans.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/clinic-plans")({
  head: () => ({
    meta: [
      { title: "Treatment Plans & Instalments — Clinic" },
      {
        name: "description",
        content:
          "Issue doctor-advised clinic services to a patient and collect the amount in instalments, with an SMS receipt to the patient and clinic on every payment.",
      },
      { property: "og:title", content: "Treatment Plans & Instalments — Clinic" },
      {
        property: "og:description",
        content: "Track patient treatment plans, instalment due dates and payments with SMS receipts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClinicPlansPage,
});

type Service = { id: string; name: string; price: number };
type Plan = {
  id: string;
  patient_code: string | null;
  patient_name: string;
  patient_phone: string | null;
  doctor_id: string | null;
  total_amount: number;
  discount: number;
  start_date: string;
  installment_count: number;
  installment_interval_days: number;
  status: string;
  notes: string | null;
};
type Installment = {
  id: string;
  plan_id: string;
  seq: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: string;
};
type Payment = {
  id: string;
  plan_id: string;
  installment_id: string | null;
  pay_date: string;
  amount: number;
  method: string;
  note: string | null;
  sms_status: string | null;
};

function todayDhaka() {
  return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
}
function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function tk(n: number) {
  return `৳${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function ClinicPlansPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const qc = useQueryClient();
  const doctors = useBusinessDoctors(businessId);
  const sendSms = useServerFn(sendPlanPaymentSms);
  const sendCreatedSms = useServerFn(sendPlanCreatedSms);

  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    patient_name: "",
    patient_code: "",
    patient_phone: "",
    doctor_id: "",
    discount: "",
    start_date: todayDhaka(),
    installment_count: "3",
    installment_interval_days: "30",
    notes: "",
  });
  const [cart, setCart] = useState<{ service_id: string | null; name: string; unit_price: number; quantity: number }[]>(
    [],
  );

  const services = useQuery({
    queryKey: ["clinic-services", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_services")
        .select("id, name, price")
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });

  // Look up patients the doctors already printed a prescription for, by patient ID.
  const patientLookup = useQuery({
    queryKey: ["clinic-plan-patient-lookup", businessId, form.patient_code.trim()],
    enabled: !!businessId && form.patient_code.trim().length >= 2,
    queryFn: async () => {
      const term = form.patient_code.trim();
      const { data, error } = await supabase
        .from("prescriptions")
        .select("patient_code, patient_name, patient_phone, created_at")
        .eq("business_id", businessId!)
        .ilike("patient_code", `%${term}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const seen = new Set<string>();
      const rows: { patient_code: string | null; patient_name: string; patient_phone: string | null }[] = [];
      for (const r of (data ?? []) as any[]) {
        const key = String(r.patient_code ?? "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        rows.push({ patient_code: r.patient_code, patient_name: r.patient_name, patient_phone: r.patient_phone });
        if (rows.length >= 10) break;
      }
      return rows;
    },
  });
  const patientMatches = (patientLookup.data ?? []).filter(
    (m) => !(m.patient_code === form.patient_code.trim() && m.patient_name === form.patient_name),
  );



  const plans = useQuery({
    queryKey: ["clinic-plans", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_treatment_plans")
        .select(
          "id, patient_code, patient_name, patient_phone, doctor_id, total_amount, discount, start_date, installment_count, installment_interval_days, status, notes",
        )
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  const installments = useQuery({
    queryKey: ["clinic-plan-installments", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_plan_installments")
        .select("id, plan_id, seq, due_date, amount, paid_amount, status")
        .eq("business_id", businessId!)
        .order("seq");
      if (error) throw error;
      return (data ?? []) as Installment[];
    },
  });

  const payments = useQuery({
    queryKey: ["clinic-plan-payments", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_plan_payments")
        .select("id, plan_id, installment_id, pay_date, amount, method, note, sms_status")
        .eq("business_id", businessId!)
        .order("pay_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });

  const planLines = useQuery({
    queryKey: ["clinic-plan-lines", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_plan_lines")
        .select("plan_id, name, quantity, unit_price, line_total")
        .eq("business_id", businessId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });



  const subtotal = cart.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const net = Math.max(0, subtotal - Number(form.discount || 0));


  const createPlan = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business");
      if (!form.patient_name.trim()) throw new Error("Patient name is required");
      if (cart.length === 0) throw new Error("Add at least one service");
      const count = Math.max(1, Number(form.installment_count || 1));
      const gap = Math.max(1, Number(form.installment_interval_days || 30));
      const { data: u } = await supabase.auth.getUser();

      const { data: plan, error } = await supabase
        .from("clinic_treatment_plans")
        .insert({
          business_id: businessId,
          doctor_id: form.doctor_id || null,
          patient_name: form.patient_name.trim(),
          patient_code: form.patient_code.trim() || null,
          patient_phone: form.patient_phone.trim() || null,
          total_amount: subtotal,
          discount: Number(form.discount || 0),
          start_date: form.start_date,
          installment_count: count,
          installment_interval_days: gap,
          notes: form.notes.trim() || null,
          created_by: u.user?.id ?? null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const planId = (plan as any).id as string;

      const lines = cart.map((l) => ({
        business_id: businessId,
        plan_id: planId,
        service_id: l.service_id,
        name: l.name,
        unit_price: l.unit_price,
        quantity: l.quantity,
        line_total: l.unit_price * l.quantity,
      }));
      const { error: lErr } = await supabase.from("clinic_plan_lines").insert(lines as never);
      if (lErr) throw lErr;

      const per = Math.floor((net / count) * 100) / 100;
      const rows = Array.from({ length: count }, (_, i) => ({
        business_id: businessId,
        plan_id: planId,
        seq: i + 1,
        due_date: addDays(form.start_date, i * gap),
        amount: i === count - 1 ? Number((net - per * (count - 1)).toFixed(2)) : per,
      }));
      const { error: iErr } = await supabase.from("clinic_plan_installments").insert(rows as never);
      if (iErr) throw iErr;
      return planId;
    },
    onSuccess: (planId) => {
      toast.success("Treatment plan created");
      // Notify the clinic admin number with the plan summary.
      sendCreatedSms({ data: { plan_id: planId } })
        .then((r: any) => {
          if (r?.status === "sent") toast.success("Plan summary SMS sent to clinic admin");
          else if (r?.status === "no_phone") toast.message("No clinic SMS number set in Settings");
        })
        .catch(() => toast.error("Plan summary SMS could not be sent"));
      setCart([]);
      setForm({
        patient_name: "",
        patient_code: "",
        patient_phone: "",
        doctor_id: "",
        discount: "",
        start_date: todayDhaka(),
        installment_count: "3",
        installment_interval_days: "30",
        notes: "",
      });
      setOpenId(planId);
      qc.invalidateQueries({ queryKey: ["clinic-plans"] });
      qc.invalidateQueries({ queryKey: ["clinic-plan-installments"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create the plan"),
  });

  const pay = useMutation({
    mutationFn: async (v: { plan: Plan; inst: Installment; amount: number; method: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("clinic_plan_payments")
        .insert({
          business_id: businessId!,
          plan_id: v.plan.id,
          installment_id: v.inst.id,
          pay_date: todayDhaka(),
          amount: v.amount,
          method: v.method,
          created_by: u.user?.id ?? null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const res = await sendSms({ data: { payment_id: (data as any).id as string } });
      return res;
    },
    onSuccess: (res: any) => {
      if (res?.status === "sent" || res?.status === "partial") toast.success("Payment saved · SMS sent");
      else if (res?.status === "no_phone") toast.success("Payment saved · no phone number for SMS");
      else toast.success("Payment saved · SMS could not be delivered");
      qc.invalidateQueries({ queryKey: ["clinic-plan-installments"] });
      qc.invalidateQueries({ queryKey: ["clinic-plan-payments"] });
      qc.invalidateQueries({ queryKey: ["clinic-plans"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save the payment"),
  });

  const delPlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinic_treatment_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan removed");
      qc.invalidateQueries({ queryKey: ["clinic-plans"] });
      qc.invalidateQueries({ queryKey: ["clinic-plan-installments"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove the plan"),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const rows = plans.data ?? [];
    if (!s) return rows;
    return rows.filter((p) =>
      [p.patient_name, p.patient_code, p.patient_phone, p.status]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ")
        .includes(s),
    );
  }, [plans.data, search]);

  const doctorName = (id: string | null) =>
    doctors.data?.find((d: any) => d.user_id === id)?.name ?? null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Treatment Plans & Instalments</h1>
        <p className="text-sm text-muted-foreground">
          A doctor advises services, the patient pays in instalments — every payment sends an SMS receipt to the
          patient and the clinic.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" /> New treatment plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Label className="mb-1 block text-xs">Patient ID (search)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-8 text-sm"
                  placeholder="e.g. JOY258369"
                  value={form.patient_code}
                  onChange={(e) => setForm({ ...form, patient_code: e.target.value })}
                />
              </div>
              {patientMatches.length > 0 && (
                <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
                  {patientMatches.map((m) => (
                    <button
                      key={`${m.patient_code}-${m.patient_name}-${m.patient_phone ?? ""}`}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          patient_code: m.patient_code ?? "",
                          patient_name: m.patient_name ?? "",
                          patient_phone: m.patient_phone ?? "",
                        })
                      }
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                    >
                      <span className="font-medium">{m.patient_code}</span>
                      <span className="text-xs text-muted-foreground"> — {m.patient_name}</span>
                      {m.patient_phone && (
                        <span className="text-xs text-muted-foreground"> · {m.patient_phone}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="mb-1 block text-xs">Patient name *</Label>
              <Input
                className="h-9 text-sm"
                value={form.patient_name}
                onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Patient phone (SMS)</Label>
              <Input
                className="h-9 text-sm"
                inputMode="tel"
                value={form.patient_phone}
                onChange={(e) => setForm({ ...form, patient_phone: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Advised by (doctor)</Label>
              <select
                className="h-9 w-full rounded-md border border-border bg-input px-2 text-sm"
                value={form.doctor_id}
                onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}
              >
                <option value="">— Select doctor —</option>
                {(doctors.data ?? []).map((d: any) => (
                  <option key={d.user_id} value={d.user_id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 p-2">
            <div className="mb-2 text-xs font-medium">Services advised</div>
            <div className="flex flex-wrap gap-1.5">
              {(services.data ?? []).map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() =>
                    setCart((c) => {
                      const i = c.findIndex((l) => l.service_id === s.id);
                      if (i >= 0) {
                        const next = [...c];
                        next[i] = { ...next[i]!, quantity: next[i]!.quantity + 1 };
                        return next;
                      }
                      return [...c, { service_id: s.id, name: s.name, unit_price: Number(s.price), quantity: 1 }];
                    })
                  }
                >
                  {s.name} · {tk(s.price)}
                </Button>
              ))}
              {(services.data ?? []).length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Add items in Products & Services first.
                </span>
              )}
            </div>

            {cart.length > 0 && (
              <div className="mt-3 space-y-1">
                {cart.map((l, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="min-w-32 font-medium">{l.name}</span>
                    <Input
                      className="h-8 w-20 text-xs"
                      inputMode="decimal"
                      value={String(l.unit_price)}
                      onChange={(e) =>
                        setCart((c) =>
                          c.map((x, j) => (j === i ? { ...x, unit_price: Number(e.target.value || 0) } : x)),
                        )
                      }
                    />
                    <span>×</span>
                    <Input
                      className="h-8 w-16 text-xs"
                      inputMode="decimal"
                      value={String(l.quantity)}
                      onChange={(e) =>
                        setCart((c) =>
                          c.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value || 0) } : x)),
                        )
                      }
                    />
                    <span className="font-medium">{tk(l.unit_price * l.quantity)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="ml-auto h-7 w-7"
                      onClick={() => setCart((c) => c.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label className="mb-1 block text-xs">Discount</Label>
              <Input
                className="h-9 text-sm"
                inputMode="decimal"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">First due date</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Instalments</Label>
              <Input
                className="h-9 text-sm"
                inputMode="numeric"
                value={form.installment_count}
                onChange={(e) => setForm({ ...form, installment_count: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Gap (days)</Label>
              <Input
                className="h-9 text-sm"
                inputMode="numeric"
                value={form.installment_interval_days}
                onChange={(e) => setForm({ ...form, installment_interval_days: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Note</Label>
              <Input
                className="h-9 text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">
              Total <b>{tk(subtotal)}</b> · Payable <b>{tk(net)}</b>
            </span>
            <Button onClick={() => createPlan.mutate()} disabled={createPlan.isPending}>
              <CalendarClock className="mr-1 h-4 w-4" />
              {createPlan.isPending ? "Saving…" : "Create plan & schedule"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" /> Plans
            <span className="text-xs font-normal text-muted-foreground">{filtered.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search patient / ID / phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {plans.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No treatment plan yet.</p>
          ) : (
            filtered.map((p) => {
              const inst = (installments.data ?? []).filter((i) => i.plan_id === p.id);
              const paid = (payments.data ?? [])
                .filter((x) => x.plan_id === p.id)
                .reduce((s, x) => s + Number(x.amount || 0), 0);
              const payable = Number(p.total_amount) - Number(p.discount);
              const open = openId === p.id;
              return (
                <div key={p.id} className="rounded-xl border border-border/60">
                  <button
                    className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm"
                    onClick={() => setOpenId(open ? null : p.id)}
                  >
                    <span className="font-medium">{p.patient_name}</span>
                    {p.patient_code && <Badge variant="secondary">{p.patient_code}</Badge>}
                    {doctorName(p.doctor_id) && (
                      <span className="text-xs text-muted-foreground">Dr. {doctorName(p.doctor_id)}</span>
                    )}
                    <Badge variant={p.status === "completed" ? "secondary" : "outline"}>{p.status}</Badge>
                    <span className="ml-auto text-xs">
                      {tk(paid)} / {tk(payable)} · due <b>{tk(Math.max(0, payable - paid))}</b>
                    </span>
                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {open && (
                    <div className="space-y-2 border-t border-border/60 p-3">
                      {inst.map((i) => (
                        <InstallmentRow
                          key={i.id}
                          inst={i}
                          onPay={(amount, method) => pay.mutate({ plan: p, inst: i, amount, method })}
                          busy={pay.isPending}
                        />
                      ))}

                      <div className="pt-2">
                        <div className="mb-1 text-xs font-medium">Payments</div>
                        {(payments.data ?? []).filter((x) => x.plan_id === p.id).length === 0 ? (
                          <p className="text-xs text-muted-foreground">No payment yet.</p>
                        ) : (
                          (payments.data ?? [])
                            .filter((x) => x.plan_id === p.id)
                            .map((x) => (
                              <div key={x.id} className="flex flex-wrap items-center gap-2 text-xs">
                                <span>{x.pay_date}</span>
                                <span className="font-medium">{tk(x.amount)}</span>
                                <Badge variant="outline">{x.method}</Badge>
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <MessageSquare className="h-3 w-3" /> {x.sms_status ?? "—"}
                                </span>
                              </div>
                            ))
                        )}
                      </div>

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] text-destructive"
                          onClick={() => {
                            if (window.confirm(`Remove the plan of ${p.patient_name}?`)) delPlan.mutate(p.id);
                          }}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove plan
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InstallmentRow({
  inst,
  onPay,
  busy,
}: {
  inst: Installment;
  onPay: (amount: number, method: string) => void;
  busy: boolean;
}) {
  const remaining = Math.max(0, Number(inst.amount) - Number(inst.paid_amount));
  const [amount, setAmount] = useState(String(remaining || ""));
  const [method, setMethod] = useState("cash");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5 text-xs">
      <span className="w-6 text-muted-foreground">#{inst.seq}</span>
      <span>{inst.due_date}</span>
      <span className="font-medium">{tk(inst.amount)}</span>
      <Badge variant={inst.status === "paid" ? "secondary" : "outline"}>{inst.status}</Badge>
      {Number(inst.paid_amount) > 0 && (
        <span className="text-muted-foreground">paid {tk(inst.paid_amount)}</span>
      )}
      {remaining > 0 && (
        <div className="ml-auto flex items-center gap-1.5">
          <Input
            className="h-7 w-20 text-xs"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className="h-7 rounded-md border border-border bg-input px-1 text-[11px]"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="card">Card</option>
            <option value="bank">Bank</option>
          </select>
          <Button
            size="sm"
            className="h-7 text-[11px]"
            disabled={busy || !(Number(amount) > 0)}
            onClick={() => onPay(Number(amount), method)}
          >
            Take payment
          </Button>
        </div>
      )}
    </div>
  );
}
