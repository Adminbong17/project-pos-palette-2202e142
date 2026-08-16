import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { toast } from "sonner";
import { Plus, Check, X, Trash2, Printer, Search } from "lucide-react";
import { printHrmReport } from "@/lib/hrm-print";
import { PrintSizeButton } from "@/components/print-size-select";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/hrm/leaves")({
  component: LeavesPage,
});

function LeavesPage() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  const { data: employees = [] } = useQuery({
    queryKey: ["hrm_employees_active", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase.from("hrm_employees").select("id, name")
        .eq("business_id", business!.id).eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["hrm_leaves", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data, error } = await supabase.from("hrm_leaves").select("*, hrm_employees(name)")
        .eq("business_id", business!.id).order("from_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (fd: FormData) => {
      if (!business) throw new Error("No business");
      const { error } = await supabase.from("hrm_leaves").insert({
        business_id: business.id,
        employee_id: fd.get("employee_id") as string,
        from_date: fd.get("from_date") as string,
        to_date: fd.get("to_date") as string,
        leave_type: fd.get("leave_type") as string,
        reason: (fd.get("reason") as string) || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Leave requested"); setShowForm(false); qc.invalidateQueries({ queryKey: ["hrm_leaves"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("hrm_leaves").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hrm_leaves"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hrm_leaves").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["hrm_leaves"] }); },
  });

  const q = search.trim().toLowerCase();
  const filteredRows = q
    ? rows.filter((r: any) =>
        [r.hrm_employees?.name, r.leave_type, r.from_date, r.to_date, r.reason, r.status]
          .some((v) => String(v ?? "").toLowerCase().includes(q)))
    : rows;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leave requests…" className="pl-9" />
        </div>
        <div className="ml-auto flex gap-2">
        <PrintSizeButton onPrint={(size) => printHrmReport({
          title: "Leave Requests",
          business,
          columns: [
            { label: "Employee" }, { label: "Type" }, { label: "From" }, { label: "To" }, { label: "Reason" }, { label: "Status" },
          ],
          rows: rows.map((r: any) => [
            r.hrm_employees?.name ?? "—", r.leave_type,
            r.from_date ? new Date(r.from_date).toLocaleDateString("en-GB") : "—",
            r.to_date ? new Date(r.to_date).toLocaleDateString("en-GB") : "—",
            r.reason ?? "—", r.status,
          ]),
          filename: "leaves",
          size,
        })} />
        <button onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> New leave request
        </button>
        </div>
      </div>


      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(new FormData(e.currentTarget)); }}
          className="rounded-2xl border border-border/60 bg-card p-5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">Employee *</span>
            <select name="employee_id" required className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm">
              <option value="">Select…</option>
              {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">Type *</span>
            <select name="leave_type" required defaultValue="casual" className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm">
              {["casual", "sick", "annual", "unpaid", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">From *</span>
            <input name="from_date" type="date" required className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">To *</span>
            <input name="to_date" type="date" required className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm" />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">Reason</span>
            <textarea name="reason" className="w-full min-h-[72px] rounded-lg border border-border bg-input px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs">Cancel</button>
            <button type="submit" disabled={create.isPending} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
              {create.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Employee</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">From</th>
              <th className="text-left px-4 py-3">To</th>
              <th className="text-left px-4 py-3">Reason</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No leave requests yet.</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No match.</td></tr>
            ) : filteredRows.map((r: any) => (
              <tr key={r.id}>
                <td className="px-4 py-3">{r.hrm_employees?.name ?? "—"}</td>
                <td className="px-4 py-3">{r.leave_type}</td>
                <td className="px-4 py-3">{r.from_date}</td>
                <td className="px-4 py-3">{r.to_date}</td>
                <td className="px-4 py-3 max-w-[240px] truncate">{r.reason ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs ${r.status === "approved" ? "bg-emerald-100 text-emerald-700" : r.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {r.status === "pending" && (
                    <>
                      <button onClick={() => setStatus.mutate({ id: r.id, status: "approved" })} title="Approve"
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setStatus.mutate({ id: r.id, status: "rejected" })} title="Reject"
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-rose-600"><X className="h-3.5 w-3.5" /></button>
                    </>
                  )}
                  <button onClick={() => { if (confirm("Delete?")) del.mutate(r.id); }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
