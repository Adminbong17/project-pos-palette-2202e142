import { isSuperAdminEmail } from "@/lib/super-admin-auth";
import { createFileRoute } from "@tanstack/react-router";
import { fmtDateTime } from "@/lib/format-date";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Search, Building2, Check, X, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ALL_SECTIONS } from "@/hooks/use-allowed-sections";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllRequests,
  approveBusinessRequestServer,
  rejectBusinessRequestServer,
  type AdminBusinessRequest,
} from "@/lib/admin-requests.functions";

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
  const isAdmin = isSuperAdminEmail(me?.email);

  const fetchRequestsFn = useServerFn(listAllRequests);
  const approveFn = useServerFn(approveBusinessRequestServer);
  const rejectFn = useServerFn(rejectBusinessRequestServer);

  const { data: reqData, isLoading, refetch } = useQuery({
    queryKey: ["business-requests-all"],
    enabled: !!isAdmin,
    queryFn: () => fetchRequestsFn(),
  });

  const rows = reqData?.businessRequests ?? [];

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const picked = sections[id];
      await approveFn({
        data: {
          id,
          notes: notes[id] || undefined,
          sections: picked && picked.length ? picked : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Business approved & created successfully!");
      qc.invalidateQueries({ queryKey: ["business-requests-all"] });
      qc.invalidateQueries({ queryKey: ["super-admin-master-metrics"] });
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      await rejectFn({
        data: {
          id,
          notes: notes[id] || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Request rejected");
      qc.invalidateQueries({ queryKey: ["business-requests-all"] });
      qc.invalidateQueries({ queryKey: ["super-admin-master-metrics"] });
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!me) return <div className="p-8">Loading…</div>;
  if (!isAdmin) return <div className="p-8 text-sm text-muted-foreground">Only the super admin can access this page.</div>;

  const q = search.trim().toLowerCase();
  const matches = (r: AdminBusinessRequest) =>
    !q ||
    [r.name, r.location_name, r.sku_prefix, r.user_id, r.user_email, r.status, r.admin_notes]
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
          placeholder="Search requests by name or email…"
          className="pl-9"
        />
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <span>Pending Requests ({pending.length})</span>
          {pending.length > 0 && <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />}
        </h2>
        <div className="space-y-3">
          {isLoading && <div className="text-sm text-muted-foreground">Loading requests from database…</div>}
          {!isLoading && pending.length === 0 && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              {q ? "No requests match your search." : "No pending business requests right now. All caught up!"}
            </div>
          )}
          {pending.map((r) => (
            <div key={r.id} className="rounded-2xl border border-amber-500/40 bg-card p-5 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-base font-bold text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span>{r.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Location: <span className="font-medium text-foreground">{r.location_name}</span> · SKU Prefix: <span className="font-mono text-foreground">{r.sku_prefix ?? "—"}</span> · Requested: {fmtDateTime(r.created_at)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Applicant: <span className="font-medium text-foreground">{r.user_email || r.user_id}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-2">
                <div className="text-xs font-semibold">Allowed sections / modules</div>
                <p className="text-[11px] text-muted-foreground">
                  Leave everything unchecked to give this business full access (all 32 modules).
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 pt-1">
                  {SECTION_OPTIONS.map((o) => (
                    <label key={o.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary rounded cursor-pointer"
                        checked={(sections[r.id] ?? []).includes(o.key)}
                        onChange={() => toggleSection(r.id, o.key)}
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <textarea
                placeholder="Admin notes (optional)"
                value={notes[r.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                className="w-full min-h-[60px] rounded-xl border border-border bg-input p-2.5 text-xs outline-none"
              />

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => approve.mutate(r.id)}
                  disabled={approve.isPending}
                  className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-xs">
                  {approve.isPending ? "Approving…" : "Approve Business"}
                </button>
                <button
                  onClick={() => reject.mutate(r.id)}
                  disabled={reject.isPending}
                  className="h-9 px-4 rounded-xl border border-border text-xs font-semibold hover:bg-muted disabled:opacity-50 cursor-pointer">
                  {reject.isPending ? "Rejecting…" : "Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">History ({others.length})</h2>
        <div className="space-y-2">
          {others.length === 0 && <div className="text-sm text-muted-foreground">{q ? "No match." : "No history yet."}</div>}
          {others.map((r) => (
            <div key={r.id} className="rounded-xl border border-border/60 bg-card p-3.5 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold text-sm text-foreground">{r.name}</span>
                <span className="ml-2 text-muted-foreground">({r.user_email || r.user_id})</span>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {fmtDateTime(r.created_at)} {r.admin_notes ? `— Notes: ${r.admin_notes}` : ""}
                </div>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                r.status === "approved" ? "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20" : "text-destructive bg-destructive/10 border border-destructive/20"
              }`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
