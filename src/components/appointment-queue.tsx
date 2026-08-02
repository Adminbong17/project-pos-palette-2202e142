import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Trash2, Stethoscope } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/utils";
import {
  startPrescriptionFromAppointment,
  type Appointment,
  type Chamber,
} from "@/lib/appointments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AppointmentQueue({
  businessId,
  date,
  chamberId,
  chambers,
  allowDelete = false,
}: {
  businessId?: string;
  date: string;
  chamberId?: string;
  chambers: Chamber[];
  allowDelete?: boolean;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["rx-appointments", businessId, date, chamberId ?? "all"],
    enabled: !!businessId,
    queryFn: async () => {
      let q = supabase
        .from("rx_appointments")
        .select(
          "id, chamber_id, patient_name, patient_age, patient_phone, patient_gender, appt_date, appt_time, serial_no, status, notes, prescription_id",
        )
        .eq("business_id", businessId!)
        .eq("appt_date", date)
        .order("serial_no", { ascending: true });
      if (chamberId) q = q.eq("chamber_id", chamberId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rx_appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["rx-appointments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const chamberName = (id: string | null) =>
    chambers.find((c) => c.id === id)?.name ?? "—";

  const start = async (a: Appointment) => {
    if (!businessId) return;
    setBusy(a.id);
    try {
      const rxId = await startPrescriptionFromAppointment(a, businessId);
      qc.invalidateQueries({ queryKey: ["rx-appointments"] });
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      navigate({ to: "/prescriptions", search: { rx: rxId } as any });
    } catch (e: any) {
      toast.error(e.message ?? "Could not start prescription");
    } finally {
      setBusy(null);
    }
  };

  const rows = list.data ?? [];

  return (
    <div className="rounded-2xl border border-border/60 bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Patient queue · {formatDate(date)}</h2>
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} patient(s)</span>
      </div>

      {list.isLoading ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No patients listed for this day.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 text-sm">
              <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/15 px-1.5 font-mono text-xs font-semibold text-primary">
                {a.serial_no ?? "—"}
              </span>
              <span className="font-medium">{a.patient_name}</span>
              <span className="text-xs text-muted-foreground">
                {a.patient_age ? `${a.patient_age}y` : ""} {a.patient_gender ?? ""}
              </span>
              {a.patient_phone && <span className="text-xs text-muted-foreground">{a.patient_phone}</span>}
              <span className="text-xs text-muted-foreground">{chamberName(a.chamber_id)}</span>
              {a.appt_time && (
                <span className="font-mono text-[11px] text-muted-foreground">{a.appt_time.slice(0, 5)}</span>
              )}
              {a.prescription_id ? (
                <Badge variant="outline" className="text-[10px]">Rx started</Badge>
              ) : null}
              <div className="ml-auto flex items-center gap-1.5">
                <Button size="sm" disabled={busy === a.id} onClick={() => start(a)} className="h-8 text-xs">
                  <FileText className="mr-1 h-3.5 w-3.5" />
                  {a.prescription_id ? "Open prescription" : "Start prescription"}
                </Button>
                {allowDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => { if (confirm("Remove this patient?")) del.mutate(a.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Chambers (locations) + appointments of a business, for reuse across pages. */
export function useChambers(businessId?: string) {
  return useQuery({
    queryKey: ["rx-chambers", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rx_chambers")
        .select("id, name, address, is_active")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Chamber[];
    },
  });
}
