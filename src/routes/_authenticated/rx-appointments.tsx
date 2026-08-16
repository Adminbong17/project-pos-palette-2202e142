import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { useMyStaffChamber } from "@/hooks/use-my-staff-chamber";
import { dhakaToday } from "@/lib/appointments";
import { AppointmentQueue, useChambers } from "@/components/appointment-queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/rx-appointments")({
  head: () => ({
    meta: [
      { title: "Patient Queue & Chambers — Doctor Appointments" },
      {
        name: "description",
        content:
          "Doctor assistants can list patients per chamber location with auto day-wise serial numbers and start prescriptions in one click.",
      },
      { property: "og:title", content: "Patient Queue & Chambers — Doctor Appointments" },
      {
        property: "og:description",
        content: "Location-wise patient lists with automatic daily serial numbers for doctors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const qc = useQueryClient();

  const { isAssistant } = useCurrentRole();
  const chambers = useChambers(businessId);
  const chamberList = chambers.data ?? [];
  const myStaff = useMyStaffChamber(businessId);
  // Staff accounts work at the location their doctor assigned — they cannot pick one.
  const lockedChamberId = isAssistant ? myStaff.data?.chamber_id ?? null : null;

  const [date, setDate] = useState(dhakaToday());
  const [chamberId, setChamberId] = useState<string>("");
  const [newChamber, setNewChamber] = useState({ name: "", address: "", fee_new: "", fee_old: "" });
  const [history, setHistory] = useState("");
  const [form, setForm] = useState({
    patient_name: "",
    patient_age: "",
    patient_gender: "",
    patient_phone: "",
    appt_time: "",
  });

  useEffect(() => {
    if (lockedChamberId) setChamberId(lockedChamberId);
  }, [lockedChamberId]);

  const addChamber = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business");
      if (!newChamber.name.trim()) throw new Error("Location name is required");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("rx_chambers").insert({
        business_id: businessId,
        name: newChamber.name.trim(),
        address: newChamber.address.trim() || null,
        fee_new: Number(newChamber.fee_new) || 0,
        fee_old: Number(newChamber.fee_old) || 0,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Location added");
      setNewChamber({ name: "", address: "", fee_new: "", fee_old: "" });
      qc.invalidateQueries({ queryKey: ["rx-chambers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delChamber = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rx_chambers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Location removed");
      qc.invalidateQueries({ queryKey: ["rx-chambers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveFees = useMutation({
    mutationFn: async (v: { id: string; fee_new: number; fee_old: number }) => {
      const { error } = await supabase
        .from("rx_chambers")
        .update({ fee_new: v.fee_new, fee_old: v.fee_old })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fees updated");
      qc.invalidateQueries({ queryKey: ["rx-chambers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Patient history: search any patient id / name / phone across every day.
  const historyQ = useQuery({
    queryKey: ["patient-history", businessId, history],
    enabled: !!businessId && history.trim().length >= 2,
    queryFn: async () => {
      const term = history.trim();
      const { data, error } = await supabase
        .from("rx_appointments")
        .select(
          "id, patient_code, patient_name, patient_age, patient_gender, patient_phone, appt_date, serial_no, chamber_id, fee_amount, is_new_patient, prescription_id",
        )
        .eq("business_id", businessId!)
        .or(
          `patient_code.ilike.%${term}%,patient_name.ilike.%${term}%,patient_phone.ilike.%${term}%`,
        )
        .order("appt_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const addPatient = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business");
      if (!form.patient_name.trim()) throw new Error("Patient name is required");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("rx_appointments").insert({
        business_id: businessId,
        chamber_id: chamberId || null,
        patient_name: form.patient_name.trim(),
        patient_age: form.patient_age.trim() || null,
        patient_gender: form.patient_gender || null,
        patient_phone: form.patient_phone.trim() || null,
        appt_date: date,
        appt_time: form.appt_time || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Patient added to the queue");
      setForm({ patient_name: "", patient_age: "", patient_gender: "", patient_phone: "", appt_time: "" });
      qc.invalidateQueries({ queryKey: ["rx-appointments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Patient Queue</h1>
        <p className="text-sm text-muted-foreground">
          Location-wise patient list · serial number auto-generates per day per location
        </p>
      </div>

      {!isAssistant && (
      <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Chamber locations</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
          <Input
            placeholder="Location name"
            value={newChamber.name}
            onChange={(e) => setNewChamber((s) => ({ ...s, name: e.target.value }))}
          />
          <Input
            placeholder="Address (optional)"
            value={newChamber.address}
            onChange={(e) => setNewChamber((s) => ({ ...s, address: e.target.value }))}
          />
          <Input
            placeholder="New patient fee"
            inputMode="numeric"
            value={newChamber.fee_new}
            onChange={(e) => setNewChamber((s) => ({ ...s, fee_new: e.target.value.replace(/[^0-9.]/g, "") }))}
          />
          <Input
            placeholder="Old patient fee"
            inputMode="numeric"
            value={newChamber.fee_old}
            onChange={(e) => setNewChamber((s) => ({ ...s, fee_old: e.target.value.replace(/[^0-9.]/g, "") }))}
          />
          <Button onClick={() => addChamber.mutate()} disabled={addChamber.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
        {chamberList.length > 0 && (
          <ul className="mt-3 space-y-2">
            {chamberList.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs"
              >
                <span className="font-medium">{c.name}</span>
                {c.address && <span className="text-muted-foreground">{c.address}</span>}
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="text-muted-foreground">New ৳</span>
                  <Input
                    className="h-8 w-20"
                    inputMode="numeric"
                    defaultValue={String(c.fee_new ?? 0)}
                    onBlur={(e) =>
                      saveFees.mutate({
                        id: c.id,
                        fee_new: Number(e.target.value) || 0,
                        fee_old: Number(c.fee_old ?? 0),
                      })
                    }
                  />
                  <span className="text-muted-foreground">Old ৳</span>
                  <Input
                    className="h-8 w-20"
                    inputMode="numeric"
                    defaultValue={String(c.fee_old ?? 0)}
                    onBlur={(e) =>
                      saveFees.mutate({
                        id: c.id,
                        fee_new: Number(c.fee_new ?? 0),
                        fee_old: Number(e.target.value) || 0,
                      })
                    }
                  />
                </span>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => { if (confirm(`Remove ${c.name}?`)) delChamber.mutate(c.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5">
        <h2 className="mb-3 text-sm font-semibold">Add patient</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="mb-1.5 block text-xs">Location</Label>
            {isAssistant ? (
              <div className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 text-sm">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="truncate">
                  {chamberList.find((c) => c.id === lockedChamberId)?.name ??
                    "No location assigned yet"}
                </span>
              </div>
            ) : (
              <select
                value={chamberId}
                onChange={(e) => setChamberId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm"
              >
                <option value="">— No location —</option>
                {chamberList.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Time</Label>
            <Input
              type="time"
              value={form.appt_time}
              onChange={(e) => setForm((s) => ({ ...s, appt_time: e.target.value }))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Patient name *</Label>
            <Input
              value={form.patient_name}
              onChange={(e) => setForm((s) => ({ ...s, patient_name: e.target.value }))}
              placeholder="Name"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Age</Label>
            <Input
              value={form.patient_age}
              onChange={(e) => setForm((s) => ({ ...s, patient_age: e.target.value }))}
              placeholder="Age"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Gender</Label>
            <select
              value={form.patient_gender}
              onChange={(e) => setForm((s) => ({ ...s, patient_gender: e.target.value }))}
              className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm"
            >
              <option value="">—</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Phone</Label>
            <Input
              value={form.patient_phone}
              onChange={(e) => setForm((s) => ({ ...s, patient_phone: e.target.value }))}
              placeholder="Phone"
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => addPatient.mutate()} disabled={addPatient.isPending}>
              <Plus className="mr-1 h-4 w-4" /> {addPatient.isPending ? "Adding…" : "Add to queue"}
            </Button>
          </div>
        </div>
      </div>

      <QueueStats businessId={businessId} date={date} />

      <AppointmentQueue
        businessId={businessId}
        date={date}
        chamberId={chamberId || undefined}
        chambers={chamberList}
        allowDelete
        allowEdit
      />
    </div>
  );
}

/** Small day summary so assistants have a dashboard on top of the queue. */
function QueueStats({ businessId, date }: { businessId?: string; date: string }) {
  const stats = useQuery({
    queryKey: ["rx-appointment-stats", businessId, date],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rx_appointments")
        .select("id, status, prescription_id")
        .eq("business_id", businessId!)
        .eq("appt_date", date);
      if (error) throw error;
      const rows = data ?? [];
      return {
        total: rows.length,
        started: rows.filter((r: any) => !!r.prescription_id).length,
        waiting: rows.filter((r: any) => !r.prescription_id && r.status !== "cancelled").length,
        done: rows.filter((r: any) => r.status === "done").length,
      };
    },
  });
  const s = stats.data ?? { total: 0, started: 0, waiting: 0, done: 0 };
  const cards = [
    { label: "Patients today", value: s.total },
    { label: "Waiting", value: s.waiting },
    { label: "Rx started", value: s.started },
    { label: "Completed", value: s.done },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className="mt-1 font-display text-2xl font-semibold">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
