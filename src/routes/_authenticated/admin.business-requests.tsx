import { createFileRoute } from "@tanstack/react-router";
import { fmtDateTime } from "@/lib/format-date";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ALL_SECTIONS } from "@/hooks/use-allowed-sections";

// Unique section keys the super admin can grant to a new business owner.
const SECTION_OPTIONS = Array.from(
  new Map(ALL_SECTIONS.map((s) => [s.key, s.key === "prescriptions" ? "Prescriptions" : s.label])).entries(),
).map(([key, label]) => ({ key, label }));

export const Route = createFileRoute("/_authenticated/admin/business-requests")({
  head: () => ({ meta: [{ title: "Business Requests — Admin" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  // Per-request fixed section access. undefined = full access (all modules).
  const [sections, setSections] = useState<Record<string, string[] | undefined>>({});
  const toggleSection = (id: string, key: string) =>
    setSections((s) => {
      const cur = s[id] ?? [];
      return { ...s, [id]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
    });

  const { data: me } = useQuery({
    queryKey: ["me-email"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const isAdmin = me?.email?.toLowerCase() === "admin@bongbangla.top";

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["business-requests-all"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_requests")
        .select("id, user_id, name, currency_id, sku_prefix, location_name, status, admin_notes, created_at, reviewed_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const picked = sections[id];
      const { error } = await supabase.rpc("approve_business_request", {
        _id: id,
        _notes: notes[id] ?? null,
        _sections: picked && picked.length ? picked : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: ["business-requests-all"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("reject_business_request", { _id: id, _notes: notes[id] ?? null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rejected"); qc.invalidateQueries({ queryKey: ["business-requests-all"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!me) return <div className="p-8">Loading…</div>;
  if (!isAdmin) return <div className="p-8 text-sm text-muted-foreground">Only the super admin can access this page.</div>;

  const q = search.trim().toLowerCase();
  const matches = (r: any) =>
    !q ||
    [r.name, r.location_name, r.sku_prefix, r.user_id, r.status, r.admin_notes]
      .some((v) => String(v ?? "").toLowerCase().includes(q));

  const pending = rows.filter((r) => r.status === "pending" && matches(r));
  const others = rows.filter((r) => r.status !== "pending" && matches(r));

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Business Requests</h1>
        <p className="text-sm text-muted-foreground">Approve or reject pending business creation requests.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search requests…"
          className="pl-9"
        />
      </div>

      <section>
        <h2 className="text-sm font-medium mb-2">Pending ({pending.length})</h2>
        <div className="space-y-3">
          {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && pending.length === 0 && <div className="text-sm text-muted-foreground">{q ? "No match." : "No pending requests."}</div>}
          {pending.map((r) => (
            <div key={r.id} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Location: {r.location_name} · SKU: {r.sku_prefix ?? "—"} · Requested: {fmtDateTime(r.created_at)}
                  </div>
                  <div className="text-xs text-muted-foreground">User: {r.user_id}</div>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="text-xs font-medium">Allowed sections / modules</div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Leave everything unchecked to give this owner full access.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {SECTION_OPTIONS.map((o) => (
                    <label key={o.key} className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={(sections[r.id] ?? []).includes(o.key)}
                        onChange={() => toggleSection(r.id, o.key)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
              <textarea
                placeholder="Admin notes (optional)"
                value={notes[r.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                className="mt-3 w-full min-h-[60px] rounded-lg border border-border bg-input p-2 text-sm"
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => approve.mutate(r.id)}
                  disabled={approve.isPending}
                  className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                  Approve
                </button>
                <button
                  onClick={() => reject.mutate(r.id)}
                  disabled={reject.isPending}
                  className="h-9 px-4 rounded-lg border border-border text-sm font-medium disabled:opacity-50">
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium mb-2">History</h2>
        <div className="space-y-2">
          {others.length === 0 && <div className="text-sm text-muted-foreground">{q ? "No match." : "No history yet."}</div>}
          {others.map((r) => (
            <div key={r.id} className="rounded-lg border border-border/60 bg-card p-3 text-sm flex items-center justify-between">
              <div>
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{r.user_id}</span>
              </div>
              <span className={`text-xs font-medium ${r.status === "approved" ? "text-emerald-500" : "text-destructive"}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}