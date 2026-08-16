import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Users, FileText, Wallet, Stethoscope } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { AppointmentQueue, useChambers } from "@/components/appointment-queue";
import { dhakaToday } from "@/lib/appointments";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/clinic-dashboard")({
  head: () => ({
    meta: [
      { title: "Clinic Dashboard — Doctors, Tokens & Fees" },
      {
        name: "description",
        content:
          "Multi-doctor clinic dashboard: day-wise patient tokens, serials, chamber-wise consultation fees and prescription counts for every doctor.",
      },
      { property: "og:title", content: "Clinic Dashboard — Doctors, Tokens & Fees" },
      {
        property: "og:description",
        content: "Track every doctor's patients, serials and fee collection in one clinic view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClinicDashboard,
});

function ClinicDashboard() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const { isAdmin } = useCurrentRole();
  const qc = useQueryClient();
  const chambers = useChambers(businessId);
  const [date, setDate] = useState(dhakaToday());

  const toggleClinic = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("businesses")
        .update({ clinic_mode: next } as any)
        .eq("id", businessId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mode updated");
      qc.invalidateQueries({ queryKey: ["current-business"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const day = useQuery({
    queryKey: ["clinic-day", businessId, date],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: appts, error } = await supabase
        .from("rx_appointments")
        .select(
          "id, doctor_id, chamber_id, patient_code, patient_name, serial_no, fee_amount, is_new_patient, status, prescription_id",
        )
        .eq("business_id", businessId!)
        .eq("appt_date", date);
      if (error) throw error;

      const ids = Array.from(
        new Set((appts ?? []).map((a: any) => a.doctor_id).filter(Boolean)),
      ) as string[];
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, doctor_name, first_name, last_name")
          .in("id", ids);
        for (const p of (profs ?? []) as any[]) {
          names[p.id] =
            (p.doctor_name ?? "").trim() ||
            [p.first_name, p.last_name].filter(Boolean).join(" ") ||
            "Doctor";
        }
      }
      return { appts: (appts ?? []) as any[], names };
    },
  });

  const appts = day.data?.appts ?? [];
  const names = day.data?.names ?? {};
  const fees = appts.reduce((s, a) => s + Number(a.fee_amount ?? 0), 0);
  const started = appts.filter((a) => a.prescription_id).length;
  const doctorRows = Object.values(
    appts.reduce((acc: Record<string, any>, a) => {
      const key = a.doctor_id ?? "none";
      acc[key] = acc[key] ?? {
        key,
        name: a.doctor_id ? names[a.doctor_id] ?? "Doctor" : "Unassigned",
        patients: 0,
        newPatients: 0,
        fees: 0,
        rx: 0,
      };
      acc[key].patients += 1;
      if (a.is_new_patient !== false) acc[key].newPatients += 1;
      acc[key].fees += Number(a.fee_amount ?? 0);
      if (a.prescription_id) acc[key].rx += 1;
      return acc;
    }, {}),
  ) as any[];

  const chamberRows = Object.values(
    appts.reduce((acc: Record<string, any>, a) => {
      const key = a.chamber_id ?? "none";
      acc[key] = acc[key] ?? {
        key,
        name: chambers.data?.find((c) => c.id === a.chamber_id)?.name ?? "No location",
        patients: 0,
        fees: 0,
      };
      acc[key].patients += 1;
      acc[key].fees += Number(a.fee_amount ?? 0);
      return acc;
    }, {}),
  ) as any[];

  const cards = [
    { label: "Patients today", value: appts.length, icon: Users, color: "bg-primary/15 text-primary" },
    { label: "Doctors on duty", value: doctorRows.length, icon: Stethoscope, color: "bg-chart-2/15 text-chart-2" },
    { label: "Prescriptions started", value: started, icon: FileText, color: "bg-chart-3/15 text-chart-3" },
    { label: "Fees (৳)", value: fees.toFixed(2), icon: Wallet, color: "bg-chart-4/15 text-chart-4" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Clinic Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            All doctors · tokens, serials & fee collection · {business?.name ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || dhakaToday())}
            className="h-9 rounded-lg border border-border bg-input px-3 text-sm"
          />
          <Link
            to="/rx-appointments"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
          >
            Patient Queue
          </Link>
          <Link
            to="/rx-dashboard"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
          >
            Doctor Mode
          </Link>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3">
          <Building2 className="h-4 w-4 text-primary" />
          <Switch
            id="clinic-mode"
            checked={!!business?.clinic_mode}
            onCheckedChange={(v) => toggleClinic.mutate(v)}
          />
          <Label htmlFor="clinic-mode" className="text-xs leading-tight">
            Clinic mode
            <span className="block text-[10px] text-muted-foreground">
              {business?.clinic_mode
                ? "Multi-doctor clinic: reception tokens, fees and all doctors' data."
                : "Single doctor mode: only the signed-in doctor's own data."}
            </span>
          </Label>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.color}`}>
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 font-display text-3xl font-semibold">
              {day.isLoading ? "…" : c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5">
          <h2 className="mb-3 text-sm font-semibold">Doctor-wise</h2>
          {doctorRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No patients for this day.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60 text-left">
                  <th className="py-1.5">Doctor</th>
                  <th className="py-1.5">Patients</th>
                  <th className="py-1.5">New</th>
                  <th className="py-1.5">Rx</th>
                  <th className="py-1.5 text-right">Fees ৳</th>
                </tr>
              </thead>
              <tbody>
                {doctorRows.map((d) => (
                  <tr key={d.key} className="border-b border-border/40">
                    <td className="py-1.5 font-medium">{d.name}</td>
                    <td className="py-1.5">{d.patients}</td>
                    <td className="py-1.5">{d.newPatients}</td>
                    <td className="py-1.5">{d.rx}</td>
                    <td className="py-1.5 text-right">{d.fees.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5">
          <h2 className="mb-3 text-sm font-semibold">Location-wise</h2>
          {chamberRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No patients for this day.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60 text-left">
                  <th className="py-1.5">Location</th>
                  <th className="py-1.5">Patients</th>
                  <th className="py-1.5 text-right">Fees ৳</th>
                </tr>
              </thead>
              <tbody>
                {chamberRows.map((c) => (
                  <tr key={c.key} className="border-b border-border/40">
                    <td className="py-1.5 font-medium">{c.name}</td>
                    <td className="py-1.5">{c.patients}</td>
                    <td className="py-1.5 text-right">{c.fees.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AppointmentQueue
        businessId={businessId}
        date={date}
        chambers={chambers.data ?? []}
        clinicName={business?.clinic_mode ? business?.name ?? null : null}
        allowEdit
        allowDelete
        allowStart={false}
      />
    </div>
  );
}
