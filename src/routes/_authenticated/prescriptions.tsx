import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Search, FileText, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { fetchAll, fetchAllIn } from "@/lib/fetch-all";
import { useRxPresets } from "@/hooks/use-rx-presets";
import { RxPresetCombo } from "@/components/rx-preset-combo";

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

type CcOption = { id: string; name: string };
type Cc = { name: string; days: string };
type ProductOpt = { id: string; name: string; variation_id: string | null };
type Line = {
  id?: string;
  product_id: string | null;
  variation_id: string | null;
  medicine_name: string;
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
  frequency: "", duration: "", instructions: "", quantity: 1,
});

const fmtDate = (d: string) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const p = dhakaParts(dt);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};

/** dd/mm/yyyy only (no time). */
const fmtDay = (d: string) => {
  if (!d) return "";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const p = dhakaParts(dt);
  return `${p.day}/${p.month}/${p.year}`;
};

/** Add N days to a base date, returns YYYY-MM-DD. */
function addDays(baseIsoOrLocal: string, days: number): string {
  if (!days || days <= 0) return "";
  const base = baseIsoOrLocal ? new Date(baseIsoOrLocal) : new Date();
  if (isNaN(base.getTime())) return "";
  const d = new Date(base.getTime() + days * 86400000);
  const p = dhakaParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Difference in whole days between two dates (for edit mode). */
function diffDays(from: string, to: string): string {
  if (!from || !to) return "";
  const a = new Date(from), b = new Date(`${to}T00:00:00+06:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return "";
  const n = Math.round((b.getTime() - a.getTime()) / 86400000);
  return n > 0 ? String(n) : "";
}

/* ---------------- Chief complaints (C/C) ---------------- */
const composeCc = (cc: Cc[]) =>
  cc
    .filter((c) => c.name.trim())
    .map((c) => (c.days.trim() ? `${c.name.trim()} - ${c.days.trim()} days` : c.name.trim()))
    .join(", ");

function parseCc(s: string | null | undefined): Cc[] {
  if (!s?.trim()) return [];
  return s.split(",").map((chunk) => {
    const m = chunk.trim().match(/^(.*?)\s*-\s*(\d+)\s*days?$/i);
    return m ? { name: m[1].trim(), days: m[2] } : { name: chunk.trim(), days: "" };
  }).filter((c) => c.name);
}


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

/* ---------------- Vitals ---------------- */
type VitalKey = "height" | "weight" | "temp" | "bp" | "pulse" | "spo2" | "rbs";
type Vitals = Record<VitalKey, string>;

const VITAL_FIELDS: { key: VitalKey; label: string; unit: string; placeholder: string }[] = [
  { key: "height", label: "Height", unit: "in", placeholder: "e.g. 65" },
  { key: "weight", label: "Weight", unit: "kg", placeholder: "e.g. 60" },
  { key: "temp", label: "Temp", unit: "°C", placeholder: "e.g. 37" },
  { key: "bp", label: "BP", unit: "mmHg", placeholder: "e.g. 120/80" },
  { key: "pulse", label: "Pulse", unit: "bpm", placeholder: "e.g. 78" },
  { key: "spo2", label: "SpO₂", unit: "%", placeholder: "e.g. 98" },
  { key: "rbs", label: "RBS", unit: "mmol/L", placeholder: "e.g. 6.5" },
];

const emptyVitals = (): Vitals => ({ height: "", weight: "", temp: "", bp: "", pulse: "", spo2: "", rbs: "" });

/** BMI from height (inches) and weight (kg). */
function calcBmi(v: Vitals): string {
  const inches = parseFloat(v.height);
  const kg = parseFloat(v.weight);
  if (!inches || !kg || inches <= 0 || kg <= 0) return "";
  const m = inches * 0.0254;
  return (kg / (m * m)).toFixed(1);
}

export type ExtraVital = { name: string; value: string };

/** Compose to a single readable string stored in prescriptions.vitals */
function composeVitals(v: Vitals, extras: ExtraVital[] = []): string {
  const parts: string[] = [];
  for (const f of VITAL_FIELDS) {
    const val = (v[f.key] ?? "").trim();
    if (val) parts.push(`${f.label}: ${val} ${f.unit}`);
    if (f.key === "weight") {
      const bmi = calcBmi(v);
      if (bmi) parts.push(`BMI: ${bmi} kg/m²`);
    }
  }
  for (const e of extras) {
    const n = (e.name ?? "").trim();
    const val = (e.value ?? "").trim();
    if (n && val) parts.push(`${n}: ${val}`);
  }
  return parts.join(", ");
}

/** Parse back a composed vitals string into fields. */
function parseVitals(s: string | null | undefined): Vitals {
  const out = emptyVitals();
  if (!s) return out;
  for (const chunk of s.split(",")) {
    const [rawLabel, ...rest] = chunk.split(":");
    if (!rest.length) continue;
    const label = rawLabel.trim().toLowerCase();
    const f = VITAL_FIELDS.find((x) => x.label.toLowerCase() === label);
    if (!f) continue;
    out[f.key] = rest.join(":").replace(f.unit, "").trim();
  }
  return out;
}

/** Custom (doctor-added) vitals found in a composed vitals string. */
function parseExtraVitals(s: string | null | undefined): ExtraVital[] {
  if (!s) return [];
  const known = new Set([...VITAL_FIELDS.map((f) => f.label.toLowerCase()), "bmi"]);
  const out: ExtraVital[] = [];
  for (const chunk of s.split(",")) {
    const [rawLabel, ...rest] = chunk.split(":");
    if (!rest.length) continue;
    const label = rawLabel.trim();
    if (!label || known.has(label.toLowerCase())) continue;
    out.push({ name: label, value: rest.join(":").trim() });
  }
  return out;
}

/** Ordered vitals lines for printing: "1. Height: 65 in" / "N/A" when empty. */
function vitalsLines(s: string | null | undefined): string[] {
  const v = parseVitals(s);
  const rows: { label: string; value: string }[] = [];
  for (const f of VITAL_FIELDS) {
    const val = (v[f.key] ?? "").trim();
    rows.push({ label: f.label, value: val ? `${val} ${f.unit}` : "N/A" });
    if (f.key === "weight") {
      const bmi = calcBmi(v);
      rows.push({ label: "BMI", value: bmi ? `${bmi} kg/m²` : "N/A" });
    }
  }
  for (const e of parseExtraVitals(s)) {
    rows.push({ label: e.name, value: e.value || "N/A" });
  }
  return rows.map((r, i) => `${i + 1}. ${r.label}: ${r.value}`);
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
    diagnosis: "", vitals: "", investigation: "", advice: "", next_visit: "", notes: "",
  });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [vitals, setVitals] = useState<Vitals>(emptyVitals());
  const [extraVitals, setExtraVitals] = useState<ExtraVital[]>([]);
  const [cc, setCc] = useState<Cc[]>([]);
  const [ccOpen, setCcOpen] = useState(false);
  const [ccSearch, setCcSearch] = useState("");
  const [nextDays, setNextDays] = useState("");

  // Doctor's own saved lists (private to the logged-in doctor).
  const myCc = useRxPresets("cc", businessId);
  const myVitals = useRxPresets("vital", businessId);
  const myInvestigations = useRxPresets("investigation", businessId);
  const myFreqs = useRxPresets("frequency", businessId);
  const myAdvice = useRxPresets("advice", businessId);
  const myMedicines = useRxPresets("medicine", businessId);

  // Auto-save the prescription being written (power cut safe).
  const { clearDraft: clearRxDraft } = useAutosaveDraft(
    businessId ? `prescription:${businessId}` : null,
    { form, lines, vitals, extraVitals, cc, nextDays },
    (d) => {
      if (d.form) setForm((f) => ({ ...f, ...d.form }));
      if (d.lines?.length) setLines(d.lines);
      if (d.vitals) setVitals(d.vitals);
      if (d.extraVitals?.length) setExtraVitals(d.extraVitals);
      if (d.cc?.length) setCc(d.cc);
      if (d.nextDays) setNextDays(d.nextDays);
    },
    {
      enabled: open && !editing,
      isEmpty: (d) =>
        !d.form?.patient_name?.trim() &&
        !d.cc?.length &&
        !(d.lines ?? []).some((l: any) => (l?.medicine_name ?? "").trim()),
      restoreMessage: "Unsaved prescription restored",
    },
  );


  const bmi = calcBmi(vitals);
  const nextVisitDate = addDays(dhakaInputToIso(form.rx_date), Number(nextDays) || 0);

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

  const ccOptions = useQuery({
    queryKey: ["cc-options", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase.from("chief_complaints")
        .select("id, name")
        .eq("business_id", businessId!)
        .order("name")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as CcOption[];
    },
  });

  const addCcOption = useMutation({
    mutationFn: async (name: string) => {
      if (!businessId) throw new Error("No business");
      const { error } = await supabase.from("chief_complaints").insert({ business_id: businessId, name });
      if (error && !`${error.message}`.includes("duplicate")) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cc-options", businessId] }),
  });

  const addCc = (name: string, saveToMyList = false) => {
    const n = name.trim();
    if (!n) return;
    if (!cc.some((c) => c.name.toLowerCase() === n.toLowerCase())) setCc([...cc, { name: n, days: "" }]);
    if (saveToMyList) myCc.add(n);
    setCcSearch("");
    setCcOpen(false);
  };

  const ccPickList = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string; removable?: boolean }[] = [];
    for (const o of myCc.items) {
      seen.add(o.name.toLowerCase());
      out.push({ id: o.id, name: o.name, removable: true });
    }
    for (const o of ccOptions.data ?? []) {
      if (seen.has(o.name.toLowerCase())) continue;
      out.push({ id: o.id, name: o.name });
    }
    return out;
  }, [myCc.items, ccOptions.data]);



  const products = useQuery({
    queryKey: ["rx-products", businessId],
    enabled: !!businessId && open,
    queryFn: async () => {
      const rows = await fetchAll<any>(() =>
        supabase.from("products")
          .select("id, name")
          .eq("business_id", businessId!)
          .eq("is_inactive", false)
          .order("name"),
      );
      const variationRows = rows.length
        ? await fetchAllIn<any>(
          (ids) => supabase.from("variations").select("id, product_id").in("product_id", ids).order("created_at"),
          rows.map((p) => p.id),
        )
        : [];
      const firstVariationByProduct = new Map<string, string>();
      for (const v of variationRows) {
        if (!firstVariationByProduct.has(v.product_id)) firstVariationByProduct.set(v.product_id, v.id);
      }
      const opts: ProductOpt[] = [];
      for (const p of rows) {
        opts.push({ id: p.id, name: p.name, variation_id: firstVariationByProduct.get(p.id) ?? null });
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
      diagnosis: "", vitals: "", investigation: "", advice: "", next_visit: "", notes: "",
    });
    setLines([emptyLine()]);
    setVitals(emptyVitals());
    setExtraVitals([]);
    setCc([]);
    setNextDays("");
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
      investigation: "",
      advice: rx.advice ?? "",
      next_visit: rx.next_visit ?? "",
      notes: rx.notes ?? "",
    });
    setVitals(parseVitals(rx.vitals));
    setExtraVitals(parseExtraVitals(rx.vitals));
    setCc(parseCc(rx.diagnosis));
    setNextDays(diffDays(rx.rx_date, rx.next_visit ?? ""));

    const { data: invRow } = await supabase.from("prescriptions")
      .select("investigation").eq("id", rx.id).maybeSingle();
    if (invRow) setForm((f) => ({ ...f, investigation: (invRow as any).investigation ?? "" }));


    const { data } = await supabase.from("prescription_lines")
      .select("id, product_id, variation_id, medicine_name, frequency, duration, instructions, quantity")
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

        diagnosis: composeCc(cc) || null,
        vitals: composeVitals(vitals, extraVitals) || null,
        investigation: form.investigation.trim() || null,
        advice: form.advice.trim() || null,
        next_visit: nextVisitDate || null,
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
        dose: null,
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
      clearRxDraft();
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

  const buildRxHtml = async (rx: Rx, size: PrintSize) => {
    const { data: linesData } = await supabase.from("prescription_lines")
      .select("medicine_name, frequency, duration, instructions, quantity")
      .eq("prescription_id", rx.id)
      .order("sort_order");
    const rxLines = (linesData ?? []) as Line[];
    let investigation = "";
    try {
      const { data: inv } = await supabase.from("prescriptions" as any)
        .select("investigation").eq("id", rx.id).maybeSingle();
      investigation = (inv as any)?.investigation ?? "";
    } catch { /* column may not exist */ }

    const biz = business as any;
    const bizName = biz?.name ?? "";
    const bizAddr = biz?.address ?? "";
    const bizPhone = biz?.mobile ?? "";

    const esc = (s: string) => String(s).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));
    const nl = (s: string) => esc(s).replace(/\n/g, "<br>");
    const nextVisitTxt = rx.next_visit
      ? (() => {
        const d = diffDays(rx.rx_date, rx.next_visit!);
        return d ? `${d} days later (${fmtDay(rx.next_visit!)})` : fmtDay(rx.next_visit!);
      })()
      : "";

    const headerHtml = `
      <div class="header center">
        <h2>${esc(bizName)}</h2>
        ${bizAddr ? `<div>${esc(bizAddr)}</div>` : ""}
        ${bizPhone ? `<div>Phone: ${esc(bizPhone)}</div>` : ""}
        ${rx.doctor_name ? `<div style="margin-top:4px;"><strong>Dr. ${esc(rx.doctor_name)}</strong>${rx.doctor_qualification ? ` — ${esc(rx.doctor_qualification)}` : ""}</div>` : ""}
      </div>`;

    const metaHtml = `
      <div class="row">
        <div><span class="label">Rx No:</span> ${esc(rx.rx_no ?? "—")}</div>
        <div><span class="label">Date:</span> ${fmtDate(rx.rx_date)}</div>
      </div>
      <div class="pbox">
        <div class="row"><div><strong>${esc(rx.patient_name)}</strong></div>
          <div>${esc(rx.patient_age ?? "")}${rx.patient_gender ? ` / ${esc(rx.patient_gender)}` : ""}</div></div>
        ${rx.patient_phone ? `<div class="label">Phone: ${esc(rx.patient_phone)}</div>` : ""}
      </div>`;

    const medsHtml = rxLines.length
      ? rxLines.map((l, i) => `
        <div class="med">
          <div class="med-name">${i + 1}. ${esc(l.medicine_name)}${l.quantity ? ` &nbsp;<span class="qty">(Qty: ${l.quantity})</span>` : ""}</div>
          <div class="med-sub">${[l.frequency, l.duration].filter(Boolean).map((x) => esc(x!)).join(" &nbsp;—&nbsp; ")}</div>
          ${l.instructions ? `<div class="med-sub"><em>${esc(l.instructions)}</em></div>` : ""}
        </div>`).join("")
      : `<div class="label">No medicines</div>`;

    if (size === "A4") {
      const styles = `
        @page { size: A4; margin: 0; }
        html, body { margin:0; padding:0; background:#fff; color:#000; font-family: Arial, sans-serif; font-size:12px; }
        .page { width:210mm; min-height:297mm; padding:12mm 10mm; box-sizing:border-box; background:#fff; display:flex; flex-direction:column; }
        h2 { margin:2px 0; font-size:18px; }
        .center { text-align:center; }
        .row { display:flex; justify-content:space-between; gap:8px; }
        .header { border-bottom:2px solid #000; padding-bottom:6px; margin-bottom:6px; }
        .label { color:#444; font-size:0.9em; }
        .pbox { border:1px solid #999; padding:6px; margin:6px 0 8px; border-radius:4px; }
        .split { display:flex; flex:1 1 auto; border-top:1px solid #000; min-height:180mm; }
        .left { width:40%; padding:6px 8px 6px 0; border-right:1.5px solid #000; box-sizing:border-box; }
        .right { width:60%; padding:6px 0 6px 10px; box-sizing:border-box; display:flex; flex-direction:column; }
        .sec-title { font-weight:bold; text-decoration:underline; margin:8px 0 4px; }
        .rx-area { flex:0 0 70%; }
        .adv-area { flex:0 0 30%; border-top:1px dashed #666; padding-top:6px; }
        .rx-mark { font-size:24px; font-weight:bold; }
        .med { margin:0 0 6px; }
        .med-name { font-weight:bold; }
        .med-sub { padding-left:14px; }
        .qty { font-weight:normal; }
        .sign { margin-top:10px; text-align:right; }`;

      const body = `
      <div class="page">
        ${headerHtml}
        ${metaHtml}
        <div class="split">
          <div class="left">
            <div class="sec-title">C/C</div>
            <div>${rx.diagnosis ? nl(rx.diagnosis) : "&nbsp;"}</div>
            <div class="sec-title">Vitals</div>
            <div>${vitalsLines(rx.vitals).map((l) => `<div>${esc(l)}</div>`).join("")}</div>
            <div class="sec-title">Investigation</div>
            <div>${investigation ? nl(investigation) : "&nbsp;"}</div>
          </div>
          <div class="right">
            <div class="rx-area">
              <div class="rx-mark">℞</div>
              ${medsHtml}
            </div>
            <div class="adv-area">
              <div class="sec-title" style="margin-top:0;">Advice</div>
              <div>${rx.advice ? nl(rx.advice) : "&nbsp;"}</div>
              ${rx.notes ? `<div style="margin-top:4px;font-size:0.9em;">${nl(rx.notes)}</div>` : ""}
              ${nextVisitTxt ? `<div style="margin-top:6px;"><span class="label">Next visit:</span> ${esc(nextVisitTxt)}</div>` : ""}
              <div class="sign">Doctor's signature: ______________________</div>
            </div>
          </div>
        </div>
      </div>`;

      return { styles, body, title: `Rx ${esc(rx.rx_no ?? "")}` };
    }

    const widthCss = size === "80mm" ? "80mm" : "58mm";
    const fs = size === "58mm" ? "10px" : "11px";
    const styles = `
      @page { size: ${size} auto; margin: 0; }
      html, body { margin:0; padding:0; background:#fff; color:#000; font-family: Arial, sans-serif; font-size:${fs}; }
      .page { width:${widthCss}; padding:4mm; box-sizing:border-box; background:#fff; }
      h2 { margin:2px 0; font-size:14px; }
      .center { text-align:center; }
      .row { display:flex; justify-content:space-between; gap:8px; }
      .header { border-bottom:2px solid #000; padding-bottom:6px; margin-bottom:6px; }
      .label { color:#444; font-size:0.9em; }
      .pbox { border:1px solid #999; padding:6px; margin:6px 0; border-radius:4px; }
      .med { margin:4px 0; padding-bottom:4px; border-bottom:1px dashed #999; }
      .med-name { font-weight:bold; }
      .med-sub { padding-left:10px; }
      .rx-mark { font-size:18px; font-weight:bold; }
      .footer { margin-top:12px; border-top:1px dashed #666; padding-top:6px; text-align:center; font-size:0.85em; }`;

    const body = `
    <div class="page">
      ${headerHtml}
      ${metaHtml}
      <div class="label">Vitals:</div>${vitalsLines(rx.vitals).map((l) => `<div>${esc(l)}</div>`).join("")}
      ${rx.diagnosis ? `<div><span class="label">C/C:</span> ${esc(rx.diagnosis)}</div>` : ""}
      ${investigation ? `<div><span class="label">Investigation:</span> ${nl(investigation)}</div>` : ""}
      <div class="rx-mark">℞</div>
      ${medsHtml}
      ${rx.advice ? `<div class="pbox"><span class="label">Advice:</span><br>${nl(rx.advice)}</div>` : ""}
      ${nextVisitTxt ? `<div style="margin-top:6px;"><span class="label">Next visit:</span> ${esc(nextVisitTxt)}</div>` : ""}
      ${rx.notes ? `<div style="margin-top:6px;font-size:0.9em;">${nl(rx.notes)}</div>` : ""}
      <div class="footer">Doctor's signature: ______________________</div>
    </div>`;

    return { styles, body, title: `Rx ${esc(rx.rx_no ?? "")}` };
  };


  const printRx = async (rx: Rx, size: PrintSize) => {
    const { styles, body, title } = await buildRxHtml(rx, size);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>${styles}</style></head><body>${body}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),200);}</script>
    </body></html>`;

    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) { toast.error("Popup blocked"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  const savePdf = async (rx: Rx) => {
    const t = toast.loading("Generating PDF…");
    let frame: HTMLIFrameElement | null = null;
    try {
      const { styles, body } = await buildRxHtml(rx, "A4");

      // Render inside an isolated iframe so the app's Tailwind theme
      // (which uses oklch() colors html2canvas can't parse) never applies.
      frame = document.createElement("iframe");
      frame.style.cssText = "position:fixed;left:-10000px;top:0;width:820px;height:1300px;border:0;background:#fff;";
      document.body.appendChild(frame);
      const doc = frame.contentDocument!;
      doc.open();
      doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>
        *{color:#000;}
        html,body{margin:0;padding:0;background:#fff;}
        ${styles}
      </style></head><body>${body}</body></html>`);
      doc.close();
      await new Promise((r) => setTimeout(r, 120));

      const target = doc.querySelector(".page") as HTMLElement;

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: "#ffffff",
        windowWidth: target.scrollWidth,
        windowHeight: target.scrollHeight,
      });

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pw = 210, ph = 297;
      const imgH = (canvas.height * pw) / canvas.width;
      const img = canvas.toDataURL("image/jpeg", 0.95);
      let remaining = imgH, pos = 0;
      pdf.addImage(img, "JPEG", 0, 0, pw, imgH);
      remaining -= ph;
      while (remaining > 0) {
        pos -= ph;
        pdf.addPage();
        pdf.addImage(img, "JPEG", 0, pos, pw, imgH);
        remaining -= ph;
      }
      pdf.save(`Rx-${(rx.rx_no ?? rx.id).replace(/[^\w-]/g, "")}.pdf`);
      toast.success("PDF saved", { id: t });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to make PDF", { id: t });
    } finally {
      frame?.remove();
    }
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
              <TableHead>C/C</TableHead>
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
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => savePdf(rx)}>
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </Button>
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
              <Label>Next Visit (after days)</Label>
              <div className="relative">
                <Input
                  className="pr-12"
                  inputMode="numeric"
                  placeholder="e.g. 7"
                  value={nextDays}
                  onChange={(e) => setNextDays(e.target.value.replace(/\D/g, ""))}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  days
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {nextVisitDate ? `Next visit: ${fmtDay(nextVisitDate)}` : "Date will be calculated automatically"}
              </p>
            </div>

          </div>

          <div className="mt-3 rounded-xl border border-border/60 p-3">
            <Label className="text-base">Patient Vitals</Label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {VITAL_FIELDS.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs text-muted-foreground">{f.label}</Label>
                  <div className="relative">
                    <Input
                      className="pr-14"
                      inputMode={f.key === "bp" ? "text" : "decimal"}
                      placeholder={f.placeholder}
                      value={vitals[f.key]}
                      onChange={(e) => setVitals({ ...vitals, [f.key]: e.target.value })}
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {f.unit}
                    </span>
                  </div>
                </div>
              ))}
              <div>
                <Label className="text-xs text-muted-foreground">BMI (auto)</Label>
                <div className="relative">
                  <Input className="pr-16 bg-muted/50" readOnly value={bmi} placeholder="—" />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    kg/m²
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-border/60 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">C/C (Chief Complaints)</Label>
              <Popover open={ccOpen} onOpenChange={setCcOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" /> Add C/C</Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[320px]" align="end">
                  <Command>
                    <CommandInput placeholder="Search or type C/C…" value={ccSearch} onValueChange={setCcSearch} />
                    <CommandList>
                      <CommandEmpty>
                        <Button variant="ghost" size="sm" onClick={() => addCc(ccSearch)} disabled={!ccSearch.trim()}>
                          Add “{ccSearch}”
                        </Button>
                      </CommandEmpty>
                      <CommandGroup>
                        {(ccOptions.data ?? []).map((o) => (
                          <CommandItem key={o.id} value={o.name} onSelect={() => addCc(o.name)}>{o.name}</CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {cc.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No complaint added yet. Search an existing C/C or type a new one.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {cc.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      value={c.name}
                      placeholder="Complaint"
                      onChange={(e) => setCc(cc.map((x, ix) => (ix === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <div className="relative w-32">
                      <Input
                        className="pr-12"
                        inputMode="numeric"
                        placeholder="Since"
                        value={c.days}
                        onChange={(e) =>
                          setCc(cc.map((x, ix) => (ix === i ? { ...x, days: e.target.value.replace(/\D/g, "") } : x)))
                        }
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        days
                      </span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setCc(cc.filter((_, ix) => ix !== i))}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
  const [pSearch, setPSearch] = useState("");
  const selected = useMemo(() => products.find((p) => p.id === line.product_id), [products, line.product_id]);
  const filtered = useMemo(() => {
    const q = pSearch.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, pSearch]);
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
            <Command shouldFilter={false}>
              <CommandInput placeholder={`Search ${products.length} medicines…`} value={pSearch} onValueChange={setPSearch} />
              <CommandList>
                <CommandEmpty>No products.</CommandEmpty>
                <CommandGroup>
                  {filtered.map((p) => (
                    <CommandItem key={p.id} value={p.id} onSelect={() => {
                      onChange({ product_id: p.id, variation_id: p.variation_id, medicine_name: p.name });
                      setPSearch("");
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
      <Input className="md:col-span-4 h-9" placeholder="Freq (1+0+1)" value={line.frequency}
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