import { FloatingSearch } from "@/components/floating-search";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Pencil, Trash2, Plus, Package, Upload, Search, ScanLine, Check, QrCode } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { printSkuQr } from "@/lib/sku-qr-print";

export const Route = createFileRoute("/_authenticated/products/")({
  component: ProductsList,
});

const PAGE_SIZE = 100;

function ProductsList() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [qrWidth, setQrWidth] = useState<"58" | "80">("80");
  const [qrCopies, setQrCopies] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["products", business?.id, search],
    enabled: !!business,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      let q = supabase
        .from("products")
        .select("id, name, sku, barcode, type, is_inactive, enable_stock, image, default_purchase_price, default_sell_price, mrp, category:categories!products_category_id_fkey(name), brand:brands(name), unit:units(short_name), variations(variation_location_details(qty_available))")
        .eq("business_id", business!.id);
      if (search) {
        const esc = search.replace(/[%,()]/g, " ");
        q = q.or(`name.ilike.%${esc}%,sku.ilike.%${esc}%`);
      }
      const { data, error } = await q
        .order("name", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length,
  });

  const rows = (data?.pages ?? []).flat();

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);


  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [barcodeEdits, setBarcodeEdits] = useState<Record<string, string>>({});
  const [scanForId, setScanForId] = useState<string | null>(null);
  const saveBarcode = useMutation({
    mutationFn: async ({ id, barcode }: { id: string; barcode: string }) => {
      const val = barcode.trim() || null;
      const { error: e1 } = await supabase.from("products").update({ barcode: val }).eq("id", id);
      if (e1) throw e1;
      // also mirror to the single/default variation for scanner matching
      await supabase.from("variations").update({ barcode: val }).eq("product_id", id).eq("name", "DUMMY");
    },
    onSuccess: (_d, v) => {
      toast.success("Barcode saved");
      setBarcodeEdits((s) => { const n = { ...s }; delete n[v.id]; return n; });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, ok: 0, fail: 0, total: 0 });

  function parseCsv(text: string): Record<string, string>[] {
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    const parseLine = (line: string) => {
      const out: string[] = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQ) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (c === '"') inQ = false;
          else cur += c;
        } else {
          if (c === '"') inQ = true;
          else if (c === ",") { out.push(cur); cur = ""; }
          else cur += c;
        }
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
    return lines.slice(1).map((l) => {
      const cells = parseLine(l);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
      return row;
    });
  }

  async function handleCsvUpload(file: File) {
    if (!business) return;
    setImporting(true);
    setProgress({ done: 0, ok: 0, fail: 0, total: 0 });
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) { toast.error("CSV is empty"); return; }
      setProgress({ done: 0, ok: 0, fail: 0, total: rows.length });

      // Preload ALL brands & categories (paginate past the 1000-row default cap)
      async function fetchAll(table: "brands" | "categories") {
        const all: { id: string; name: string }[] = [];
        const PAGE = 1000;
        for (let i = 0; ; i++) {
          const { data, error } = await supabase
            .from(table)
            .select("id, name")
            .eq("business_id", business!.id)
            .range(i * PAGE, i * PAGE + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...(data as any));
          if (data.length < PAGE) break;
        }
        return all;
      }
      const [brands, cats, { data: locs = [] }] = await Promise.all([
        fetchAll("brands"),
        fetchAll("categories"),
        supabase.from("business_locations").select("id").eq("business_id", business.id).order("created_at", { ascending: true }).limit(1),
      ]);
      const brandMap = new Map(brands.map((b: any) => [b.name.toLowerCase(), b.id]));
      const catMap = new Map(cats.map((c: any) => [c.name.toLowerCase(), c.id]));
      const locationId = (locs ?? [])[0]?.id ?? null;

      async function getBrandId(name: string) {
        if (!name) return null;
        const k = name.toLowerCase();
        if (brandMap.has(k)) return brandMap.get(k)!;
        const { data, error } = await supabase
          .from("brands")
          .insert({ business_id: business!.id, name })
          .select("id")
          .single();
        if (error) throw error;
        brandMap.set(k, data.id);
        return data.id;
      }
      async function getCategoryId(name: string) {
        if (!name) return null;
        const k = name.toLowerCase();
        if (catMap.has(k)) return catMap.get(k)!;
        const { data, error } = await supabase
          .from("categories")
          .insert({ business_id: business!.id, name })
          .select("id")
          .single();
        if (error) throw error;
        catMap.set(k, data.id);
        return data.id;
      }




      // Preload all existing SKUs for this business so we can skip duplicates
      async function fetchAllSkus() {
        const set = new Set<string>();
        const PAGE = 1000;
        for (let i = 0; ; i++) {
          const { data, error } = await supabase
            .from("products")
            .select("sku")
            .eq("business_id", business!.id)
            .range(i * PAGE, i * PAGE + PAGE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          for (const p of data) if (p.sku) set.add(String(p.sku).trim().toLowerCase());
          if (data.length < PAGE) break;
        }
        return set;
      }
      const skuSet = await fetchAllSkus();

      let ok = 0, fail = 0, skipped = 0;
      for (const r of rows) {
        try {
          const name = r.name || r.product_name;
          const sku = r.sku;
          if (!name || !sku) { fail++; continue; }
          const skuKey = String(sku).trim().toLowerCase();
          if (skuSet.has(skuKey)) { skipped++; continue; }
          const type = (r.type || "single").toLowerCase() === "variable" ? "variable" : "single";
          const brand_id = await getBrandId(r.brand || "");
          const category_id = await getCategoryId(r.category || r.catagory || "");
          const purchase = Number(r.purchase_price || r.purchase || 0);
          const mrp = Number(r.mrp || 0);
          const stock = Number(r.stock || 0);

          const { data: prod, error: pErr } = await supabase.from("products").insert({
            business_id: business.id,
            name, sku, type,
            brand_id, category_id,
            enable_stock: true,
            default_purchase_price: purchase,
            default_sell_price: mrp,
            mrp,
          }).select("id").single();
          if (pErr) throw pErr;

          const { data: variation, error: vErr } = await supabase.from("variations").insert({
            product_id: prod.id,
            name: "DUMMY",
            sub_sku: sku,
            default_purchase_price: purchase,
            dpp_inc_tax: purchase,
            default_sell_price: mrp,
            sell_price_inc_tax: mrp,
            mrp,
            profit_percent: purchase > 0 ? ((mrp - purchase) / purchase) * 100 : 0,
          }).select("id").single();
          if (vErr) throw vErr;

          if (stock > 0 && locationId) {
            await supabase.from("variation_location_details").insert({
              product_id: prod.id,
              variation_id: variation.id,
              location_id: locationId,
              qty_available: stock,
            });
          }
          skuSet.add(skuKey);
          ok++;
        } catch (e: any) {
          console.error("Row import failed", r, e);
          fail++;
        }
        setProgress({ done: ok + fail + skipped, ok, fail, total: rows.length });
      }
      toast.success(
        `Imported ${ok}${skipped ? `, ${skipped} duplicate(s) skipped` : ""}${fail ? `, ${fail} failed` : ""}`
      );
      qc.invalidateQueries({ queryKey: ["products"] });

    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function downloadTemplate() {
    const csv = "name,sku,type,category,brand,purchase_price,mrp,stock\nSample Product,SKU001,single,General,Acme,50,100,10\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "products-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display text-lg font-semibold">All Products</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <FloatingSearch spacer={40} className="max-w-[calc(100vw-24px)]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name or SKU…"
                className="h-9 w-full rounded-lg border border-border bg-input pl-8 pr-3 text-sm"
              />
            </div>
          </FloatingSearch>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs">
            <QrCode className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">QR</span>
            <select value={qrWidth} onChange={(e) => setQrWidth(e.target.value as "58" | "80")} className="bg-transparent outline-none">
              <option value="58">58mm</option>
              <option value="80">80mm</option>
            </select>
            <span className="text-muted-foreground">×</span>
            <input type="number" min={1} max={50} value={qrCopies}
              onChange={(e) => setQrCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="w-10 bg-transparent outline-none text-center" />
          </div>
          <button onClick={downloadTemplate} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Download template
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f); }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" /> {importing ? "Importing…" : "Import CSV"}
          </button>
          <Link to="/products/new" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Add Product
          </Link>
        </div>
      </div>

      {(importing || progress.done > 0) && progress.total > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">
              Importing… {progress.done} / {progress.total}
            </span>
            <span className="text-muted-foreground">
              {progress.ok} ok{progress.fail ? ` · ${progress.fail} failed` : ""} ·{" "}
              {Math.round((progress.done / progress.total) * 100)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}




      <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Product</th>
              <th className="text-left px-4 py-3 font-medium">SKU</th>
              <th className="text-left px-4 py-3 font-medium">Barcode</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Brand</th>
              <th className="text-right px-4 py-3 font-medium">Purchase</th>
              <th className="text-right px-4 py-3 font-medium">MRP</th>
              <th className="text-right px-4 py-3 font-medium">Stock</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading ? (
              <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={11} className="p-12 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                No products yet. <Link to="/products/new" className="text-primary hover:underline">Add your first product</Link>.
              </td></tr>
            ) : rows.map((row: any) => {
              const stock = (row.variations ?? []).reduce((s: number, v: any) =>
                s + (v.variation_location_details ?? []).reduce((ss: number, d: any) => ss + Number(d.qty_available ?? 0), 0), 0);
              const editVal = barcodeEdits[row.id];
              const currentVal = editVal !== undefined ? editVal : (row.barcode ?? "");
              const dirty = editVal !== undefined && editVal !== (row.barcode ?? "");
              return (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.sku}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <input
                      value={currentVal}
                      onChange={(e) => setBarcodeEdits((s) => ({ ...s, [row.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter" && dirty) saveBarcode.mutate({ id: row.id, barcode: currentVal }); }}
                      placeholder="—"
                      className="h-7 w-32 rounded border border-border bg-input px-2 text-xs font-mono"
                    />
                    <button type="button" onClick={() => setScanForId(row.id)} title="Scan"
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground">
                      <ScanLine className="h-3.5 w-3.5" />
                    </button>
                    {dirty && (
                      <button type="button" onClick={() => saveBarcode.mutate({ id: row.id, barcode: currentVal })} title="Save"
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-emerald-600 hover:bg-emerald-500/10">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 capitalize">{row.type}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.category?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.brand?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{Number(row.default_purchase_price ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{Number(row.mrp ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.enable_stock ? stock : "—"}{row.unit?.short_name ? ` ${row.unit.short_name}` : ""}</td>
                <td className="px-4 py-3">
                  {row.is_inactive
                    ? <span className="text-xs rounded-full bg-muted px-2 py-0.5">Inactive</span>
                    : <span className="text-xs rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5">Active</span>}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => printSkuQr({ sku: row.sku, name: row.name, price: Number(row.mrp || row.default_sell_price || 0), width: qrWidth, copies: qrCopies })}
                    title={`Print QR ${qrWidth}mm × ${qrCopies}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                  </button>
                  <Link to="/products/$id" params={{ id: row.id }} className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                  <button onClick={() => { if (confirm("Delete this product?")) del.mutate(row.id); }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
        <div ref={sentinelRef} className="h-8" />
        {isFetchingNextPage && (
          <div className="p-3 text-center text-xs text-muted-foreground">Loading more…</div>
        )}
      </div>

      <BarcodeScanner
        open={scanForId !== null}
        onClose={() => setScanForId(null)}
        onDetected={(code) => {
          const c = code.trim();
          const id = scanForId;
          setScanForId(null);
          if (!id) return;
          setBarcodeEdits((s) => ({ ...s, [id]: c }));
          saveBarcode.mutate({ id, barcode: c });
        }}
      />
    </div>
  );
}
