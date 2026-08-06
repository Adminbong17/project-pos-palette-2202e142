import { FloatingSearch } from "@/components/floating-search";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { fetchAll } from "@/lib/fetch-all";
import { Button } from "@/components/ui/button";
import { Check, Save, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quick-box")({
  head: () => ({
    meta: [
      { title: "Quick Box Add — QweekPOS" },
      { name: "description", content: "Quickly set pieces per box, purchase price and MRP for products." },
    ],
  }),
  component: QuickBoxPage,
});

type Row = {
  variation_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  variation_name: string;
  pack_size: number;
  purchase_price: number;
  mrp: number;
};

type Edit = { pack?: string; pp?: string; mrp?: string };

function QuickBoxPage() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<Record<string, Edit>>({});

  // Keep unsaved edits through a power cut or reload.
  useAutosaveDraft(
    business?.id ? `quick-box:${business.id}` : null,
    { pending },
    (d) => { if (d.pending && Object.keys(d.pending).length) setPending(d.pending as Record<string, Edit>); },
    { isEmpty: (d) => !d.pending || Object.keys(d.pending).length === 0, restoreMessage: "Unsaved box edits restored" },
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["quick-box-rows", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const products = await fetchAll<any>(() =>
        supabase
          .from("products")
          .select("id, name, sku, variations(id, name, pack_size, default_purchase_price, mrp)")
          .eq("business_id", business!.id)
          .order("name", { ascending: true }),
      );
      const out: Row[] = [];
      for (const p of products) {
        for (const v of (p.variations ?? [])) {
          out.push({
            variation_id: v.id,
            product_id: p.id,
            product_name: p.name,
            sku: p.sku ?? "",
            variation_name: v.name && v.name !== "DUMMY" ? v.name : "",
            pack_size: Number(v.pack_size ?? 1),
            purchase_price: Number(v.default_purchase_price ?? 0),
            mrp: Number(v.mrp ?? 0),
          });
        }
      }
      return out;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.product_name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.variation_name.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const setField = (id: string, key: keyof Edit, value: string) =>
    setPending((p) => ({ ...p, [id]: { ...(p[id] ?? {}), [key]: value } }));

  const isDirty = (r: Row) => {
    const e = pending[r.variation_id];
    if (!e) return false;
    const packChanged = e.pack !== undefined && e.pack !== "" && Number(e.pack) !== r.pack_size;
    const ppChanged = e.pp !== undefined && e.pp !== "" && Number(e.pp) !== r.purchase_price;
    const mrpChanged = e.mrp !== undefined && e.mrp !== "" && Number(e.mrp) !== r.mrp;
    return packChanged || ppChanged || mrpChanged;
  };

  const buildPatch = (r: Row) => {
    const e = pending[r.variation_id] ?? {};
    const patch: { pack_size?: number; default_purchase_price?: number; mrp?: number; default_sell_price?: number } = {};
    if (e.pack !== undefined && e.pack !== "") patch['pack_size'] = Math.max(1, Number(e.pack) || 1);
    if (e.pp !== undefined && e.pp !== "") patch['default_purchase_price'] = Math.max(0, Number(e.pp) || 0);
    if (e.mrp !== undefined && e.mrp !== "") {
      const m = Math.max(0, Number(e.mrp) || 0);
      patch['mrp'] = m;
      patch['default_sell_price'] = m;
    }
    return patch;
  };

  const save = useMutation({
    mutationFn: async (row: Row) => {
      const patch = buildPatch(row);
      if (Object.keys(patch).length === 0) return { id: row.variation_id };
      const { error } = await supabase.from("variations").update(patch).eq("id", row.variation_id);
      if (error) throw error;
      return { id: row.variation_id };
    },
    onSuccess: ({ id }) => {
      setPending((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["quick-box-rows"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const saveAll = useMutation({
    mutationFn: async () => {
      const dirtyRows = rows.filter(isDirty);
      for (const r of dirtyRows) {
        const patch = buildPatch(r);
        if (Object.keys(patch).length === 0) continue;
        const { error } = await supabase.from("variations").update(patch).eq("id", r.variation_id);
        if (error) throw error;
      }
      return dirtyRows.length;
    },
    onSuccess: (n) => {
      setPending({});
      toast.success(`Saved ${n} update${n === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["quick-box-rows"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const inputCls = "w-full h-9 rounded-lg border border-border bg-input px-3 text-sm";
  const pendingCount = rows.filter(isDirty).length;
  const money = (n: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n || 0);

  const packVal = (r: Row) => pending[r.variation_id]?.pack ?? (r.pack_size > 1 ? String(r.pack_size) : "");
  const ppVal = (r: Row) => pending[r.variation_id]?.pp ?? (r.purchase_price > 0 ? String(r.purchase_price) : "");
  const mrpVal = (r: Row) => pending[r.variation_id]?.mrp ?? (r.mrp > 0 ? String(r.mrp) : "");

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">Quick Box Add</h1>
          <p className="text-sm text-muted-foreground">
            Search a product and set pieces per box, purchase price and MRP quickly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {rows.filter((r) => r.pack_size > 1).length} / {rows.length} added
            </span>
          )}
          <Button
            onClick={() => saveAll.mutate()}
            disabled={pendingCount === 0 || saveAll.isPending}
            size="sm"
          >
            <Save className="h-4 w-4 mr-1" />
            Save all {pendingCount > 0 ? `(${pendingCount})` : ""}
          </Button>
        </div>
      </div>

      <FloatingSearch spacer={52}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            className={`${inputCls} pl-9`}
            placeholder="Search product by name, SKU or variation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </FloatingSearch>

      {/* Mobile: card layout */}
      <div className="sm:hidden space-y-2">
        {isLoading ? (
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-8 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-8 text-center text-muted-foreground">No products</div>
        ) : (
          filtered.slice(0, 500).map((r) => {
            const dirty = isDirty(r);
            const added = r.pack_size > 1;
            return (
              <div
                key={r.variation_id}
                className={`rounded-xl border border-border/60 bg-card p-3 ${added ? "bg-emerald-500/5" : ""}`}
              >
                {/* Row 1: product info */}
                <div className="min-w-0">
                  <div className="font-medium leading-tight break-words">{r.product_name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {r.sku && <span className="font-mono">{r.sku}</span>}
                    {r.variation_name && <span>{r.variation_name}</span>}
                    {added ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 font-medium">
                        <Check className="h-3 w-3" />
                        {r.pack_size} pcs / box
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">Not set</span>
                    )}
                    <span>PP: {money(r.purchase_price)}</span>
                    <span>MRP: {money(r.mrp)}</span>
                  </div>
                </div>
                {/* Row 2: inputs */}
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="block text-[11px] text-muted-foreground mb-1">Pcs / box</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      className={inputCls}
                      placeholder="Pcs / box"
                      value={packVal(r)}
                      onChange={(e) => setField(r.variation_id, "pack", e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") save.mutate(r); }}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] text-muted-foreground mb-1">Purchase price</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      className={inputCls}
                      placeholder="0"
                      value={ppVal(r)}
                      onChange={(e) => setField(r.variation_id, "pp", e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") save.mutate(r); }}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] text-muted-foreground mb-1">MRP</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      className={inputCls}
                      placeholder="0"
                      value={mrpVal(r)}
                      onChange={(e) => setField(r.variation_id, "mrp", e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") save.mutate(r); }}
                    />
                  </label>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant={dirty ? "default" : "outline"}
                    disabled={!dirty || save.isPending}
                    onClick={() => save.mutate(r)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            );
          })
        )}
        {filtered.length > 500 && (
          <div className="px-1 py-2 text-xs text-muted-foreground">
            Showing first 500 of {filtered.length}. Refine your search to see more.
          </div>
        )}
      </div>

      <div className="hidden sm:block rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Product</th>
                <th className="text-left px-4 py-2">SKU</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2 w-32">Pcs / box</th>
                <th className="text-left px-4 py-2 w-36">Purchase price</th>
                <th className="text-left px-4 py-2 w-36">MRP</th>
                <th className="px-4 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No products</td></tr>
              ) : (
                filtered.slice(0, 500).map((r) => {
                  const dirty = isDirty(r);
                  const added = r.pack_size > 1;
                  return (
                    <tr key={r.variation_id} className={`border-t border-border/60 ${added ? "bg-emerald-500/5" : ""}`}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{r.product_name}</div>
                        {r.variation_name && (
                          <div className="text-xs text-muted-foreground">{r.variation_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{r.sku}</td>
                      <td className="px-4 py-2">
                        {added ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-xs font-medium">
                            <Check className="h-3.5 w-3.5" />
                            {r.pack_size} pcs / box
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs">
                            Not set
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className={inputCls}
                          value={packVal(r)}
                          onChange={(e) => setField(r.variation_id, "pack", e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") save.mutate(r); }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className={inputCls}
                          value={ppVal(r)}
                          onChange={(e) => setField(r.variation_id, "pp", e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") save.mutate(r); }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className={inputCls}
                          value={mrpVal(r)}
                          onChange={(e) => setField(r.variation_id, "mrp", e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") save.mutate(r); }}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          size="sm"
                          variant={dirty ? "default" : "outline"}
                          disabled={!dirty || save.isPending}
                          onClick={() => save.mutate(r)}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border/60">
            Showing first 500 of {filtered.length}. Refine your search to see more.
          </div>
        )}
      </div>
    </div>
  );
}
