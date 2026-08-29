import { FloatingSearch } from "@/components/floating-search";
import { createFileRoute } from "@tanstack/react-router";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { fetchAll } from "@/lib/fetch-all";
import { Button } from "@/components/ui/button";
import { Check, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { FoldTable } from "@/components/fold-table";

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
  /** pre-lowercased haystack so search does not lowercase 7k rows per keystroke */
  hay: string;
};

type Edit = { pack?: string; pp?: string; mrp?: string };

const PAGE = 40;

const inputCls = "w-full h-9 rounded-lg border border-border bg-input px-3 text-sm";
const money = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n || 0);

function rowIsDirty(r: Row, e: Edit | undefined) {
  if (!e) return false;
  const packChanged = e.pack !== undefined && e.pack !== "" && Number(e.pack) !== r.pack_size;
  const ppChanged = e.pp !== undefined && e.pp !== "" && Number(e.pp) !== r.purchase_price;
  const mrpChanged = e.mrp !== undefined && e.mrp !== "" && Number(e.mrp) !== r.mrp;
  return packChanged || ppChanged || mrpChanged;
}

const packVal = (r: Row, e?: Edit) => e?.pack ?? (r.pack_size > 1 ? String(r.pack_size) : "");
const ppVal = (r: Row, e?: Edit) => e?.pp ?? (r.purchase_price > 0 ? String(r.purchase_price) : "");
const mrpVal = (r: Row, e?: Edit) => e?.mrp ?? (r.mrp > 0 ? String(r.mrp) : "");

type RowProps = {
  r: Row;
  edit: Edit | undefined;
  saving: boolean;
  onField: (id: string, key: keyof Edit, value: string) => void;
  onSave: (r: Row) => void;
};

/** Memoised so typing in one row does not re-render the other hundreds. */
const MobileRow = memo(function MobileRow({ r, edit, saving, onField, onSave }: RowProps) {
  const dirty = rowIsDirty(r, edit);
  const added = r.pack_size > 1;
  const enter = (e: React.KeyboardEvent) => { if (e.key === "Enter") onSave(r); };
  return (
    <div className={`rounded-xl border border-border/60 bg-card p-3 ${added ? "bg-emerald-500/5" : ""}`}>
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
            value={packVal(r, edit)}
            onChange={(e) => onField(r.variation_id, "pack", e.target.value)}
            onKeyDown={enter}
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
            value={ppVal(r, edit)}
            onChange={(e) => onField(r.variation_id, "pp", e.target.value)}
            onKeyDown={enter}
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
            value={mrpVal(r, edit)}
            onChange={(e) => onField(r.variation_id, "mrp", e.target.value)}
            onKeyDown={enter}
          />
        </label>
      </div>
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || saving} onClick={() => onSave(r)}>
          Save
        </Button>
      </div>
    </div>
  );
});

const DesktopRow = memo(function DesktopRow({ r, edit, saving, onField, onSave }: RowProps) {
  const dirty = rowIsDirty(r, edit);
  const added = r.pack_size > 1;
  const enter = (e: React.KeyboardEvent) => { if (e.key === "Enter") onSave(r); };
  return (
    <tr className={`border-t border-border/60 ${added ? "bg-emerald-500/5" : ""}`}>
      <td className="px-4 py-2">
        <div className="font-medium">{r.product_name}</div>
        {r.variation_name && <div className="text-xs text-muted-foreground">{r.variation_name}</div>}
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
          value={packVal(r, edit)}
          onChange={(e) => onField(r.variation_id, "pack", e.target.value)}
          onKeyDown={enter}
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          min="0"
          step="any"
          className={inputCls}
          value={ppVal(r, edit)}
          onChange={(e) => onField(r.variation_id, "pp", e.target.value)}
          onKeyDown={enter}
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          min="0"
          step="any"
          className={inputCls}
          value={mrpVal(r, edit)}
          onChange={(e) => onField(r.variation_id, "mrp", e.target.value)}
          onKeyDown={enter}
        />
      </td>
      <td className="px-4 py-2 text-right">
        <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || saving} onClick={() => onSave(r)}>
          Save
        </Button>
      </td>
    </tr>
  );
});

