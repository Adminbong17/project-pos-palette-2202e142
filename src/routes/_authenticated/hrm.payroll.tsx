import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Printer, Search } from "lucide-react";
import { printHrmReport } from "@/lib/hrm-print";
import { PrintSizeButton } from "@/components/print-size-select";
import { Input } from "@/components/ui/input";
import { FoldTable } from "@/components/fold-table";

export const Route = createFileRoute("/_authenticated/hrm/payroll")({
  component: PayrollPage,
});

function PayrollPage() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState("");

  const { data: employees = [] } = useQuery({
    queryKey: ["hrm_employees_all", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase.from("hrm_employees").select("id, name, salary")
        .eq("business_id", business!.id).order("name");
      return data ?? [];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["hrm_payrolls", business?.id, month],
    enabled: !!business,
    queryFn: async () => {
      const { data, error } = await supabase.from("hrm_payrolls").select("*, hrm_employees(name)")
        .eq("business_id", business!.id).eq("period_month", month).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      if (!business) throw new Error("No business");
      const gross = Number(fd.get("gross") || 0);
      const deductions = Number(fd.get("deductions") || 0);
      const payload: any = {
        business_id: business.id,
        employee_id: fd.get("employee_id") as string,
        period_month: fd.get("period_month") as string,
        gross,
        deductions,
        net: gross - deductions,
        paid_on: (fd.get("paid_on") as string) || null,
        notes: (fd.get("notes") as string) || null,
      };
      if (editing?.id) {
        const { error } = await supabase.from("hrm_payrolls").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hrm_payrolls").upsert(payload, { onConflict: "employee_id,period_month" });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); setShowForm(false); setEditing(null); qc.invalidateQueries({ queryKey: ["hrm_payrolls"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hrm_payrolls").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["hrm_payrolls"] }); },
  });

  const generateAll = useMutation({
    mutationFn: async () => {
      if (!business) throw new Error("No business");
      const active = employees.filter((e: any) => Number(e.salary || 0) > 0);
      if (active.length === 0) throw new Error("No employees with salary");
      const payload = active.map((e: any) => ({
        business_id: business.id,
        employee_id: e.id,
        period_month: month,
        gross: Number(e.salary || 0),
        deductions: 0,
        net: Number(e.salary || 0),
      }));
      const { error } = await supabase.from("hrm_payrolls").upsert(payload, { onConflict: "employee_id,period_month" });
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => { toast.success(`Generated ${n} payslip(s)`); qc.invalidateQueries({ queryKey: ["hrm_payrolls"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const totals = rows.reduce((acc: any, r: any) => ({
    gross: acc.gross + Number(r.gross || 0),
    ded: acc.ded + Number(r.deductions || 0),
    net: acc.net + Number(r.net || 0),
  }), { gross: 0, ded: 0, net: 0 });

  const q = search.trim().toLowerCase();
  const filteredRows = q
    ? rows.filter((r: any) =>
        [r.hrm_employees?.name, r.gross, r.deductions, r.net, r.paid_on, r.notes]
          .some((v) => String(v ?? "").toLowerCase().includes(q)))
    : rows;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium text-muted-foreground">Month</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="h-9 rounded-lg border border-border bg-input px-3 text-sm" />
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search payslips…" className="pl-9" />
        </div>
        <div className="ml-auto flex gap-1.5">
          <PrintSizeButton onPrint={(size) => printHrmReport({
            title: "Payroll Report",
            subtitle: `Month: ${month}`,
            business,
            columns: [
              { label: "Employee" },
              { label: "Gross", align: "right" },
              { label: "Deductions", align: "right" },
              { label: "Net", align: "right" },
              { label: "Paid on" },
            ],
            rows: rows.map((r: any) => [
              r.hrm_employees?.name ?? "—",
              `৳ ${Number(r.gross).toLocaleString()}`,
              `৳ ${Number(r.deductions).toLocaleString()}`,
              `৳ ${Number(r.net).toLocaleString()}`,
              r.paid_on ? new Date(r.paid_on).toLocaleDateString("en-GB") : "—",
            ]),
            footer: rows.length > 0 ? [[
              "Total",
              `৳ ${totals.gross.toLocaleString()}`,
              `৳ ${totals.ded.toLocaleString()}`,
              `৳ ${totals.net.toLocaleString()}`,
              "",
            ]] : [],
            filename: `payroll-${month}`,
            size,
          })} />
          <button onClick={() => generateAll.mutate()} disabled={generateAll.isPending}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium">
            {generateAll.isPending ? "Generating…" : "Auto-generate for all"}
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Add payslip
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }}
          className="rounded-2xl border border-border/60 bg-card p-5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">Employee *</span>
            <select name="employee_id" required defaultValue={editing?.employee_id ?? ""}
              className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm">
              <option value="">Select…</option>
              {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">Month *</span>
            <input name="period_month" type="month" required defaultValue={editing?.period_month ?? month}
              className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">Gross *</span>
            <input name="gross" type="number" step="any" required defaultValue={editing?.gross ?? 0}
              className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">Deductions</span>
            <input name="deductions" type="number" step="any" defaultValue={editing?.deductions ?? 0}
              className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">Paid on</span>
            <input name="paid_on" type="date" defaultValue={editing?.paid_on ?? ""}
              className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm" />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">Notes</span>
            <textarea name="notes" defaultValue={editing?.notes ?? ""}
              className="w-full min-h-[64px] rounded-lg border border-border bg-input px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs">Cancel</button>
            <button type="submit" disabled={save.isPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
        <FoldTable className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Employee</th>
              <th className="text-right px-4 py-3">Gross</th>
              <th className="text-right px-4 py-3">Deductions</th>
              <th className="text-right px-4 py-3">Net</th>
              <th className="text-left px-4 py-3">Paid on</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No payslips for {month}.</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No match.</td></tr>
            ) : filteredRows.map((r: any) => (
              <tr key={r.id}>
                <td className="px-4 py-3">{r.hrm_employees?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right">৳ {Number(r.gross).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">৳ {Number(r.deductions).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-semibold">৳ {Number(r.net).toLocaleString()}</td>
                <td className="px-4 py-3">{r.paid_on ?? "—"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => { setEditing(r); setShowForm(true); }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { if (confirm("Delete?")) del.mutate(r.id); }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
            {filteredRows.length > 0 && (
              <tr className="bg-muted/20 font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">৳ {totals.gross.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">৳ {totals.ded.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">৳ {totals.net.toLocaleString()}</td>
                <td colSpan={2}></td>
              </tr>
            )}
          </tbody>
        </FoldTable>
      </div>
    </div>
  );
}
