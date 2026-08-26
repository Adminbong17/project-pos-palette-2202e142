import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { toast } from "sonner";
import { Printer, Search } from "lucide-react";
import { printHrmReport } from "@/lib/hrm-print";
import { PrintSizeButton } from "@/components/print-size-select";
import { Input } from "@/components/ui/input";
import { FoldTable } from "@/components/fold-table";

export const Route = createFileRoute("/_authenticated/hrm/attendance")({
  component: AttendancePage,
});

const STATUSES = ["present", "absent", "half", "leave"] as const;
type Status = typeof STATUSES[number];

function AttendancePage() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  const { data: employees = [] } = useQuery({
    queryKey: ["hrm_employees_active", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hrm_employees").select("id, name, designation")
        .eq("business_id", business!.id).eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["hrm_attendance", business?.id, date],
    enabled: !!business,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hrm_attendance").select("*")
        .eq("business_id", business!.id).eq("date", date);
      if (error) throw error;
      return data ?? [];
    },
  });

  const byEmp = new Map<string, any>(rows.map((r: any) => [r.employee_id, r]));

  const q = search.trim().toLowerCase();
  const filteredEmployees = q
    ? employees.filter((e: any) => {
        const r = byEmp.get(e.id);
        return [e.name, e.designation, r?.status, r?.check_in, r?.check_out, r?.notes]
          .some((v) => String(v ?? "").toLowerCase().includes(q));
      })
    : employees;

  const upsert = useMutation({
    mutationFn: async (payload: { employee_id: string; status: Status; check_in?: string; check_out?: string; notes?: string }) => {
      if (!business) throw new Error("No business");
      const { error } = await supabase.from("hrm_attendance").upsert({
        business_id: business.id,
        employee_id: payload.employee_id,
        date,
        status: payload.status,
        check_in: payload.check_in || null,
        check_out: payload.check_out || null,
        notes: payload.notes || null,
      }, { onConflict: "employee_id,date" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hrm_attendance"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const markAll = useMutation({
    mutationFn: async (status: Status) => {
      if (!business) throw new Error("No business");
      const payload = employees.map((e: any) => ({
        business_id: business.id,
        employee_id: e.id,
        date,
        status,
      }));
      const { error } = await supabase.from("hrm_attendance").upsert(payload, { onConflict: "employee_id,date" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked all"); qc.invalidateQueries({ queryKey: ["hrm_attendance"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium text-muted-foreground">Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="h-9 rounded-lg border border-border bg-input px-3 text-sm" />
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees…" className="pl-9" />
        </div>
        <div className="ml-auto flex gap-1.5">
          <button onClick={() => markAll.mutate("present")} className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs">Mark all present</button>
          <button onClick={() => markAll.mutate("absent")} className="rounded-lg bg-rose-600 text-white px-3 py-1.5 text-xs">Mark all absent</button>
          <PrintSizeButton onPrint={(size) => printHrmReport({
            title: "Attendance Report",
            subtitle: `Date: ${new Date(date).toLocaleDateString("en-GB")}`,
            business,
            columns: [
              { label: "Employee" }, { label: "Designation" }, { label: "Status" },
              { label: "Check in" }, { label: "Check out" }, { label: "Notes" },
            ],
            rows: employees.map((e: any) => {
              const r = byEmp.get(e.id);
              return [e.name, e.designation ?? "", r?.status ?? "—", r?.check_in ?? "—", r?.check_out ?? "—", r?.notes ?? ""];
            }),
            filename: `attendance-${date}`,
            size,
          })} />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
        <FoldTable className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Employee</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Check in</th>
              <th className="text-left px-4 py-3">Check out</th>
              <th className="text-left px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {employees.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Add employees first.</td></tr>
            ) : filteredEmployees.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No match.</td></tr>
            ) : filteredEmployees.map((e: any) => {
              const r = byEmp.get(e.id);
              return (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{e.designation ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={r?.status ?? ""}
                      onChange={(ev) => upsert.mutate({ employee_id: e.id, status: ev.target.value as Status, check_in: r?.check_in, check_out: r?.check_out, notes: r?.notes })}
                      className="h-8 rounded border border-border bg-input px-2 text-xs">
                      <option value="" disabled>—</option>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input type="time" defaultValue={r?.check_in ?? ""}
                      onBlur={(ev) => r?.status && upsert.mutate({ employee_id: e.id, status: r.status, check_in: ev.target.value, check_out: r?.check_out, notes: r?.notes })}
                      className="h-8 rounded border border-border bg-input px-2 text-xs" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="time" defaultValue={r?.check_out ?? ""}
                      onBlur={(ev) => r?.status && upsert.mutate({ employee_id: e.id, status: r.status, check_in: r?.check_in, check_out: ev.target.value, notes: r?.notes })}
                      className="h-8 rounded border border-border bg-input px-2 text-xs" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" defaultValue={r?.notes ?? ""} placeholder="—"
                      onBlur={(ev) => r?.status && upsert.mutate({ employee_id: e.id, status: r.status, check_in: r?.check_in, check_out: r?.check_out, notes: ev.target.value })}
                      className="h-8 w-full rounded border border-border bg-input px-2 text-xs" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </FoldTable>
      </div>
    </div>
  );
}
