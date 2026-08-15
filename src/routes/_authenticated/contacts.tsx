import { FloatingSearch } from "@/components/floating-search";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";

import { toast } from "sonner";
import { Pencil, Trash2, Plus, X, Search, Wallet, Printer } from "lucide-react";

function fmtDate(d: string) {
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()}`;
}
function money(n: number) {
  return Number(n || 0).toFixed(2);
}

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({ meta: [{ title: "Contacts — QweekPOS" }] }),
  component: ContactsPage,
});

type ContactType = "customer" | "supplier" | "both";
type Contact = {
  id: string;
  business_id: string;
  type: ContactType;
  name: string;
  supplier_business_name: string | null;
  mobile: string | null;
  email: string | null;
  address_line_1: string | null;
  city: string | null;
  opening_balance: number;
  is_active: boolean;
};

const emptyForm = {
  type: "customer" as ContactType,
  name: "",
  supplier_business_name: "",
  mobile: "",
  email: "",
  address_line_1: "",
  city: "",
  opening_balance: 0,
};

type LedgerSize = "A4" | "80mm" | "58mm";

function printLedger(
  c: Contact,
  business: any,
  totals: { opening: number; sell: number; sellPaid: number; purchase: number; purchasePaid: number; netDue: number },
  rows: any[],
  size: LedgerSize = "A4",
) {
  const bizName = business?.name ?? "QweekPOS";
  const addr = [business?.address_line_1, business?.city, business?.state].filter(Boolean).join(", ");
  const today = fmtDate(new Date().toISOString());
  const rowsHtml = rows.map((r) => {
    const total = Number(r.final_total ?? 0);
    const paid = Number(r.total_paid ?? 0);
    return `<tr>
      <td>${fmtDate(r.transaction_date)}</td>
      <td style="text-transform:capitalize">${r.type}</td>
      <td>${r.invoice_no ?? r.ref_no ?? "—"}</td>
      <td style="text-transform:capitalize">${r.payment_status}</td>
      <td class="r">${money(total)}</td>
      <td class="r">${money(paid)}</td>
      <td class="r">${money(total - paid)}</td>
    </tr>`;
  }).join("");
  const netLabel = totals.netDue > 0 ? "Receivable" : totals.netDue < 0 ? "Payable" : "Settled";
  const bodyHtml = `
    <div class="head">
      <h1>${bizName}</h1>
      ${addr ? `<div>${addr}</div>` : ""}
      <h2>Customer / Supplier Ledger</h2>
    </div>
    <div class="meta">
      <div><b>${c.name}</b>${c.supplier_business_name ? ` (${c.supplier_business_name})` : ""}<br/>
        Type: ${c.type}${c.mobile ? `<br/>Mobile: ${c.mobile}` : ""}${c.email ? `<br/>Email: ${c.email}` : ""}
      </div>
      <div>Date: ${today}</div>
    </div>
    <div class="grid">
      <div class="box">Opening<br/><b>${money(totals.opening)}</b></div>
      <div class="box">Total Sales<br/><b>${money(totals.sell)}</b></div>
      <div class="box">Total Purchases<br/><b>${money(totals.purchase)}</b></div>
      <div class="box">Total Paid<br/><b>${money(totals.sellPaid + totals.purchasePaid)}</b></div>
      <div class="box">Net ${netLabel}<br/><span class="tot">${money(Math.abs(totals.netDue))}</span></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Invoice/Ref</th><th>Status</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Due</th></tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="7" style="text-align:center">No transactions</td></tr>`}</tbody>
    </table>`;

  const printId = "ledger-print-page";
  const styleId = "ledger-print-style";
  document.getElementById(printId)?.remove();
  document.getElementById(styleId)?.remove();

  const style = document.createElement("style");
  style.id = styleId;
  const pageSize = size === "A4" ? "A4" : size === "80mm" ? "80mm auto" : "58mm auto";
  const pageMargin = size === "A4" ? "10mm" : "3mm 2mm";
  const width = size === "A4" ? "210mm" : size === "80mm" ? "80mm" : "58mm";
  const fontSize = size === "A4" ? "12px" : size === "80mm" ? "11px" : "10px";
  const gridCols = size === "A4" ? "repeat(5,1fr)" : "repeat(2,1fr)";
  style.textContent = `
    #${printId} { font-family: Arial, sans-serif; color: #000; background: #fff; padding: ${size === "A4" ? "20px" : "6px"}; font-size: ${fontSize}; width: ${width}; max-width: 100%; box-sizing: border-box; }
    #${printId} *{ box-sizing: border-box; }
    #${printId} h1{font-size:${size === "A4" ? "18px" : "14px"};margin:0}
    #${printId} h2{font-size:${size === "A4" ? "14px" : "12px"};margin:8px 0 4px}
    #${printId} .head{text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px}
    #${printId} .meta{display:flex;justify-content:space-between;gap:6px;margin-bottom:10px;flex-wrap:wrap}
    #${printId} .box{border:1px solid #000;padding:6px 8px}
    #${printId} .grid{display:grid;grid-template-columns:${gridCols};gap:6px;margin:10px 0}
    #${printId} table{width:100%;border-collapse:collapse;margin-top:8px}
    #${printId} th,#${printId} td{border:1px solid #000;padding:${size === "A4" ? "5px 6px" : "3px 4px"};text-align:left;color:#000;background:#fff}
    #${printId} th{background:#eee !important}
    #${printId} .r{text-align:right}
    #${printId} .tot{font-weight:bold;font-size:14px}
    @page { size: ${pageSize}; margin: ${pageMargin}; }
    @media print {
      html, body { background:#fff !important; color:#000 !important; margin:0 !important; padding:0 !important; }
      body > *:not(#${printId}) { display:none !important; visibility:hidden !important; }
      #${printId} { position:static !important; padding:0 !important; }
    }
  `;

  const printPage = document.createElement("div");
  printPage.id = printId;
  printPage.innerHTML = bodyHtml;
  printPage.style.cssText = "position:fixed;left:0;top:0;z-index:-1;opacity:0;pointer-events:none;";

  document.head.appendChild(style);
  document.body.appendChild(printPage);

  const cleanup = () => {
    printPage.remove();
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  import("@/lib/print-preview").then(({ showPrintPreview }) => {
    showPrintPreview({ printPage, cleanup, filename: `ledger-${c.name}` });
  });
}


