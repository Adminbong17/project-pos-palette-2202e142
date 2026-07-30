import { FloatingSearch } from "@/components/floating-search";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Wallet, RefreshCcw, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — QweekPOS" }] }),
  component: ExpensesPage,
});

type Interval = "daily" | "weekly" | "monthly" | "yearly";
type PayStatus = "paid" | "partial" | "due";

type Category = { id: string; name: string; parent_id: string | null; is_active: boolean; description: string | null };
type Location = { id: string; name: string };
type Contact = { id: string; name: string };
type Expense = {
  id: string;
  ref_no: string | null;
  expense_date: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  total_paid: number;
  payment_status: PayStatus;
  notes: string | null;
  category_id: string | null;
  location_id: string | null;
  contact_id: string | null;
  is_recurring: boolean;
  recurring_interval: Interval | null;
  recurring_next_date: string | null;
  recurring_end_date: string | null;
  is_recurring_active: boolean;
};
type Payment = { id: string; amount: number; method: string; paid_on: string; note: string | null };

const money = (n: number) => Number(n || 0).toFixed(2);
const fmtDate = (d: string) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);

function ExpensesPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState("list");

  const cats = useQuery({
    queryKey: ["expense-categories", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id, name, parent_id, is_active, description")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const locations = useQuery({
    queryKey: ["biz-locations", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data } = await supabase
        .from("business_locations")
        .select("id, name")
        .eq("business_id", businessId!)
        .order("name");
      return (data ?? []) as Location[];
    },
  });

  const contacts = useQuery({
    queryKey: ["biz-contacts-supplier", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, type")
        .eq("business_id", businessId!)
        .in("type", ["supplier", "both"])
        .order("name");
      return (data ?? []) as Contact[];
    },
  });

  const expenses = useQuery({
    queryKey: ["expenses", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(
          "id, ref_no, expense_date, amount, tax_amount, total_amount, total_paid, payment_status, notes, category_id, location_id, contact_id, is_recurring, recurring_interval, recurring_next_date, recurring_end_date, is_recurring_active",
        )
        .eq("business_id", businessId!)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });

  const totals = useMemo(() => {
    const list = expenses.data ?? [];
    const total = list.reduce((a, e) => a + Number(e.total_amount || 0), 0);
    const paid = list.reduce((a, e) => a + Number(e.total_paid || 0), 0);
    return { count: list.length, total, paid, due: Math.max(0, total - paid) };
  }, [expenses.data]);

  const catNameById = useMemo(() => {
    const m = new Map<string, string>();
    (cats.data ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [cats.data]);

  const locNameById = useMemo(() => {
    const m = new Map<string, string>();
    (locations.data ?? []).forEach((l) => m.set(l.id, l.name));
    return m;
  }, [locations.data]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track spending, categories and recurring bills.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Total Expenses" value={totals.count.toString()} />
        <StatCard label="Total Amount" value={money(totals.total)} />
        <StatCard label="Paid" value={money(totals.paid)} tone="text-emerald-400" />
        <StatCard label="Due" value={money(totals.due)} tone="text-amber-400" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list">Expenses</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <ExpensesList
            expenses={expenses.data ?? []}
            categories={cats.data ?? []}
            locations={locations.data ?? []}
            contacts={contacts.data ?? []}
            catNameById={catNameById}
            locNameById={locNameById}
            businessId={businessId!}
            onChanged={() => qc.invalidateQueries({ queryKey: ["expenses"] })}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab
            categories={cats.data ?? []}
            businessId={businessId!}
            onChanged={() => qc.invalidateQueries({ queryKey: ["expense-categories"] })}
          />
        </TabsContent>

        <TabsContent value="recurring" className="mt-4">
          <RecurringTab
            expenses={(expenses.data ?? []).filter((e) => e.is_recurring)}
            catNameById={catNameById}
            onChanged={() => qc.invalidateQueries({ queryKey: ["expenses"] })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={`mt-2 font-display text-2xl font-bold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

/* ================= Expenses list ================= */

type ExpForm = {
  ref_no: string;
  expense_date: string;
  category_id: string;
  location_id: string;
  contact_id: string;
  amount: string;
  tax_amount: string;
  amount_paid: string;
  notes: string;
  is_recurring: boolean;
  recurring_interval: Interval;
  recurring_next_date: string;
  recurring_end_date: string;
};

const emptyExpForm: ExpForm = {
  ref_no: "",
  expense_date: todayISO(),
  category_id: "",
  location_id: "",
  contact_id: "",
  amount: "0",
  tax_amount: "0",
  amount_paid: "0",
  notes: "",
  is_recurring: false,
  recurring_interval: "monthly",
  recurring_next_date: "",
  recurring_end_date: "",
};

function ExpensesList({
  expenses, categories, locations, contacts, catNameById, locNameById, businessId, onChanged,
}: {
  expenses: Expense[]; categories: Category[]; locations: Location[]; contacts: Contact[];
  catNameById: Map<string, string>; locNameById: Map<string, string>;
  businessId: string; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpForm>(emptyExpForm);
  const [search, setSearch] = useState("");
  const [payFor, setPayFor] = useState<Expense | null>(null);

  const openNew = () => { setEditId(null); setForm(emptyExpForm); setOpen(true); };
  const openEdit = (e: Expense) => {
    setEditId(e.id);
    setForm({
      ref_no: e.ref_no ?? "",
      expense_date: e.expense_date.slice(0, 10),
      category_id: e.category_id ?? "",
      location_id: e.location_id ?? "",
      contact_id: e.contact_id ?? "",
      amount: String(e.amount ?? 0),
      tax_amount: String(e.tax_amount ?? 0),
      amount_paid: String(e.total_paid ?? 0),
      notes: e.notes ?? "",
      is_recurring: e.is_recurring,
      recurring_interval: (e.recurring_interval ?? "monthly") as Interval,
      recurring_next_date: e.recurring_next_date ?? "",
      recurring_end_date: e.recurring_end_date ?? "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount || 0);
      const tax = Number(form.tax_amount || 0);
      const total = amount + tax;
      const paid = Math.min(Number(form.amount_paid || 0), total);
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        business_id: businessId,
        ref_no: form.ref_no || null,
        expense_date: new Date(form.expense_date).toISOString(),
        category_id: form.category_id || null,
        location_id: form.location_id || null,
        contact_id: form.contact_id || null,
        amount,
        tax_amount: tax,
        total_amount: total,
        notes: form.notes || null,
        is_recurring: form.is_recurring,
        recurring_interval: form.is_recurring ? form.recurring_interval : null,
        recurring_next_date: form.is_recurring && form.recurring_next_date ? form.recurring_next_date : null,
        recurring_end_date: form.is_recurring && form.recurring_end_date ? form.recurring_end_date : null,
        is_recurring_active: form.is_recurring,
      };
      let expenseId: string | null = editId;
      if (editId) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        payload.created_by = u.user?.id ?? null;
        const { data, error } = await supabase.from("expenses").insert(payload).select("id").single();
        if (error) throw error;
        expenseId = data.id;
      }
      // Sync a single payment row equal to amount_paid on create.
      // On edit, if paid differs, adjust by adding a diff payment.
      if (!editId && paid > 0 && expenseId) {
        const { error: pe } = await supabase.from("expense_payments").insert({
          expense_id: expenseId,
          business_id: businessId,
          amount: paid,
          method: "cash",
          paid_on: new Date().toISOString(),
          created_by: u.user?.id ?? null,
        });
        if (pe) throw pe;
      } else if (editId) {
        // Recompute existing paid; if user changed amount_paid, insert delta as new payment.
        const { data: current } = await supabase
          .from("expenses").select("total_paid").eq("id", editId).single();
        const diff = paid - Number(current?.total_paid ?? 0);
        if (Math.abs(diff) > 0.0001) {
          const { error: pe } = await supabase.from("expense_payments").insert({
            expense_id: editId,
            business_id: businessId,
            amount: diff,
            method: diff > 0 ? "cash" : "adjustment",
            paid_on: new Date().toISOString(),
            note: "Adjustment via edit",
            created_by: u.user?.id ?? null,
          });
          if (pe) throw pe;
        }
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Expense updated" : "Expense recorded");
      setOpen(false);
      onChanged();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Expense deleted"); onChanged(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  const filtered = expenses.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (e.ref_no ?? "").toLowerCase().includes(s) ||
      (e.notes ?? "").toLowerCase().includes(s) ||
      (catNameById.get(e.category_id ?? "") ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FloatingSearch spacer={44}>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ref, notes, category…" className="pl-8 w-full" />
          </div>
        </FloatingSearch>
        <div className="ml-auto flex gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Expense</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? "Edit expense" : "Record expense"}</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Reference No">
                  <Input value={form.ref_no} onChange={(e) => setForm({ ...form, ref_no: e.target.value })} placeholder="Auto if empty" />
                </Field>
                <Field label="Date">
                  <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
                </Field>
                <Field label="Category">
                  <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {categories.filter(c => c.is_active).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Location">
                  <Select value={form.location_id || "none"} onValueChange={(v) => setForm({ ...form, location_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Payee (supplier)">
                  <Select value={form.contact_id || "none"} onValueChange={(v) => setForm({ ...form, contact_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select payee" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Amount">
                  <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </Field>
                <Field label="Tax">
                  <Input type="number" step="0.01" value={form.tax_amount} onChange={(e) => setForm({ ...form, tax_amount: e.target.value })} />
                </Field>
                <Field label="Amount Paid">
                  <Input type="number" step="0.01" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Notes">
                    <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </Field>
                </div>
                <div className="sm:col-span-2 flex items-center gap-2 pt-2">
                  <Checkbox id="rec" checked={form.is_recurring} onCheckedChange={(v) => setForm({ ...form, is_recurring: !!v })} />
                  <Label htmlFor="rec" className="cursor-pointer">This is a recurring expense</Label>
                </div>
                {form.is_recurring && (
                  <>
                    <Field label="Interval">
                      <Select value={form.recurring_interval} onValueChange={(v) => setForm({ ...form, recurring_interval: v as Interval })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Next date">
                      <Input type="date" value={form.recurring_next_date} onChange={(e) => setForm({ ...form, recurring_next_date: e.target.value })} />
                    </Field>
                    <Field label="End date (optional)">
                      <Input type="date" value={form.recurring_end_date} onChange={(e) => setForm({ ...form, recurring_end_date: e.target.value })} />
                    </Field>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{fmtDate(e.expense_date)}</TableCell>
                <TableCell>{e.ref_no ?? "—"}</TableCell>
                <TableCell>{e.category_id ? (catNameById.get(e.category_id) ?? "—") : "—"}</TableCell>
                <TableCell>{e.location_id ? (locNameById.get(e.location_id) ?? "—") : "—"}</TableCell>
                <TableCell className="text-right">{money(e.total_amount)}</TableCell>
                <TableCell className="text-right">{money(e.total_paid)}</TableCell>
                <TableCell>
                  <Badge variant={e.payment_status === "paid" ? "default" : e.payment_status === "partial" ? "secondary" : "outline"}
                    className="capitalize">{e.payment_status}</Badge>
                  {e.is_recurring && <Badge variant="secondary" className="ml-1"><RefreshCcw className="h-3 w-3 mr-1" />rec</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setPayFor(e)} title="Payments">
                    <Wallet className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete expense?")) del.mutate(e.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No expenses yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {payFor && (
        <PaymentsDialog
          expense={payFor}
          businessId={businessId}
          onClose={() => { setPayFor(null); qc.invalidateQueries({ queryKey: ["expenses"] }); }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ================= Payments ================= */

function PaymentsDialog({ expense, businessId, onClose }: { expense: Expense; businessId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  const list = useQuery({
    queryKey: ["expense-payments", expense.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_payments")
        .select("id, amount, method, paid_on, note").eq("expense_id", expense.id).order("paid_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const amt = Number(amount || 0);
      if (!amt) throw new Error("Enter amount");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("expense_payments").insert({
        expense_id: expense.id,
        business_id: businessId,
        amount: amt,
        method,
        note: note || null,
        paid_on: new Date().toISOString(),
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment added");
      setAmount(""); setNote("");
      qc.invalidateQueries({ queryKey: ["expense-payments", expense.id] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-payments", expense.id] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const due = Math.max(0, Number(expense.total_amount) - Number(expense.total_paid));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Payments</DialogTitle></DialogHeader>
        <div className="text-sm text-muted-foreground">
          Total: <b>{money(expense.total_amount)}</b> · Paid: <b>{money(expense.total_paid)}</b> · Due: <b className="text-amber-400">{money(due)}</b>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Input type="number" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => add.mutate()} disabled={add.isPending}>Add</Button>
        </div>
        <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="rounded-lg border border-border/60 max-h-64 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{fmtDate(p.paid_on)}</TableCell>
                  <TableCell className="capitalize">{p.method}</TableCell>
                  <TableCell className="text-right">{money(p.amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {(list.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No payments</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Categories ================= */

function CategoriesTab({ categories, businessId, onChanged }: { categories: Category[]; businessId: string; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [parent, setParent] = useState<string>("");
  const [desc, setDesc] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      const payload = {
        business_id: businessId,
        name: name.trim(),
        parent_id: parent || null,
        description: desc || null,
      };
      if (editing) {
        const { error } = await supabase.from("expense_categories").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expense_categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Category updated" : "Category added");
      setName(""); setParent(""); setDesc(""); setEditing(null);
      onChanged();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const toggle = useMutation({
    mutationFn: async (c: Category) => {
      const { error } = await supabase.from("expense_categories").update({ is_active: !c.is_active }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => onChanged(),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); onChanged(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const startEdit = (c: Category) => {
    setEditing(c); setName(c.name); setParent(c.parent_id ?? ""); setDesc(c.description ?? "");
  };

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 h-fit">
        <div className="font-medium">{editing ? "Edit category" : "New category"}</div>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Parent (optional)">
          <Select value={parent || "none"} onValueChange={(v) => setParent(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {categories.filter(c => !editing || c.id !== editing.id).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Description"><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <div className="flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">
            {editing ? "Update" : "Add"}
          </Button>
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setName(""); setParent(""); setDesc(""); }}>Cancel</Button>}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Parent</TableHead><TableHead>Status</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {categories.map(c => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.parent_id ? (categories.find(x => x.id === c.parent_id)?.name ?? "—") : "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.is_active ? "default" : "outline"}>{c.is_active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => toggle.mutate(c)}>{c.is_active ? "Disable" : "Enable"}</Button>
                  <Button variant="ghost" size="icon" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete category?")) del.mutate(c.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No categories yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ================= Recurring ================= */

function RecurringTab({ expenses, catNameById, onChanged }: {
  expenses: Expense[]; catNameById: Map<string, string>; onChanged: () => void;
}) {
  const toggle = useMutation({
    mutationFn: async (e: Expense) => {
      const { error } = await supabase.from("expenses")
        .update({ is_recurring_active: !e.is_recurring_active }).eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => onChanged(),
  });

  const generate = useMutation({
    mutationFn: async (e: Expense) => {
      const { data: u } = await supabase.auth.getUser();
      const nextDate = e.recurring_next_date ? new Date(e.recurring_next_date) : new Date();
      const { error } = await supabase.from("expenses").insert({
        business_id: (e as any).business_id ?? undefined,
        ref_no: e.ref_no ? `${e.ref_no}-R` : null,
        expense_date: nextDate.toISOString(),
        category_id: e.category_id,
        location_id: e.location_id,
        contact_id: e.contact_id,
        amount: e.amount,
        tax_amount: e.tax_amount,
        total_amount: e.total_amount,
        notes: e.notes,
        is_recurring: false,
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
      // advance recurring_next_date
      const advance = new Date(nextDate);
      const iv = e.recurring_interval ?? "monthly";
      if (iv === "daily") advance.setDate(advance.getDate() + 1);
      if (iv === "weekly") advance.setDate(advance.getDate() + 7);
      if (iv === "monthly") advance.setMonth(advance.getMonth() + 1);
      if (iv === "yearly") advance.setFullYear(advance.getFullYear() + 1);
      const iso = advance.toISOString().slice(0, 10);
      await supabase.from("expenses").update({ recurring_next_date: iso }).eq("id", e.id);
    },
    onSuccess: () => { toast.success("Generated occurrence"); onChanged(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Interval</TableHead>
            <TableHead>Next date</TableHead>
            <TableHead>End date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.category_id ? (catNameById.get(e.category_id) ?? "—") : "—"}</TableCell>
              <TableCell className="capitalize">{e.recurring_interval ?? "—"}</TableCell>
              <TableCell>{e.recurring_next_date ? fmtDate(e.recurring_next_date) : "—"}</TableCell>
              <TableCell>{e.recurring_end_date ? fmtDate(e.recurring_end_date) : "—"}</TableCell>
              <TableCell className="text-right">{money(e.total_amount)}</TableCell>
              <TableCell>
                <Badge variant={e.is_recurring_active ? "default" : "outline"}>
                  {e.is_recurring_active ? "Active" : "Paused"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => generate.mutate(e)} disabled={generate.isPending}>
                  Generate now
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggle.mutate(e)}>
                  {e.is_recurring_active ? "Pause" : "Resume"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {expenses.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No recurring expenses</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}