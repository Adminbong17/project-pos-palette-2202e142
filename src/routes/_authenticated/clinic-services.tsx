import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2, Save } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/clinic-services")({
  head: () => ({
    meta: [
      { title: "Clinic Products & Services — Price List" },
      {
        name: "description",
        content:
          "Manage clinic products and services with prices: add, edit and activate items that the clinic counter sells from the POS-style billing screen.",
      },
      { property: "og:title", content: "Clinic Products & Services — Price List" },
      {
        property: "og:description",
        content: "Add clinic products and services with prices for counter billing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClinicServicesPage,
});

type Row = {
  id: string;
  name: string;
  kind: string;
  price: number;
  is_active: boolean;
};

function ClinicServicesPage() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("service");
  const [price, setPrice] = useState("");
  const [edits, setEdits] = useState<Record<string, { name: string; price: string }>>({});

  const list = useQuery({
    queryKey: ["clinic-services", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_services")
        .select("id, name, kind, price, is_active")
        .eq("business_id", business!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return list.data ?? [];
    return (list.data ?? []).filter((r) => r.name.toLowerCase().includes(s));
  }, [list.data, search]);

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("clinic_services").insert({
        business_id: business!.id,
        name: name.trim(),
        kind,
        price: Number(price || 0),
        created_by: u.user?.id ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setPrice("");
      qc.invalidateQueries({ queryKey: ["clinic-services"] });
      toast.success("Added");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to add"),
  });

  const update = useMutation({
    mutationFn: async (p: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("clinic_services")
        .update(p.patch as never)
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-services"] });
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinic_services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-services"] });
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-full overflow-x-hidden">
      <div>
        <h1 className="font-display text-2xl font-semibold">Products & Services</h1>
        <p className="text-sm text-muted-foreground">
          Clinic price list — these items are sold from the Clinic Sales counter.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 grid gap-3 sm:grid-cols-[1fr_150px_140px_auto] sm:items-end">
        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ultrasound, Dressing, Tooth filling" />
        </label>
        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">Type</span>
          <select
            className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="service">Service</option>
            <option value="product">Product</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-muted-foreground mb-1.5">Price</span>
          <Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        </label>
        <Button onClick={() => add.mutate()} disabled={add.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item…" />
      </div>

      <div className="space-y-2">
        {list.isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No items yet.</div>
        ) : (
          filtered.map((r) => {
            const e = edits[r.id] ?? { name: r.name, price: String(r.price) };
            const dirty = e.name !== r.name || Number(e.price || 0) !== Number(r.price);
            return (
              <div key={r.id} className="rounded-xl border border-border/60 bg-card p-3 grid gap-2 sm:grid-cols-[1fr_140px_auto_auto_auto] sm:items-center">
                <Input
                  value={e.name}
                  onChange={(ev) => setEdits((p) => ({ ...p, [r.id]: { ...e, name: ev.target.value } }))}
                />
                <Input
                  type="number"
                  step="any"
                  value={e.price}
                  onChange={(ev) => setEdits((p) => ({ ...p, [r.id]: { ...e, price: ev.target.value } }))}
                />
                <span className="text-xs uppercase text-muted-foreground">{r.kind}</span>
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={r.is_active}
                    onCheckedChange={(v) => update.mutate({ id: r.id, patch: { is_active: v } })}
                  />
                  Active
                </label>
                <div className="flex gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!dirty || update.isPending}
                    onClick={() => update.mutate({ id: r.id, patch: { name: e.name.trim(), price: Number(e.price || 0) } })}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`Delete "${r.name}"?`)) remove.mutate(r.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
