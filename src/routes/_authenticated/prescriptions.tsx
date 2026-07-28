import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Search, FileText, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { fetchAll } from "@/lib/fetch-all";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PrintSizeButton, type PrintSize } from "@/components/print-size-select";

export const Route = createFileRoute("/_authenticated/prescriptions")({
  head: () => ({
    meta: [
      { title: "Prescriptions — QweekPOS" },
      { name: "description", content: "Create, manage, and print patient prescriptions." },
    ],
  }),
  component: PrescriptionsPage,
});

type Contact = { id: string; name: string; mobile: string | null };
type ProductOpt = { id: string; name: string; variation_id: string };
type Line = {
  id?: string;
  product_id: string | null;
  variation_id: string | null;
  medicine_name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number;
};
type Rx = {
  id: string;
  rx_no: string | null;
  rx_date: string;
  patient_name: string;
  patient_age: string | null;
  patient_gender: string | null;
  patient_phone: string | null;
  doctor_name: string | null;
  doctor_qualification: string | null;
  diagnosis: string | null;
  vitals: string | null;
  advice: string | null;
  next_visit: string | null;
  notes: string | null;
  contact_id: string | null;
};

const emptyLine = (): Line => ({
  product_id: null, variation_id: null, medicine_name: "",
  dose: "", frequency: "", duration: "", instructions: "", quantity: 1,
});

const fmtDate = (d: string) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const p = dhakaParts(dt);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};


/** Current date/time in Bangladesh (Asia/Dhaka) as parts. */
function dhakaParts(d: Date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
  return p;
}

