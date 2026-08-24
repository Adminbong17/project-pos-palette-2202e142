import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2, Save } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrintSizeButton } from "@/components/print-size-select";
import { printClinicSale } from "@/lib/clinic-print";


export const Route = createFileRoute("/_authenticated/clinic-sales")({
  head: () => ({
    meta: [
      { title: "Clinic Sales Counter — Bill Services & Products" },
      {
        name: "description",
        content:
          "POS-style clinic billing: pick services or products, set quantity, apply item and bill discounts, record payment and review past clinic sales.",
      },
      { property: "og:title", content: "Clinic Sales Counter — Bill Services & Products" },
      {
        property: "og:description",
        content: "POS-style clinic billing with discounts and a sales history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClinicSalesPage,
});

type Service = { id: string; name: string; kind: string; price: number };
type Line = {
  service_id: string | null;
  name: string;
  quantity: string;
  unit_price: string;
  discount: string;
};

const money = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(n || 0);

function ClinicSalesPage() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [refDoctor, setRefDoctor] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [billDiscount, setBillDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  const services = useQuery({
    queryKey: ["clinic-services-active", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_services")
        .select("id, name, kind, price")
        .eq("business_id", business!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });

  const matches = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return [];
    return (services.data ?? []).filter((x) => x.name.toLowerCase().includes(s)).slice(0, 20);
  }, [services.data, search]);

  function addLine(sv?: Service) {
    setLines((p) => [
      ...p,
      {
        service_id: sv?.id ?? null,
        name: sv?.name ?? "",
        quantity: "1",
        unit_price: sv ? String(sv.price) : "",
        discount: "",
      },
    ]);
    setSearch("");
  }

  function patchLine(i: number, patch: Partial<Line>) {
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const subtotal = lines.reduce(
    (s, l) => s + Math.max(Number(l.quantity || 0) * Number(l.unit_price || 0) - Number(l.discount || 0), 0),
    0,
  );
  const total = Math.max(subtotal - Number(billDiscount || 0), 0);
  const due = Math.max(total - Number(paid || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      const clean = lines.filter((l) => l.name.trim());
      if (clean.length === 0) throw new Error("Add at least one item");
      const { data: u } = await supabase.auth.getUser();
      const { data: sale, error } = await supabase
        .from("clinic_sales")
        .insert({
          business_id: business!.id,
          invoice_no: nextInvoiceNo,
          ref_doctor_name: refDoctor.trim() || null,

          sale_date: new Date(date).toISOString(),
          patient_name: patientName.trim() || null,
          patient_phone: patientPhone.trim() || null,
          subtotal,
          discount_amount: Number(billDiscount || 0),
          total,
          paid: Number(paid || 0),
          notes: notes.trim() || null,
          created_by: u.user?.id ?? null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const saleId = (sale as { id: string }).id;
      const { error: le } = await supabase.from("clinic_sale_lines").insert(
        clean.map((l) => ({
          sale_id: saleId,
          business_id: business!.id,
          service_id: l.service_id,
          name: l.name.trim(),
          quantity: Number(l.quantity || 0),
          unit_price: Number(l.unit_price || 0),
          discount: Number(l.discount || 0),
          line_total: Math.max(
            Number(l.quantity || 0) * Number(l.unit_price || 0) - Number(l.discount || 0),
            0,
          ),
        })) as never,
      );
      if (le) throw le;
    },
    onSuccess: () => {
      setLines([]);
      setPatientName("");
      setPatientPhone("");
      setRefDoctor("");
      setBillDiscount("");
      setPaid("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["clinic-sales"] });
      toast.success("Sale saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const history = useQuery({
    queryKey: ["clinic-sales", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_sales")
        .select("id, invoice_no, sale_date, patient_name, patient_phone, ref_doctor_name, notes, subtotal, discount_amount, total, paid, clinic_sale_lines(name, quantity, unit_price, line_total)")
        .eq("business_id", business!.id)
        .order("sale_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Auto invoice number: CS-000123, continuing from the highest existing number.
  const nextInvoiceNo = useMemo(() => {
    const rows = (history.data ?? []) as any[];
    let max = 0;
    for (const r of rows) {
      const m = /(\d+)\s*$/.exec(String(r.invoice_no ?? ""));
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `CS-${String(max + 1).padStart(6, "0")}`;
  }, [history.data]);

  const removeSale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinic_sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-sales"] });
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  const filteredHistory = useMemo(() => {
    const s = historySearch.trim().toLowerCase();
    const rows = (history.data ?? []) as any[];
    if (!s) return rows;
    return rows.filter(
      (r) =>
        (r.invoice_no ?? "").toLowerCase().includes(s) ||
        (r.patient_name ?? "").toLowerCase().includes(s) ||
        (r.patient_phone ?? "").toLowerCase().includes(s),
    );
  }, [history.data, historySearch]);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-full overflow-x-hidden">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold">Clinic Sales</h1>
          <p className="text-sm text-muted-foreground">Sell clinic services & products with discount.</p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4 mr-1" /> {save.isPending ? "Saving…" : "Save sale"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">Patient name</span>
          <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">Phone</span>
          <Input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">Invoice no. (auto)</span>
          <Input value={nextInvoiceNo} readOnly className="bg-muted/40" />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Generated automatically on save.
          </span>
        </label>
        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">Ref. doctor name (optional)</span>
          <Input value={refDoctor} onChange={(e) => setRefDoctor(e.target.value)} placeholder="Dr. …" />
        </label>

        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">Date & time</span>
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-xs text-muted-foreground mb-1.5">Notes</span>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search service / product…"
            />
            {matches.length > 0 && (
              <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addLine(m)}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground"> — {money(Number(m.price))} · {m.kind}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="secondary" onClick={() => addLine()}>
            <Plus className="h-4 w-4 mr-1" /> Manual item
          </Button>
        </div>

        <div className="space-y-2">
          {lines.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No items yet.</div>
          ) : (
            lines.map((l, i) => {
              const lt = Math.max(
                Number(l.quantity || 0) * Number(l.unit_price || 0) - Number(l.discount || 0),
                0,
              );
              return (
                <div key={i} className="rounded-xl border border-border/60 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={l.name}
                      onChange={(e) => patchLine(i, { name: e.target.value })}
                      placeholder="Item name"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive shrink-0"
                      onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="block">
                      <span className="block text-xs text-muted-foreground mb-1">Qty</span>
                      <Input type="number" step="any" value={l.quantity} onChange={(e) => patchLine(i, { quantity: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="block text-xs text-muted-foreground mb-1">Price</span>
                      <Input type="number" step="any" value={l.unit_price} onChange={(e) => patchLine(i, { unit_price: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="block text-xs text-muted-foreground mb-1">Discount</span>
                      <Input type="number" step="any" value={l.discount} onChange={(e) => patchLine(i, { discount: e.target.value })} />
                    </label>
                    <div className="self-end text-sm font-semibold">{money(lt)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-col items-end gap-1 pt-3 border-t text-sm">
          <div>Subtotal: <span className="font-semibold">{money(subtotal)}</span></div>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Bill discount</span>
            <Input className="h-8 w-28" type="number" step="any" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} />
          </label>
          <div className="text-base">Total: <span className="font-bold">{money(total)}</span></div>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Paid</span>
            <Input className="h-8 w-28" type="number" step="any" value={paid} onChange={(e) => setPaid(e.target.value)} />
          </label>
          <div>Due: <span className="font-semibold">{money(due)}</span></div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Recent sales</h2>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Invoice / patient / phone…" />
          </div>
        </div>
        {history.isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No sales yet.</div>
        ) : (
          filteredHistory.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border/60 bg-card p-3 text-sm space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {r.patient_name || "Walk-in"} {r.invoice_no ? `· ${r.invoice_no}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.sale_date).toLocaleString()} {r.patient_phone ? `· ${r.patient_phone}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{money(Number(r.total))}</div>
                  <div className="text-xs text-muted-foreground">Paid {money(Number(r.paid))}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {(r.clinic_sale_lines ?? [])
                  .map((l: any) => `${l.name} × ${Number(l.quantity)}`)
                  .join(", ")}
              </div>
              <div className="flex justify-end gap-2">
                <PrintSizeButton
                  label="Print"
                  defaultSize="80mm"
                  onPrint={(size) =>
                    printClinicSale(
                      {
                        invoice_no: r.invoice_no,
                        sale_date: r.sale_date,
                        patient_name: r.patient_name,
                        patient_phone: r.patient_phone,
                        ref_doctor_name: r.ref_doctor_name,
                        notes: r.notes,
                        subtotal: Number(r.subtotal || 0),
                        discount_amount: Number(r.discount_amount || 0),
                        total: Number(r.total || 0),
                        paid: Number(r.paid || 0),
                        lines: (r.clinic_sale_lines ?? []).map((l: any) => ({
                          name: l.name,
                          quantity: Number(l.quantity || 0),
                          unit_price: Number(l.unit_price || 0),
                          line_total: Number(l.line_total || 0),
                        })),
                      },
                      printHeader,
                      size,
                    )
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm("Delete this sale?")) removeSale.mutate(r.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
}
