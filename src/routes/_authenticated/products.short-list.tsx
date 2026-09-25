import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Search, X, ListPlus } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/products/short-list")({
  component: ShortListPage,
});

type PrintSize = "a4" | "80mm" | "58mm";

type Item = {
  id: string;
  name: string;
  packSize: number | null;
  qty: string; // blank until filled
  unit: "pcs" | "box";
};

const MAX_ITEMS = 20;

function ShortListPage() {
  const { data: business } = useCurrentBusiness();
  const [size, setSize] = useState<PrintSize>("a4");
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [title, setTitle] = useState("Short Product List");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const qtyRefs = useRef(new Map<string, HTMLInputElement>());
  const unitRefs = useRef(new Map<string, HTMLButtonElement>());
  const [focusQtyId, setFocusQtyId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusQtyId) return;
    qtyRefs.current.get(focusQtyId)?.focus();
    setFocusQtyId(null);
  }, [focusQtyId, items]);

  const onSearch = (v: string) => {
    setSearch(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(v.trim()), 250);
  };

  const { data: results, isFetching } = useQuery({
    queryKey: ["short-list-search", business?.id, debounced],
    enabled: !!business && debounced.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, variations(pack_size)")
        .eq("business_id", business!.id)
        .eq("is_inactive", false)
        .ilike("name", `%${debounced}%`)
        .order("name", { ascending: true })
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const picked = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const suggestions = (results ?? []).filter((p: any) => !picked.has(p.id));

  function addProduct(p: any) {
    if (items.length >= MAX_ITEMS) return;
    const pack = p.variations?.[0]?.pack_size;
    const packSize = pack && Number(pack) > 1 ? Number(pack) : null;
    setItems((s) => [
      ...s,
      { id: p.id, name: p.name, packSize, qty: "", unit: packSize ? "box" : "pcs" },
    ]);
    setSearch("");
    setDebounced("");
  }

  function update(id: string, patch: Partial<Item>) {
    setItems((s) => s.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function remove(id: string) {
    setItems((s) => s.filter((i) => i.id !== id));
  }

  function qtyLabel(i: Item) {
    const q = i.qty.trim();
    if (!q) return "";
    if (i.unit === "box" && i.packSize) return `${q} box (${Number(q) * i.packSize} pcs)`;
    return `${q} ${i.unit}`;
  }

  function doPrint() {
    printShortList(
      items.filter((i) => i.qty.trim()).map((i) => ({ name: i.name, qty: qtyLabel(i) })),
      size,
      business?.name ?? "",
      title.trim() || "Short Product List",
      date
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/products">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <h2 className="font-display text-lg font-semibold">Short Product List</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as PrintSize)}
            className="h-9 rounded-md border border-border bg-input px-2 text-sm"
          >
            <option value="a4">A4</option>
            <option value="80mm">POS 80mm</option>
            <option value="58mm">POS 58mm</option>
          </select>
          <Button size="sm" onClick={doPrint} disabled={!items.some((i) => i.qty.trim())}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        </div>
      </div>

      {/* Slip title + date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Slip Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            className="mt-1 h-9 w-full rounded-md border border-border bg-input px-3 text-sm"
            placeholder="Short Product List"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-border bg-input px-3 text-sm"
          />
        </div>
      </div>

      {/* Floating search bar */}
      <div className="sticky top-2 z-30 relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={
              items.length >= MAX_ITEMS
                ? `Maximum ${MAX_ITEMS} items added — remove one to add more`
                : "Search product name to add…"
            }
            disabled={items.length >= MAX_ITEMS}
            className="w-full h-11 rounded-full border border-border bg-input pl-11 pr-4 text-sm shadow-lg focus:outline-none disabled:opacity-60"
          />
        </div>
        {debounced.length >= 2 && items.length < MAX_ITEMS && (
          <div className="absolute z-20 mt-1 w-full rounded-2xl border border-border bg-popover shadow-xl max-h-64 overflow-auto">
            {isFetching ? (
              <div className="p-3 text-sm text-muted-foreground">Searching…</div>
            ) : suggestions.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No product found</div>
            ) : (
              suggestions.map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-2"
                >
                  <ListPlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{p.name}</span>
                  {p.sku && (
                    <span className="ml-auto text-xs text-muted-foreground font-mono">{p.sku}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        সার্চ করে প্রোডাক্ট যোগ করুন — {items.length}/{MAX_ITEMS} যোগ হয়েছে। প্রতিটিতে কত লাগবে লিখুন এবং box/pcs বেছে নিন।
        {items.length >= MAX_ITEMS && (
          <span className="block mt-1 text-destructive font-medium">
            সর্বোচ্চ {MAX_ITEMS}টি যোগ হয়ে গেছে — নতুন যোগ করতে হলে কোনো একটা মুছে ফেলুন।
          </span>
        )}
      </p>

      {/* Items */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium w-10">#</th>
              <th className="text-left px-4 py-3 font-medium">Product</th>
              <th className="text-right px-4 py-3 font-medium">Demand</th>
              <th className="text-left px-4 py-3 font-medium w-28">Unit</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-muted-foreground">
                  <ListPlus className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  উপরের সার্চ বার থেকে প্রোডাক্ট যোগ করুন।
                </td>
              </tr>
            ) : (
              items.map((it, idx) => (
                <tr key={it.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{it.name}</td>
                  <td className="px-4 py-2.5 text-right">
                    <input
                      type="number"
                      min={0}
                      value={it.qty}
                      onChange={(e) => update(it.id, { qty: e.target.value })}
                      placeholder="0"
                      className="h-8 w-24 rounded-md border border-border bg-input px-2 text-right text-sm tabular-nums"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="inline-flex overflow-hidden rounded-md border border-border">
                      <button
                        type="button"
                        onClick={() => update(it.id, { unit: "pcs" })}
                        className={`h-8 px-3 text-xs font-medium transition-colors ${
                          it.unit === "pcs"
                            ? "bg-primary text-primary-foreground"
                            : "bg-input text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        pcs
                      </button>
                      <button
                        type="button"
                        onClick={() => update(it.id, { unit: "box" })}
                        className={`h-8 px-3 text-xs font-medium transition-colors ${
                          it.unit === "box"
                            ? "bg-primary text-primary-foreground"
                            : "bg-input text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        box{it.packSize ? ` (${it.packSize} pcs)` : ""}
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => remove(it.id)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function printShortList(
  items: { name: string; qty: string }[],
  size: PrintSize,
  businessName: string,
  title: string,
  date: string
) {
  const printId = "short-list-print-page";
  const styleId = "short-list-print-style";
  const pageSize = size === "a4" ? "A4" : size === "80mm" ? "80mm auto" : "58mm auto";
  const margin = size === "a4" ? "12mm" : "3mm 2mm";
  const fontSize = size === "a4" ? "12px" : size === "80mm" ? "11px" : "10px";

  document.getElementById(printId)?.remove();
  document.getElementById(styleId)?.remove();

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @page { size: ${pageSize}; margin: ${margin}; }
    @media print {
      :root, html, body, #root { color-scheme: only light !important; background: #fff !important; color: #000 !important; }
      body > *:not(#${printId}) { display: none !important; visibility: hidden !important; }
      #${printId}, #${printId} * {
        visibility: visible !important; color: #000 !important; background: #fff !important;
        box-shadow: none !important; text-shadow: none !important; border-color: #000 !important;
        box-sizing: border-box !important; overflow-wrap: anywhere !important;
      }
      #${printId} { display: block !important; position: static !important; width: 100% !important; }
      #${printId} .center { text-align: center !important; }
      #${printId} .bold { font-weight: 700 !important; }
      #${printId} .muted { font-size: 0.9em !important; }
      #${printId} .sep { border-top: 1px dashed #000 !important; margin: 5px 0 !important; }
      #${printId} table { width: 100% !important; border-collapse: collapse !important; }
      #${printId} th, #${printId} td { padding: 3px 2px !important; border-bottom: 1px solid #000 !important; vertical-align: top !important; }
      #${printId} th { font-weight: 700 !important; text-align: left !important; }
      #${printId} .right { text-align: right !important; }
      #${printId} tr { page-break-inside: avoid !important; }
    }
  `;

  const esc = (s: string) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

  const rows = items
    .map(
      (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(it.name)}</td>
        <td class="right bold">${esc(it.qty)}</td>
      </tr>`
    )
    .join("");

  const printPage = document.createElement("div");
  printPage.id = printId;
  printPage.innerHTML = `
    ${businessName ? `<div class="center bold" style="font-size:1.15em">${esc(businessName)}</div>` : ""}
    <div class="center bold">${esc(title)}</div>
    <div class="center muted">${esc(formatDate(date))}</div>
    <div class="sep"></div>
    <table>
      <thead><tr><th style="width:24px">#</th><th>Product</th><th class="right">Qty</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sep"></div>
    <div class="muted">Total items: ${items.length}</div>
  `;
  printPage.style.cssText = `position:fixed;left:0;top:0;z-index:-1;opacity:0;pointer-events:none;width:${
    size === "a4" ? "210mm" : size === "80mm" ? "80mm" : "58mm"
  };background:#fff;color:#000;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:${fontSize};line-height:1.35;`;

  document.head.appendChild(style);
  document.body.appendChild(printPage);

  const cleanup = () => {
    printPage.remove();
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  import("@/lib/print-preview").then(({ showPrintPreview }) => {
    showPrintPreview({ printPage, cleanup, filename: `short-list-${Date.now()}` });
  });
}