function QuickBoxPage() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [limit, setLimit] = useState(PAGE);
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
    staleTime: 5 * 60_000,
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
          const variation_name = v.name && v.name !== "DUMMY" ? v.name : "";
          out.push({
            variation_id: v.id,
            product_id: p.id,
            product_name: p.name,
            sku: p.sku ?? "",
            variation_name,
            pack_size: Number(v.pack_size ?? 1),
            purchase_price: Number(v.default_purchase_price ?? 0),
            mrp: Number(v.mrp ?? 0),
            hay: `${p.name ?? ""} ${p.sku ?? ""} ${variation_name}`.toLowerCase(),
          });
        }
      }
      return out;
    },
  });

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.hay.includes(q));
  }, [rows, deferredSearch]);

  // Reset the window whenever the search text changes so we never render 7k rows.
  useEffect(() => { setLimit(PAGE); }, [deferredSearch]);

  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  const addedCount = useMemo(() => rows.reduce((n, r) => n + (r.pack_size > 1 ? 1 : 0), 0), [rows]);
  const dirtyRows = useMemo(() => rows.filter((r) => rowIsDirty(r, pending[r.variation_id])), [rows, pending]);
  const pendingCount = dirtyRows.length;

  const setField = useCallback((id: string, key: keyof Edit, value: string) => {
    setPending((p) => ({ ...p, [id]: { ...(p[id] ?? {}), [key]: value } }));
  }, []);

  const buildPatch = (r: Row) => {
    const e = pending[r.variation_id] ?? {};
    const patch: {
      pack_size?: number;
      default_purchase_price?: number;
      dpp_inc_tax?: number;
      mrp?: number;
      default_sell_price?: number;
      sell_price_inc_tax?: number;
      profit_percent?: number;
    } = {};
    if (e.pack !== undefined && e.pack !== "") patch['pack_size'] = Math.max(1, Number(e.pack) || 1);
    const pp = e.pp !== undefined && e.pp !== "" ? Math.max(0, Number(e.pp) || 0) : undefined;
    const m = e.mrp !== undefined && e.mrp !== "" ? Math.max(0, Number(e.mrp) || 0) : undefined;
    if (pp !== undefined) {
      patch['default_purchase_price'] = pp;
      patch['dpp_inc_tax'] = pp;
    }
    if (m !== undefined) {
      patch['mrp'] = m;
      patch['default_sell_price'] = m;
      patch['sell_price_inc_tax'] = m;
    }
    const finalPp = pp ?? r.purchase_price;
    const finalMrp = m ?? r.mrp;
    if (pp !== undefined || m !== undefined) {
      patch['profit_percent'] = finalPp > 0 ? ((finalMrp - finalPp) / finalPp) * 100 : 0;
    }
    return patch;
  };

  // Product-level mirror so the products list and reports show the same values.
  const productPatch = (patch: ReturnType<typeof buildPatch>) => {
    const out: { default_purchase_price?: number; default_sell_price?: number; mrp?: number } = {};
    if (patch.default_purchase_price !== undefined) out.default_purchase_price = patch.default_purchase_price;
    if (patch.default_sell_price !== undefined) out.default_sell_price = patch.default_sell_price;
    if (patch.mrp !== undefined) out.mrp = patch.mrp;
    return out;
  };

  const applyRow = async (r: Row) => {
    const patch = buildPatch(r);
    if (Object.keys(patch).length === 0) return;
    const { error } = await supabase.from("variations").update(patch).eq("id", r.variation_id);
    if (error) throw error;
    const pPatch = productPatch(patch);
    if (Object.keys(pPatch).length > 0) {
      const { error: pErr } = await supabase.from("products").update(pPatch).eq("id", r.product_id);
      if (pErr) throw pErr;
    }
  };

  const save = useMutation({
    mutationFn: async (row: Row) => {
      await applyRow(row);
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
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const saveAll = useMutation({
    mutationFn: async () => {
      for (const r of dirtyRows) await applyRow(r);
      return dirtyRows.length;
    },
    onSuccess: (n) => {
      setPending({});
      toast.success(`Saved ${n} update${n === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["quick-box-rows"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const onSaveRow = useCallback((r: Row) => save.mutate(r), [save]);

  const stale = deferredSearch !== search;

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
              {addedCount} / {rows.length} added
            </span>
          )}
          <Button onClick={() => saveAll.mutate()} disabled={pendingCount === 0 || saveAll.isPending} size="sm">
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
      <div className={`sm:hidden space-y-2 ${stale ? "opacity-60" : ""}`}>
        {isLoading ? (
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-8 text-center text-muted-foreground">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card px-4 py-8 text-center text-muted-foreground">No products</div>
        ) : (
          visible.map((r) => (
            <MobileRow
              key={r.variation_id}
              r={r}
              edit={pending[r.variation_id]}
              saving={save.isPending}
              onField={setField}
              onSave={onSaveRow}
            />
          ))
        )}
        {filtered.length > visible.length && (
          <div className="flex items-center justify-between gap-2 px-1 py-2 text-xs text-muted-foreground">
            <span>
              {visible.length} of {filtered.length}
            </span>
            <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
              Show more
            </Button>
          </div>
        )}
      </div>

      <div className={`hidden sm:block rounded-2xl border border-border/60 bg-card overflow-hidden ${stale ? "opacity-60" : ""}`}>
        <div className="overflow-x-auto">
          <FoldTable className="w-full text-sm min-w-[860px]">
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
              ) : visible.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No products</td></tr>
              ) : (
                visible.map((r) => (
                  <DesktopRow
                    key={r.variation_id}
                    r={r}
                    edit={pending[r.variation_id]}
                    saving={save.isPending}
                    onField={setField}
                    onSave={onSaveRow}
                  />
                ))
              )}
            </tbody>
          </FoldTable>
        </div>
        {filtered.length > visible.length && (
          <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs text-muted-foreground border-t border-border/60">
            <span>
              {visible.length} of {filtered.length}
            </span>
            <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
              Show more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