function ContactsPage() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | ContactType>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [ledgerContact, setLedgerContact] = useState<Contact | null>(null);
  const [ledgerPrintSize, setLedgerPrintSize] = useState<"A4" | "80mm" | "58mm">("A4");

  // Auto-save the in-progress contact so a power cut does not lose it.
  const { clearDraft: clearContactDraft } = useAutosaveDraft<typeof emptyForm>(
    "contact-new",
    form,
    (d) => { setForm({ ...emptyForm, ...d }); setOpen(true); },
    {
      enabled: open && !editing,
      isEmpty: (d) => !d.name?.trim() && !d.mobile?.trim(),
      restoreMessage: "Unsaved contact restored",
    },
  );


  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,business_id,type,name,supplier_business_name,mobile,email,address_line_1,city,opening_balance,is_active")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  // Aggregate transactions per contact: sales (type=sell) and purchases (type=purchase)
  const { data: summaries = {} } = useQuery({
    queryKey: ["contact-summaries", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("contact_id,type,final_total,total_paid")
        .eq("business_id", business!.id)
        .not("contact_id", "is", null)
        .is("deleted_at", null)
        .limit(10000);
      if (error) throw error;
      const map: Record<string, { sell: number; sellPaid: number; purchase: number; purchasePaid: number }> = {};
      for (const r of data ?? []) {
        const id = (r as any).contact_id as string;
        if (!map[id]) map[id] = { sell: 0, sellPaid: 0, purchase: 0, purchasePaid: 0 };
        const total = Number((r as any).final_total ?? 0);
        const paid = Number((r as any).total_paid ?? 0);
        if ((r as any).type === "sell") { map[id].sell += total; map[id].sellPaid += paid; }
        else if ((r as any).type === "purchase") { map[id].purchase += total; map[id].purchasePaid += paid; }
      }
      return map;
    },
  });

  // Ledger transactions for the currently opened contact
  const { data: ledgerRows = [], isLoading: ledgerLoading } = useQuery({
    queryKey: ["contact-ledger", ledgerContact?.id],
    enabled: !!ledgerContact?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,type,invoice_no,ref_no,transaction_date,final_total,total_paid,payment_status,status")
        .eq("contact_id", ledgerContact!.id)
        .order("transaction_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = contacts.filter((c) => {
    if (tab !== "all" && c.type !== tab && c.type !== "both") return false;
    if (tab !== "all" && tab === "customer" && c.type === "supplier") return false;
    if (tab !== "all" && tab === "supplier" && c.type === "customer") return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.mobile ?? "").toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s) ||
      (c.supplier_business_name ?? "").toLowerCase().includes(s)
    );
  });

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      type: c.type,
      name: c.name,
      supplier_business_name: c.supplier_business_name ?? "",
      mobile: c.mobile ?? "",
      email: c.email ?? "",
      address_line_1: c.address_line_1 ?? "",
      city: c.city ?? "",
      opening_balance: Number(c.opening_balance ?? 0),
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!business) throw new Error("No business");
      if (!form.name.trim()) throw new Error("Name is required");
      const payload = {
        business_id: business.id,
        type: form.type,
        name: form.name.trim(),
        supplier_business_name: form.supplier_business_name.trim() || null,
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        address_line_1: form.address_line_1.trim() || null,
        city: form.city.trim() || null,
        opening_balance: Number(form.opening_balance) || 0,
      };
      if (editing) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      clearContactDraft();
      toast.success(editing ? "Contact updated" : "Contact created");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact deleted");
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">Manage customers and suppliers.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add contact
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "customer", "supplier", "both"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-8 rounded-lg px-3 text-xs font-medium border ${
              tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >
            {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <FloatingSearch spacer={44}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, mobile, email…"
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-input text-sm"
            />
          </div>
        </FloatingSearch>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Mobile</th>
                <th className="text-right px-3 py-2">Sales</th>
                <th className="text-right px-3 py-2">Purchases</th>
                <th className="text-right px-3 py-2">Due</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No contacts.</td></tr>
              )}
              {filtered.map((c) => {
                const s = (summaries as any)[c.id] ?? { sell: 0, sellPaid: 0, purchase: 0, purchasePaid: 0 };
                const opening = Number(c.opening_balance ?? 0);
                // Net receivable from customer (they owe us) minus net payable to supplier (we owe them)
                const custDue = s.sell - s.sellPaid;
                const supDue = s.purchase - s.purchasePaid;
                const netDue = custDue - supDue + opening;
                return (
                <tr key={c.id} className="border-t border-border/60">
                  <td className="px-3 py-2 font-medium">{c.name}{c.supplier_business_name ? <span className="ml-1 text-xs text-muted-foreground">({c.supplier_business_name})</span> : null}</td>
                  <td className="px-3 py-2 capitalize">{c.type}</td>
                  <td className="px-3 py-2">{c.mobile ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{money(s.sell)}<div className="text-[10px] text-muted-foreground">paid {money(s.sellPaid)}</div></td>
                  <td className="px-3 py-2 text-right">{money(s.purchase)}<div className="text-[10px] text-muted-foreground">paid {money(s.purchasePaid)}</div></td>
                  <td className={`px-3 py-2 text-right font-semibold ${netDue > 0 ? "text-red-600" : netDue < 0 ? "text-green-600" : ""}`}>
                    {money(Math.abs(netDue))}
                    <div className="text-[10px] font-normal text-muted-foreground">
                      {netDue > 0 ? "receivable" : netDue < 0 ? "payable" : "settled"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setLedgerContact(c)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 hover:bg-muted"
                      title="Ledger / Transactions"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 hover:bg-muted"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${c.name}"?`)) del.mutate(c.id); }}
                      className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <h2 className="font-semibold">{editing ? "Edit contact" : "Add contact"}</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
              className="px-5 py-4 space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ContactType })} className={input}>
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                    <option value="both">Both</option>
                  </select>
                </Field>
                <Field label="Name *">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} required />
                </Field>
                <Field label="Business name">
                  <input value={form.supplier_business_name} onChange={(e) => setForm({ ...form, supplier_business_name: e.target.value })} className={input} />
                </Field>
                <Field label="Mobile">
                  <input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className={input} />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
                </Field>
                <Field label="City">
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={input} />
                </Field>
                <Field label="Address">
                  <input value={form.address_line_1} onChange={(e) => setForm({ ...form, address_line_1: e.target.value })} className={input} />
                </Field>
                <Field label="Opening balance">
                  <input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} className={input} />
                </Field>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-border px-3 text-sm">Cancel</button>
                <button type="submit" disabled={save.isPending} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
                  {save.isPending ? "Saving…" : editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ledgerContact && (() => {
        const s = (summaries as any)[ledgerContact.id] ?? { sell: 0, sellPaid: 0, purchase: 0, purchasePaid: 0 };
        const opening = Number(ledgerContact.opening_balance ?? 0);
        const custDue = s.sell - s.sellPaid;
        const supDue = s.purchase - s.purchasePaid;
        const netDue = custDue - supDue + opening;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <div>
                <h2 className="font-semibold">{ledgerContact.name} — Ledger</h2>
                <p className="text-xs text-muted-foreground capitalize">{ledgerContact.type}{ledgerContact.mobile ? ` · ${ledgerContact.mobile}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={ledgerPrintSize}
                  onChange={(e) => setLedgerPrintSize(e.target.value as "A4" | "80mm" | "58mm")}
                  className="h-8 rounded-md border border-border/60 bg-input px-2 text-xs"
                  title="Paper size"
                >
                  <option value="A4">A4</option>
                  <option value="80mm">80mm</option>
                  <option value="58mm">58mm</option>
                </select>
                <button
                  onClick={() => printLedger(ledgerContact, business, { opening, sell: s.sell, sellPaid: s.sellPaid, purchase: s.purchase, purchasePaid: s.purchasePaid, netDue }, ledgerRows, ledgerPrintSize)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 px-2.5 text-xs hover:bg-muted"
                  title="Print ledger"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button onClick={() => setLedgerContact(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-5 py-3 border-b border-border/60 text-xs">
              <div className="rounded-lg border border-border/60 p-2"><div className="text-muted-foreground">Opening</div><div className="font-semibold">{money(opening)}</div></div>
              <div className="rounded-lg border border-border/60 p-2"><div className="text-muted-foreground">Total Sales</div><div className="font-semibold">{money(s.sell)}</div></div>
              <div className="rounded-lg border border-border/60 p-2"><div className="text-muted-foreground">Total Purchases</div><div className="font-semibold">{money(s.purchase)}</div></div>
              <div className="rounded-lg border border-border/60 p-2"><div className="text-muted-foreground">Total Paid</div><div className="font-semibold">{money(s.sellPaid + s.purchasePaid)}</div></div>
              <div className={`rounded-lg border p-2 ${netDue > 0 ? "border-red-300 bg-red-50" : netDue < 0 ? "border-green-300 bg-green-50" : "border-border/60"}`}>
                <div className="text-muted-foreground">Net {netDue > 0 ? "Receivable" : netDue < 0 ? "Payable" : "Balance"}</div>
                <div className="font-bold">{money(Math.abs(netDue))}</div>
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Invoice / Ref</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-right px-3 py-2">Total</th>
                    <th className="text-right px-3 py-2">Paid</th>
                    <th className="text-right px-3 py-2">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerLoading && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>}
                  {!ledgerLoading && ledgerRows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No transactions yet.</td></tr>}
                  {ledgerRows.map((r: any) => {
                    const total = Number(r.final_total ?? 0);
                    const paid = Number(r.total_paid ?? 0);
                    return (
                      <tr key={r.id} className="border-t border-border/60">
                        <td className="px-3 py-2">{fmtDate(r.transaction_date)}</td>
                        <td className="px-3 py-2 capitalize">{r.type}</td>
                        <td className="px-3 py-2">{r.invoice_no ?? r.ref_no ?? "—"}</td>
                        <td className="px-3 py-2 capitalize">{r.payment_status}</td>
                        <td className="px-3 py-2 text-right">{money(total)}</td>
                        <td className="px-3 py-2 text-right">{money(paid)}</td>
                        <td className={`px-3 py-2 text-right ${total - paid > 0 ? "text-red-600" : ""}`}>{money(total - paid)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border/60 px-5 py-3 flex justify-end">
              <button onClick={() => setLedgerContact(null)} className="h-9 rounded-lg border border-border px-3 text-sm">Close</button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

const input = "w-full h-9 rounded-lg border border-border bg-input px-3 text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</span>{children}</label>;
}
