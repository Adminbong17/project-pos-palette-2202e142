import { FloatingSearch } from "@/components/floating-search";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "checkbox" | "select" | "date" | "textarea";
  options?: { value: string | number; label: string }[];
  required?: boolean;
  defaultValue?: any;
  placeholder?: string;
};

type Props = {
  table: string;
  title: string;
  fields: FieldDef[];
  listColumns: { key: string; label: string; render?: (row: any) => React.ReactNode }[];
  orderBy?: string;
};


export function MasterDataTable({ table, title, fields, listColumns, orderBy = "name" }: Props) {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [table, business?.id],
    queryFn: async () => {
      if (!business) return [];
      const { data, error } = await supabase
        .from(table as any)
        .select("*")
        .eq("business_id", business.id)
        .order(orderBy, { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!business,
  });


  const save = useMutation({
    mutationFn: async (values: any) => {
      if (!business) throw new Error("No business");
      const payload = { ...values, business_id: business.id };
      if (editing?.id) {
        const { error } = await supabase.from(table as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: [table] });
      setShowForm(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDel = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from(table as any).delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast.success(`Deleted ${ids.length} record(s)`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const q = search.trim().toLowerCase();
  const filteredRows = q
    ? (rows as any[]).filter((r) => String(r[orderBy] ?? r.name ?? "").toLowerCase().includes(q))
    : (rows as any[]);

  const allIds = filteredRows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const toggleOne = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values: any = {};
    for (const f of fields) {
      const raw = fd.get(f.key);
      if (f.type === "checkbox") values[f.key] = raw === "on";
      else if (f.type === "number") values[f.key] = raw ? Number(raw) : null;
      else values[f.key] = raw || null;
    }
    save.mutate(values);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <FloatingSearch spacer={40} className="max-w-[calc(100vw-24px)]">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm" />
          </FloatingSearch>
          {selected.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <button
                onClick={() => { if (confirm(`Delete ${selected.size} record(s)?`)) bulkDel.mutate(Array.from(selected)); }}
                disabled={bulkDel.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground">
                <Trash2 className="h-3.5 w-3.5" /> Delete selected
              </button>
            </>
          )}
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Add new
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">{editing ? "Edit" : "New"} {title.replace(/s$/, "")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </span>
                {f.type === "checkbox" ? (
                  <input type="checkbox" name={f.key} defaultChecked={editing?.[f.key] ?? f.defaultValue ?? false}
                    className="h-4 w-4 rounded border-border" />
                ) : f.type === "select" ? (
                  <select name={f.key} required={f.required} defaultValue={editing?.[f.key] ?? f.defaultValue ?? ""}
                    className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm">
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea name={f.key} required={f.required} placeholder={f.placeholder}
                    defaultValue={editing?.[f.key] ?? f.defaultValue ?? ""}
                    className="w-full min-h-[72px] rounded-lg border border-border bg-input px-3 py-2 text-sm" />
                ) : (
                  <input
                    name={f.key}
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    step={f.type === "number" ? "any" : undefined}
                    required={f.required}
                    placeholder={f.placeholder}
                    defaultValue={editing?.[f.key] ?? f.defaultValue ?? ""}
                    className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm" />
                )}
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
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
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  className="h-4 w-4 rounded border-border" />
              </th>
              {listColumns.map((c) => <th key={c.key} className="text-left px-4 py-3 font-medium">{c.label}</th>)}
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading ? (
              <tr><td colSpan={listColumns.length + 2} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={listColumns.length + 2} className="p-8 text-center text-muted-foreground">{q ? "No matches." : "No records yet."}</td></tr>
            ) : filteredRows.map((row: any) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)}
                    className="h-4 w-4 rounded border-border" />
                </td>
                {listColumns.map((c) => (
                  <td key={c.key} className="px-4 py-3">
                    {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <button onClick={() => { setEditing(row); setShowForm(true); }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => { if (confirm("Delete this record?")) del.mutate(row.id); }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
