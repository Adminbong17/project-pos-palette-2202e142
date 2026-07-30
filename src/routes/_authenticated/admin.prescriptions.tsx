import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Trash2, Eye, FileText, Users, Stethoscope } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/prescriptions")({
  head: () => ({
    meta: [
      { title: "Admin Prescriptions — QweekPOS" },
      { name: "description", content: "Admin overview of every prescription written by doctors, with filters and details." },
      { property: "og:title", content: "Admin Prescriptions — QweekPOS" },
      { property: "og:description", content: "Admin overview of every prescription written by doctors, with filters and details." },
    ],
  }),
  component: AdminPrescriptionsPage,
});

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
};

const fmtDate = (d: string) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(dt)) p[part.type] = part.value;
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};


function AdminPrescriptionsPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const { isAdmin, isLoading: roleLoading } = useCurrentRole();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [doctor, setDoctor] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<Rx | null>(null);
  const [ccOpen, setCcOpen] = useState(false);
  const [ccName, setCcName] = useState("");

  const ccList = useQuery({
    queryKey: ["cc-options", businessId],
    enabled: !!businessId && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chief_complaints")
        .select("id, name")
        .eq("business_id", businessId!)
        .order("name")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const addCc = useMutation({
    mutationFn: async (name: string) => {
      const n = name.trim();
      if (!n) throw new Error("Enter a complaint name");
      const { error } = await supabase.from("chief_complaints").insert({ business_id: businessId!, name: n });
      if (error) throw error;
    },
    onSuccess: () => {
      setCcName("");
      toast.success("C/C added");
      qc.invalidateQueries({ queryKey: ["cc-options", businessId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not add"),
  });

  const delCc = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chief_complaints").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cc-options", businessId] }),
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });


  const list = useQuery({
    queryKey: ["admin-prescriptions", businessId],
    enabled: !!businessId && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescriptions")
        .select(
          "id, rx_no, rx_date, patient_name, patient_age, patient_gender, patient_phone, doctor_name, doctor_qualification, diagnosis, vitals, advice, next_visit, notes",
        )
        .eq("business_id", businessId!)
        .order("rx_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Rx[];
    },
  });

  const lines = useQuery({
    queryKey: ["admin-rx-lines", detail?.id],
    enabled: !!detail?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescription_lines")
        .select("id, medicine_name, frequency, duration, instructions, quantity")
        .eq("prescription_id", detail!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("prescription_lines").delete().eq("prescription_id", id);
      const { error } = await supabase.from("prescriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prescription deleted");
      qc.invalidateQueries({ queryKey: ["admin-prescriptions", businessId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const doctors = useMemo(() => {
    const set = new Set<string>();
    for (const r of list.data ?? []) if (r.doctor_name?.trim()) set.add(r.doctor_name.trim());
    return Array.from(set).sort();
  }, [list.data]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (list.data ?? []).filter((r) => {
      if (doctor !== "all" && (r.doctor_name ?? "").trim() !== doctor) return false;
      if (from && new Date(r.rx_date) < new Date(from)) return false;
      if (to && new Date(r.rx_date) > new Date(`${to}T23:59:59`)) return false;
      if (!s) return true;
      return [r.patient_name, r.rx_no, r.patient_phone, r.doctor_name, r.diagnosis]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s));
    });
  }, [list.data, search, doctor, from, to]);

  const stats = useMemo(() => {
    const patients = new Set(rows.map((r) => (r.patient_phone || r.patient_name || "").toLowerCase()));
    const today = new Date().toDateString();
    return {
      total: rows.length,
      patients: patients.size,
      doctors: new Set(rows.map((r) => r.doctor_name ?? "—")).size,
      today: rows.filter((r) => new Date(r.rx_date).toDateString() === today).length,
    };
  }, [rows]);

  if (!roleLoading && !isAdmin) {
    return (
      <div className="p-6">
        <h1 className="font-display text-xl font-semibold">Admin Prescriptions</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only business admins can view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">Admin Prescriptions</h1>
          <p className="text-sm text-muted-foreground">Every prescription written in this business, across all doctors.</p>
        </div>
        <Button variant="outline" onClick={() => setCcOpen(true)}>Manage C/C list</Button>
      </header>

      <Dialog open={ccOpen} onOpenChange={setCcOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Chief Complaints (C/C)</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Fever"
              value={ccName}
              onChange={(e) => setCcName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCc.mutate(ccName); }}
            />
            <Button onClick={() => addCc.mutate(ccName)} disabled={addCc.isPending}>Add</Button>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {(ccList.data ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1 text-sm">
                <span>{c.name}</span>
                <Button size="icon" variant="ghost" onClick={() => delCc.mutate(c.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            {!ccList.isLoading && (ccList.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No complaints yet — add some so doctors can search them.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>


      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Prescriptions", value: stats.total, icon: FileText },
          { label: "Today", value: stats.today, icon: FileText },
          { label: "Patients", value: stats.patients, icon: Users },
          { label: "Doctors", value: stats.doctors, icon: Stethoscope },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border/60 bg-card p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <c.icon className="h-3.5 w-3.5" />
              {c.label}
            </div>
            <div className="mt-1 text-2xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <FloatingSearch spacer={44}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search patient, Rx no, phone, doctor, diagnosis"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </FloatingSearch>
        <Select value={doctor} onValueChange={setDoctor}>
          <SelectTrigger className="sm:w-52"><SelectValue placeholder="All doctors" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doctors</SelectItem>
            {doctors.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="sm:w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" className="sm:w-40" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 sm:hidden">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-border/60 bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{r.patient_name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.rx_no ? `#${r.rx_no} · ` : ""}{fmtDate(r.rx_date)}
                </div>
              </div>
              <Badge variant="secondary">{r.doctor_name ?? "—"}</Badge>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setDetail(r)}>
                <Eye className="mr-1 h-3.5 w-3.5" /> View
              </Button>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border/60 sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rx No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>C/C</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!list.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">No prescriptions found.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.rx_no ?? "—"}</TableCell>
                <TableCell className="text-sm">{fmtDate(r.rx_date)}</TableCell>
                <TableCell className="text-sm font-medium">
                  {r.patient_name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {[r.patient_age, r.patient_gender].filter(Boolean).join(" · ")}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{r.patient_phone ?? "—"}</TableCell>
                <TableCell className="text-sm">{r.doctor_name ?? "—"}</TableCell>
                <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">{r.diagnosis ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setDetail(r)}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> View
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-1" onClick={() => del.mutate(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detail?.patient_name} {detail?.rx_no ? `· #${detail.rx_no}` : ""}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Date" value={fmtDate(detail.rx_date)} />
                <Field label="Doctor" value={detail.doctor_name ?? "—"} />
                <Field label="Age / Gender" value={[detail.patient_age, detail.patient_gender].filter(Boolean).join(" · ") || "—"} />
                <Field label="Phone" value={detail.patient_phone ?? "—"} />
                <Field label="C/C" value={detail.diagnosis ?? "—"} />
                <Field label="Vitals" value={detail.vitals ?? "—"} />
                <Field label="Advice" value={detail.advice ?? "—"} />
                <Field label="Next visit" value={detail.next_visit ?? "—"} />
              </div>
              <div className="rounded-lg border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(lines.data ?? []).map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.medicine_name}</TableCell>
                        <TableCell>{l.frequency || "—"}</TableCell>
                        <TableCell>{l.duration || "—"}</TableCell>
                        <TableCell className="text-right">{l.quantity}</TableCell>
                      </TableRow>
                    ))}
                    {!lines.isLoading && (lines.data ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No medicines</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