/** "YYYY-MM-DDTHH:mm" in Bangladesh time, for datetime-local inputs. */
function dhakaLocalInput(d: Date = new Date()) {
  const p = dhakaParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

/** Convert a Bangladesh-local "YYYY-MM-DDTHH:mm" string to a real UTC ISO string. */
function dhakaInputToIso(local: string) {
  if (!local) return new Date().toISOString();
  // Bangladesh is a fixed UTC+06:00 offset (no DST).
  const iso = new Date(`${local}:00+06:00`);
  return isNaN(iso.getTime()) ? new Date(local).toISOString() : iso.toISOString();
}

/** DDMMYYYY-XXXXXX (6 random uppercase letters) */
function genRxNo(d: Date = new Date()) {
  const p = dhakaParts(d);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += letters[Math.floor(Math.random() * 26)];
  return `${p.day}${p.month}${p.year}-${suffix}`;
}

function PrescriptionsPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rx | null>(null);
  const [form, setForm] = useState({
    rx_no: "", rx_date: dhakaLocalInput(),
    patient_name: "", patient_age: "", patient_gender: "",
    patient_phone: "", contact_id: "",
    doctor_name: "", doctor_qualification: "",
    diagnosis: "", vitals: "", advice: "", next_visit: "", notes: "",
  });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  // Doctor identity comes from the logged-in user's profile (set by admin).
  const me = useQuery({
    queryKey: ["my-doctor-profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("profiles")
        .select("doctor_name, doctor_qualification, first_name, last_name")
        .eq("id", uid)
        .maybeSingle();
      if (!data) return null;
      return {
        doctor_name:
          (data as any).doctor_name?.trim() ||
          [data.first_name, data.last_name].filter(Boolean).join(" "),
        doctor_qualification: ((data as any).doctor_qualification ?? "").trim(),
      };
    },
  });


  const list = useQuery({
    queryKey: ["prescriptions", businessId, search],
    enabled: !!businessId,
    queryFn: async () => {
      let q = supabase.from("prescriptions")
        .select("id, rx_no, rx_date, patient_name, patient_age, patient_gender, patient_phone, doctor_name, doctor_qualification, diagnosis, vitals, advice, next_visit, notes, contact_id")
        .eq("business_id", businessId!)
        .order("rx_date", { ascending: false })
        .limit(500);
      if (search.trim()) {
        q = q.or(`patient_name.ilike.%${search}%,rx_no.ilike.%${search}%,patient_phone.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Rx[];
    },
  });

  const contacts = useQuery({
    queryKey: ["rx-contacts", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts")
        .select("id, name, mobile")
        .eq("business_id", businessId!)
        .order("name")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const products = useQuery({
    queryKey: ["rx-products", businessId],
    enabled: !!businessId && open,
    queryFn: async () => {
      const rows = await fetchAll<any>(() =>
        supabase.from("products")
          .select("id, name, variations(id)")
          .eq("business_id", businessId!)
          .eq("is_inactive", false)
          .order("name"),
      );
      const opts: ProductOpt[] = [];
      for (const p of rows) {
        const v = (p.variations ?? [])[0];
        if (v) opts.push({ id: p.id, name: p.name, variation_id: v.id });
      }
      return opts;
    },
  });

  const resetForm = () => {
    setEditing(null);
    setForm({
      rx_no: genRxNo(), rx_date: dhakaLocalInput(),
      patient_name: "", patient_age: "", patient_gender: "",
      patient_phone: "", contact_id: "",
      doctor_name: me.data?.doctor_name ?? "",
      doctor_qualification: me.data?.doctor_qualification ?? "",
      diagnosis: "", vitals: "", advice: "", next_visit: "", notes: "",
    });
    setLines([emptyLine()]);
  };

  const openNew = () => { resetForm(); setOpen(true); };

  const openEdit = async (rx: Rx) => {
    setEditing(rx);
    setForm({
      rx_no: rx.rx_no ?? genRxNo(),
      rx_date: rx.rx_date ? dhakaLocalInput(new Date(rx.rx_date)) : dhakaLocalInput(),

      patient_name: rx.patient_name ?? "",
      patient_age: rx.patient_age ?? "",
      patient_gender: rx.patient_gender ?? "",
      patient_phone: rx.patient_phone ?? "",
      contact_id: rx.contact_id ?? "",
      doctor_name: rx.doctor_name ?? "",
      doctor_qualification: rx.doctor_qualification ?? "",
      diagnosis: rx.diagnosis ?? "",
      vitals: rx.vitals ?? "",
      advice: rx.advice ?? "",
      next_visit: rx.next_visit ?? "",
      notes: rx.notes ?? "",
    });
    const { data } = await supabase.from("prescription_lines")
      .select("id, product_id, variation_id, medicine_name, dose, frequency, duration, instructions, quantity")
      .eq("prescription_id", rx.id)
      .order("sort_order");
    setLines(((data ?? []) as Line[]).length ? (data as Line[]) : [emptyLine()]);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business");
      if (!form.patient_name.trim()) throw new Error("Patient name required");
      const valid = lines.filter((l) => l.medicine_name.trim());
      if (!valid.length) throw new Error("Add at least one medicine");

      const payload = {
        business_id: businessId,
        rx_no: form.rx_no.trim() || genRxNo(),
        rx_date: dhakaInputToIso(form.rx_date),
        patient_name: form.patient_name.trim(),
        patient_age: form.patient_age.trim() || null,
        patient_gender: form.patient_gender || null,
        patient_phone: form.patient_phone.trim() || null,
        contact_id: form.contact_id || null,
        doctor_name: (form.doctor_name || me.data?.doctor_name || "").trim() || null,
        doctor_qualification: (form.doctor_qualification || me.data?.doctor_qualification || "").trim() || null,

        diagnosis: form.diagnosis.trim() || null,
        vitals: form.vitals.trim() || null,
        advice: form.advice.trim() || null,
        next_visit: form.next_visit || null,
        notes: form.notes.trim() || null,
      };

      let rxId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("prescriptions").update(payload).eq("id", editing.id);
        if (error) throw error;
        await supabase.from("prescription_lines").delete().eq("prescription_id", editing.id);
      } else {
        const { data, error } = await supabase.from("prescriptions").insert(payload).select("id").single();
        if (error) throw error;
        rxId = data.id;
      }
      const lineRows = valid.map((l, idx) => ({
        prescription_id: rxId!,
        product_id: l.product_id,
        variation_id: l.variation_id,
        medicine_name: l.medicine_name.trim(),
        dose: l.dose.trim() || null,
        frequency: l.frequency.trim() || null,
        duration: l.duration.trim() || null,
        instructions: l.instructions.trim() || null,
        quantity: Number(l.quantity) || 0,
        sort_order: idx,
      }));
      if (lineRows.length) {
        const { error } = await supabase.from("prescription_lines").insert(lineRows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Prescription saved");
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prescriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  const printRx = async (rx: Rx, size: PrintSize) => {
    const { data: linesData } = await supabase.from("prescription_lines")
      .select("medicine_name, dose, frequency, duration, instructions, quantity")
      .eq("prescription_id", rx.id)
      .order("sort_order");
    const rxLines = (linesData ?? []) as Line[];
    const biz = business as any;
    const bizName = biz?.name ?? "";
    const bizAddr = biz?.address ?? "";
    const bizPhone = biz?.mobile ?? "";

    const widthCss = size === "A4" ? "210mm" : size === "80mm" ? "80mm" : "58mm";
    const pageCss = size === "A4" ? "A4" : `${size} auto`;
    const padCss = size === "A4" ? "16mm" : "4mm";
    const fs = size === "58mm" ? "10px" : size === "80mm" ? "11px" : "12px";

    const esc = (s: string) => s.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));
    const linesHtml = rxLines.length
      ? rxLines.map((l, i) => `
        <div style="margin:6px 0;padding:4px 0;border-bottom:1px dashed #999;">
          <div style="font-weight:bold;">${i + 1}. ${esc(l.medicine_name)}${l.quantity ? ` &nbsp;<span style="font-weight:normal;">(Qty: ${l.quantity})</span>` : ""}</div>
          ${l.dose ? `<div>Dose: ${esc(l.dose)}</div>` : ""}
          ${l.frequency ? `<div>Frequency: ${esc(l.frequency)}</div>` : ""}
          ${l.duration ? `<div>Duration: ${esc(l.duration)}</div>` : ""}
          ${l.instructions ? `<div><em>${esc(l.instructions)}</em></div>` : ""}
        </div>`).join("")
      : "<div>No medicines</div>";

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rx ${esc(rx.rx_no ?? "")}</title>
    <style>
      @page { size: ${pageCss}; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, sans-serif; font-size: ${fs}; }
      .page { width: ${widthCss}; padding: ${padCss}; box-sizing: border-box; }
      h1,h2,h3,p { margin: 2px 0; }
      .center { text-align: center; }
      .row { display: flex; justify-content: space-between; gap: 8px; }
      .header { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
      .rx-mark { font-size: 22px; font-weight: bold; margin-right: 6px; }
      .box { border: 1px solid #999; padding: 6px; margin: 6px 0; border-radius: 4px; }
      .label { color: #444; font-size: 0.9em; }
      .footer { margin-top: 14px; border-top: 1px dashed #666; padding-top: 6px; text-align: center; font-size: 0.85em; }
    </style></head><body>
    <div class="page">
      <div class="header center">
        <h2>${esc(bizName)}</h2>
        ${bizAddr ? `<div>${esc(bizAddr)}</div>` : ""}
        ${bizPhone ? `<div>Phone: ${esc(bizPhone)}</div>` : ""}
        ${rx.doctor_name ? `<div style="margin-top:4px;"><strong>Dr. ${esc(rx.doctor_name)}</strong>${rx.doctor_qualification ? ` — ${esc(rx.doctor_qualification)}` : ""}</div>` : ""}
      </div>
      <div class="row">
        <div><span class="label">Rx No:</span> ${esc(rx.rx_no ?? "—")}</div>
        <div><span class="label">Date:</span> ${fmtDate(rx.rx_date)}</div>
      </div>
      <div class="box">
        <div class="row"><div><strong>${esc(rx.patient_name)}</strong></div>
          <div>${esc(rx.patient_age ?? "")}${rx.patient_gender ? ` / ${esc(rx.patient_gender)}` : ""}</div></div>
        ${rx.patient_phone ? `<div class="label">Phone: ${esc(rx.patient_phone)}</div>` : ""}
        ${rx.vitals ? `<div class="label">Vitals: ${esc(rx.vitals)}</div>` : ""}
        ${rx.diagnosis ? `<div><span class="label">Diagnosis:</span> ${esc(rx.diagnosis)}</div>` : ""}
      </div>
      <div><span class="rx-mark">℞</span></div>
      <div>${linesHtml}</div>
      ${rx.advice ? `<div class="box"><span class="label">Advice:</span><br>${esc(rx.advice).replace(/\n/g, "<br>")}</div>` : ""}
      ${rx.next_visit ? `<div style="margin-top:6px;"><span class="label">Next visit:</span> ${fmtDate(rx.next_visit)}</div>` : ""}
      ${rx.notes ? `<div style="margin-top:6px;font-size:0.9em;">${esc(rx.notes)}</div>` : ""}
      <div class="footer">Doctor's signature: ______________________</div>
    </div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),200);}</script>
    </body></html>`;

    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) { toast.error("Popup blocked"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><FileText className="h-6 w-6" /> Prescriptions</h1>
          <p className="text-sm text-muted-foreground">Create, manage, and print patient prescriptions.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search patient / Rx no / phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-72" />
          </div>
          <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> New Prescription</Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Rx No</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Age / Sex</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Diagnosis</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !list.data?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No prescriptions yet.</TableCell></TableRow>
            ) : list.data.map((rx) => (
              <TableRow key={rx.id}>
                <TableCell className="whitespace-nowrap">{fmtDate(rx.rx_date)}</TableCell>
                <TableCell>{rx.rx_no ?? <Badge variant="outline">—</Badge>}</TableCell>
                <TableCell className="font-medium">{rx.patient_name}</TableCell>
                <TableCell className="text-sm">{rx.patient_age ?? "—"}{rx.patient_gender ? ` / ${rx.patient_gender}` : ""}</TableCell>
                <TableCell className="text-sm">{rx.doctor_name ?? "—"}</TableCell>
                <TableCell className="text-sm max-w-[240px] truncate">{rx.diagnosis ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-2">
                    <PrintSizeButton onPrint={(s) => printRx(rx, s)} label="Print" />
                    <Button size="icon" variant="ghost" onClick={() => openEdit(rx)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this prescription?")) del.mutate(rx.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Prescription" : "New Prescription"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Rx No (auto)</Label>
              <Input value={form.rx_no} readOnly className="bg-muted/50 font-mono text-xs" />
            </div>
            <div>
              <Label>Date (BD time)</Label>
              <Input type="datetime-local" value={form.rx_date} onChange={(e) => setForm({ ...form, rx_date: e.target.value })} />
            </div>
            <div>
              <Label>Doctor</Label>
              <Input
                value={form.doctor_name}
                readOnly
                className="bg-muted/50"
                placeholder={me.isLoading ? "Loading…" : "Set by admin"}
              />
            </div>
            <div>
              <Label>Qualification</Label>
              <Input
                value={form.doctor_qualification}
                readOnly
                className="bg-muted/50"
                placeholder={me.isLoading ? "Loading…" : "Set by admin"}
              />
            </div>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
            <div className="md:col-span-2">
              <Label>Patient Name *</Label>
              <Input value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} />
            </div>
            <div>
              <Label>Age</Label>
              <Input value={form.patient_age} onChange={(e) => setForm({ ...form, patient_age: e.target.value })} placeholder="e.g. 32 yr" />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={form.patient_gender || undefined} onValueChange={(v) => setForm({ ...form, patient_gender: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.patient_phone} onChange={(e) => setForm({ ...form, patient_phone: e.target.value })} />
            </div>
            <div>
              <Label>Link Contact (optional)</Label>
              <Select value={form.contact_id || undefined} onValueChange={(v) => {
                const c = contacts.data?.find((x) => x.id === v);
                setForm({ ...form, contact_id: v, patient_name: form.patient_name || c?.name || "", patient_phone: form.patient_phone || c?.mobile || "" });
              }}>
                <SelectTrigger><SelectValue placeholder="No contact" /></SelectTrigger>
                <SelectContent>
                  {(contacts.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vitals</Label>
              <Input value={form.vitals} onChange={(e) => setForm({ ...form, vitals: e.target.value })} placeholder="BP, Wt, Temp…" />
            </div>
            <div>
              <Label>Next Visit</Label>
              <Input type="date" value={form.next_visit} onChange={(e) => setForm({ ...form, next_visit: e.target.value })} />
            </div>
          </div>

          <div className="mt-2">
            <Label>Diagnosis</Label>
            <Textarea rows={2} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Medicines</Label>
              <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])}>
                <Plus className="h-4 w-4 mr-1" /> Add Row
              </Button>
            </div>
            <div className="space-y-2 mt-2">
              {lines.map((l, i) => (
                <MedicineRow
                  key={i}
                  line={l}
                  products={products.data ?? []}
                  onChange={(patch) => updateLine(i, patch)}
                  onRemove={() => setLines(lines.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div>
              <Label>Advice</Label>
              <Textarea rows={3} value={form.advice} onChange={(e) => setForm({ ...form, advice: e.target.value })} placeholder="Diet / lifestyle advice…" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MedicineRow({ line, products, onChange, onRemove }: {
  line: Line; products: ProductOpt[];
  onChange: (p: Partial<Line>) => void; onRemove: () => void;
}) {
  const [pOpen, setPOpen] = useState(false);
  const selected = useMemo(() => products.find((p) => p.id === line.product_id), [products, line.product_id]);
  return (
    <div className="rounded-md border p-2 grid grid-cols-1 md:grid-cols-12 gap-2 items-start bg-muted/30">
      <div className="md:col-span-4">
        <Popover open={pOpen} onOpenChange={setPOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between h-9 font-normal">
              <span className="truncate text-left">{selected?.name || line.medicine_name || "Pick product or type name"}</span>
              <Search className="ml-2 h-4 w-4 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[360px]" align="start">
            <Command>
              <CommandInput placeholder="Search products…" />
              <CommandList>
                <CommandEmpty>No products.</CommandEmpty>
                <CommandGroup>
                  {products.slice(0, 200).map((p) => (
                    <CommandItem key={p.id} value={p.name} onSelect={() => {
                      onChange({ product_id: p.id, variation_id: p.variation_id, medicine_name: p.name });
                      setPOpen(false);
                    }}>{p.name}</CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Input className="mt-1 h-8" placeholder="Medicine name" value={line.medicine_name}
          onChange={(e) => onChange({ medicine_name: e.target.value })} />
      </div>
      <Input className="md:col-span-2 h-9" placeholder="Dose (e.g. 500mg)" value={line.dose}
        onChange={(e) => onChange({ dose: e.target.value })} />
      <Input className="md:col-span-2 h-9" placeholder="Freq (1+0+1)" value={line.frequency}
        onChange={(e) => onChange({ frequency: e.target.value })} />
      <Input className="md:col-span-2 h-9" placeholder="Duration (7 days)" value={line.duration}
        onChange={(e) => onChange({ duration: e.target.value })} />
      <Input className="md:col-span-1 h-9" type="number" min={0} step="0.01" placeholder="Qty" value={line.quantity}
        onChange={(e) => onChange({ quantity: Number(e.target.value) })} />
      <Button className="md:col-span-1 h-9" size="icon" variant="ghost" onClick={onRemove}>
        <X className="h-4 w-4 text-destructive" />
      </Button>
      <Input className="md:col-span-12 h-8 text-xs" placeholder="Instructions (after meal, etc.)" value={line.instructions}
        onChange={(e) => onChange({ instructions: e.target.value })} />
    </div>
  );
}