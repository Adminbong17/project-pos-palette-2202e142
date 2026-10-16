import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Search, X, ListPlus, Save, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { isSheikhPharma, getSheikhPharmaHeaderHtml, getSheikhPharmaFooterHtml } from "@/lib/sheikh-pharma-letterhead";

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
  const [highlight, setHighlight] = useState(0);
  const queryClient = useQueryClient();
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedSearch, setSavedSearch] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const DEFAULT_FONT: Record<PrintSize, number> = { a4: 12, "80mm": 9, "58mm": 8 };
  const [fontPx, setFontPx] = useState<number>(DEFAULT_FONT.a4);
  useEffect(() => {
    const saved = Number(localStorage.getItem(`short-list-font-${size}`));
    setFontPx(saved >= 6 && saved <= 14 ? saved : DEFAULT_FONT[size]);
  }, [size]);
  const changeSize = (s: PrintSize) => setSize(s);
  const changeFont = (n: number) => {
    setFontPx(n);
    localStorage.setItem(`short-list-font-${size}`, String(n));
  };

  useEffect(() => {
    if (!focusQtyId) return;
    qtyRefs.current.get(focusQtyId)?.focus();
    setFocusQtyId(null);
  }, [focusQtyId, items]);

  const onSearch = (v: string) => {
    setSearch(v);
    setHighlight(0);
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
    setHighlight(0);
    setFocusQtyId(p.id);
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
    if (i.unit === "box") return `${q} box`;
    return `${q} ${i.unit}`;
  }

  const { data: savedLists } = useQuery({
    queryKey: ["short-lists", business?.id],
    enabled: !!business && savedOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("short_lists")
        .select("id, title, list_date, items, created_at")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredSaved = useMemo(() => {
    const q = savedSearch.trim().toLowerCase();
    const rows = savedLists ?? [];
    if (!q) return rows;
    return rows.filter((r: any) => {
      if ((r.title ?? "").toLowerCase().includes(q)) return true;
      if ((r.list_date ?? "").includes(q)) return true;
      return (r.items ?? []).some((i: any) => (i.name ?? "").toLowerCase().includes(q));
    });
  }, [savedLists, savedSearch]);

  async function saveList() {
    if (!business) return;
    const rows = items.filter((i) => i.qty.trim());
    if (!rows.length) {
      toast.error("অন্তত একটি প্রোডাক্টে পরিমাণ লিখুন");
      return;
    }
    setSaving(true);
    const payload = {
      business_id: business.id,
      title: title.trim() || "Short Product List",
      list_date: date,
      items: rows.map((i) => ({ id: i.id, name: i.name, packSize: i.packSize, qty: i.qty, unit: i.unit })),
    };
    const res = currentId
      ? await supabase.from("short_lists").update(payload).eq("id", currentId).select("id").single()
      : await supabase.from("short_lists").insert(payload).select("id").single();
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    setCurrentId(res.data.id);
    queryClient.invalidateQueries({ queryKey: ["short-lists"] });
    toast.success(currentId ? "লিস্ট আপডেট হয়েছে" : "লিস্ট সেভ হয়েছে");
  }

  function loadList(row: any) {
    setCurrentId(row.id);
    setTitle(row.title ?? "Short Product List");
    setDate(row.list_date ?? date);
    setItems(
      (row.items ?? []).map((i: any) => ({
        id: i.id,
        name: i.name,
        packSize: i.packSize ?? null,
        qty: String(i.qty ?? ""),
        unit: i.unit === "box" ? "box" : "pcs",
      }))
    );
    setSavedOpen(false);
  }

  async function deleteList(id: string) {
    const { error } = await supabase.from("short_lists").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (currentId === id) setCurrentId(null);
    queryClient.invalidateQueries({ queryKey: ["short-lists"] });
    toast.success("মুছে ফেলা হয়েছে");
  }

  function newList() {
    setCurrentId(null);
    setItems([]);
    setTitle("Short Product List");
  }

  function doPrint() {
    printShortList(
      items.filter((i) => i.qty.trim()).map((i) => ({ name: i.name, qty: qtyLabel(i) })),
      size,
      business?.name ?? "",
      title.trim() || "Short Product List",
      date,
      fontPx
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
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={size}
            onChange={(e) => changeSize(e.target.value as PrintSize)}
            className="h-9 rounded-md border border-border bg-input px-2 text-sm"
          >
            <option value="a4">A4</option>
            <option value="80mm">POS 80mm</option>
            <option value="58mm">POS 58mm</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            Font
            <select
              value={fontPx}
              onChange={(e) => changeFont(Number(e.target.value))}
              className="h-9 rounded-md border border-border bg-input px-2 text-sm text-foreground"
            >
              {[6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => (
                <option key={n} value={n}>
                  {n}px
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="outline" onClick={() => setSavedOpen((v) => !v)}>
            <FolderOpen className="h-4 w-4 mr-1" />
            Saved Lists
          </Button>
          <Button size="sm" variant="outline" onClick={newList}>
            New
          </Button>
          <Button size="sm" variant="secondary" onClick={saveList} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {currentId ? "Update" : "Save"}
          </Button>
          <Button size="sm" onClick={doPrint} disabled={!items.some((i) => i.qty.trim())}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        </div>
      </div>

      {savedOpen && (
        <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={savedSearch}
              onChange={(e) => setSavedSearch(e.target.value)}
              placeholder="সেভ করা লিস্ট খুঁজুন (নাম / তারিখ / প্রোডাক্ট)…"
              className="w-full h-9 rounded-full border border-border bg-input pl-9 pr-3 text-sm"
            />
          </div>
          <div className="max-h-72 overflow-auto divide-y divide-border/60">
            {filteredSaved.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">কোনো সেভ করা লিস্ট নেই।</div>
            ) : (
              filteredSaved.map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 py-2">
                  <button
                    type="button"
                    onClick={() => loadList(r)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(r.list_date)} • {(r.items ?? []).length} items
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteList(r.id)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
            ref={searchRef}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => (suggestions.length ? (h + 1) % suggestions.length : 0));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) =>
                  suggestions.length ? (h - 1 + suggestions.length) % suggestions.length : 0
                );
              } else if (e.key === "Enter") {
                e.preventDefault();
                const pick = suggestions[highlight] ?? suggestions[0];
                if (pick) addProduct(pick);
              } else if (e.key === "Escape") {
                setSearch("");
                setDebounced("");
              }
            }}
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
              suggestions.map((p: any, idx: number) => (
                <button
                  key={p.id}
                  type="button"
                  ref={(el) => {
                    if (idx === highlight && el) {
                      el.scrollIntoView({ block: "nearest" });
                    }
                  }}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => addProduct(p)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                    idx === highlight ? "bg-primary/15" : "hover:bg-muted/50"
                  }`}
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
                      ref={(el) => {
                        if (el) qtyRefs.current.set(it.id, el);
                        else qtyRefs.current.delete(it.id);
                      }}
                      type="number"
                      min={0}
                      value={it.qty}
                      onChange={(e) => update(it.id, { qty: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          unitRefs.current.get(it.id)?.focus();
                        }
                      }}
                      placeholder="0"
                      className="h-8 w-24 rounded-md border border-border bg-input px-2 text-right text-sm tabular-nums"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div
                      className="inline-flex overflow-hidden rounded-md border border-border"
                      onKeyDown={(e) => {
                        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                          e.preventDefault();
                          update(it.id, { unit: it.unit === "pcs" ? "box" : "pcs" });
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          searchRef.current?.focus();
                        }
                      }}
                    >
                      <button
                        ref={(el) => {
                          if (el) unitRefs.current.set(it.id, el);
                          else unitRefs.current.delete(it.id);
                        }}
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
                        box
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
  date: string,
  fontPx: number
) {
  const printId = "short-list-print-page";
  const styleId = "short-list-print-style";
  const pageSize = size === "a4" ? "A4" : size === "80mm" ? "80mm auto" : "58mm auto";
  const margin = size === "a4" ? "12mm" : "2mm 1.5mm";
  const fontSize = `${fontPx}px`;

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
      #${printId} .sep { border-top: 1px dashed #000 !important; margin: ${size === "a4" ? "5px" : "2px"} 0 !important; }
      #${printId} table { width: 100% !important; border-collapse: collapse !important; }
      #${printId} th, #${printId} td { padding: ${size === "a4" ? "3px 2px" : "1px 1px"} !important; border-bottom: ${size === "a4" ? "1px solid" : "1px dotted"} #000 !important; vertical-align: top !important; }
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

  const useLetterhead = size === "a4" && isSheikhPharma(businessName);
  const printPage = document.createElement("div");
  printPage.id = printId;

  const tableContent = `
    <table>
      <thead><tr><th style="width:${size === "a4" ? "24px" : "14px"}">#</th><th>Product</th><th class="right">Qty</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sep"></div>
    <div class="muted">Total items: ${items.length}</div>
  `;

  if (useLetterhead) {
    printPage.innerHTML = `
      <div style="display:flex; flex-direction:column; justify-content:space-between; min-height:265mm;">
        <div>
          ${getSheikhPharmaHeaderHtml({ title: esc(title), metaRight: `Date: ${esc(formatDate(date))}` })}
          <div style="margin-top:10px;">
            ${tableContent}
          </div>
        </div>
        ${getSheikhPharmaFooterHtml()}
      </div>
    `;
  } else {
    printPage.innerHTML = `
      ${businessName ? `<div class="center bold" style="font-size:1.15em">${esc(businessName)}</div>` : ""}
      <div class="center bold">${esc(title)}</div>
      <div class="center muted">${esc(formatDate(date))}</div>
      <div class="sep"></div>
      ${tableContent}
    `;
  }
  printPage.style.cssText = `position:fixed;left:0;top:0;z-index:-1;opacity:0;pointer-events:none;width:${
    size === "a4" ? "210mm" : size === "80mm" ? "80mm" : "58mm"
  };background:#fff;color:#000;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:${fontSize};line-height:${size === "a4" ? "1.35" : "1.15"};`;

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
