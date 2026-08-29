import { createFileRoute } from "@tanstack/react-router";
import { fmtDateTime } from "@/lib/format-date";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, BookOpen, Search } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Accounts — QweekPOS" }] }),
  component: AccountsPage,
});

type Account = {
  id: string;
  name: string;
  account_type: string;
  account_number: string | null;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  note: string | null;
};
type AccountTx = {
  id: string;
  account_id: string;
  tx_type: string;
  amount: number;
  tx_date: string;
  reference_type: string | null;
  reference_id: string | null;
  linked_account_id: string | null;
  note: string | null;
};

const money = (n: number) => Number(n || 0).toFixed(2);
const fmtDate = fmtDateTime;

const TX_SIGN: Record<string, 1 | -1> = {
  deposit: 1, transfer_in: 1, sale_payment: 1,
  withdraw: -1, transfer_out: -1, purchase_payment: -1, expense_payment: -1,
};

function AccountsPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState("accounts");
  const [openAcct, setOpenAcct] = useState(false);
  const [openTx, setOpenTx] = useState<null | "deposit" | "withdraw" | "transfer">(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [acctSearch, setAcctSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");

  const accounts = useQuery({
    queryKey: ["accounts", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, account_type, account_number, opening_balance, current_balance, is_active, note")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  const txs = useQuery({
    queryKey: ["account-txs", businessId, selectedId],
    enabled: !!businessId,
    queryFn: async () => {
      let q = supabase
        .from("account_transactions")
        .select("id, account_id, tx_type, amount, tx_date, reference_type, reference_id, linked_account_id, note")
        .eq("business_id", businessId!)
        .order("tx_date", { ascending: false })
        .limit(500);
      if (selectedId) q = q.eq("account_id", selectedId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AccountTx[];
    },
  });

  const acctName = (id: string | null) => accounts.data?.find((a) => a.id === id)?.name ?? "—";

  const filteredAccounts = useMemo(() => {
    const q = acctSearch.trim().toLowerCase();
    const list = accounts.data ?? [];
    if (!q) return list;
    return list.filter((a) =>
      [a.name, a.account_type, a.account_number, money(a.opening_balance), money(a.current_balance), a.is_active ? "active" : "inactive"]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ")
        .includes(q),
    );
  }, [accounts.data, acctSearch]);

  const filteredTxs = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    const list = txs.data ?? [];
    if (!q) return list;
    return list.filter((t) =>
      [fmtDate(t.tx_date), acctName(t.account_id), t.tx_type, t.reference_type, acctName(t.linked_account_id), money(t.amount), t.note]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ")
        .includes(q),
    );
  }, [txs.data, txSearch, accounts.data]);

  const totalBalance = useMemo(
    () => (accounts.data ?? []).reduce((s, a) => s + Number(a.current_balance || 0), 0),
    [accounts.data],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["account-txs"] });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><BookOpen className="h-6 w-6" /> Accounts</h1>
          <p className="text-sm text-muted-foreground">Cash, bank & card accounts with full transaction ledger</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total Balance</div>
          <div className="text-xl font-semibold">{money(totalBalance)}</div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Dialog open={openAcct} onOpenChange={(v) => { setOpenAcct(v); if (!v) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> New Account</Button>
              </DialogTrigger>
              <AccountDialog
                businessId={businessId}
                account={editing}
                onClose={() => { setOpenAcct(false); setEditing(null); }}
              />
            </Dialog>
            <Button variant="outline" onClick={() => setOpenTx("deposit")}><ArrowDownCircle className="mr-2 h-4 w-4" /> Deposit</Button>
            <Button variant="outline" onClick={() => setOpenTx("withdraw")}><ArrowUpCircle className="mr-2 h-4 w-4" /> Withdraw</Button>
            <Button variant="outline" onClick={() => setOpenTx("transfer")}><ArrowLeftRight className="mr-2 h-4 w-4" /> Transfer</Button>
          </div>

          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search accounts…" value={acctSearch} onChange={(e) => setAcctSearch(e.target.value)} />
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!accounts.data?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No accounts yet</TableCell></TableRow>
                ) : filteredAccounts.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No match</TableCell></TableRow>
                ) : filteredAccounts.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => { setSelectedId(a.id); setTab("ledger"); }}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell><Badge variant="outline">{a.account_type}</Badge></TableCell>
                    <TableCell>{a.account_number ?? "—"}</TableCell>
                    <TableCell className="text-right">{money(a.opening_balance)}</TableCell>
                    <TableCell className="text-right font-medium">{money(a.current_balance)}</TableCell>
                    <TableCell>{a.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(a); setOpenAcct(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="ledger" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Label>Account</Label>
            <Select value={selectedId || "all"} onValueChange={(v) => setSelectedId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.data?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative max-w-sm flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search transactions…" value={txSearch} onChange={(e) => setTxSearch(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!txs.data?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No transactions</TableCell></TableRow>
                ) : filteredTxs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No match</TableCell></TableRow>
                ) : filteredTxs.map((t) => {
                  const sign = TX_SIGN[t.tx_type] ?? 1;
                  const isCredit = sign > 0;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{fmtDate(t.tx_date)}</TableCell>
                      <TableCell>{acctName(t.account_id)}</TableCell>
                      <TableCell><Badge variant="outline">{t.tx_type}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.reference_type ?? "—"}
                        {t.linked_account_id ? ` • ${acctName(t.linked_account_id)}` : ""}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${isCredit ? "text-emerald-600" : "text-destructive"}`}>
                        {isCredit ? "+" : "-"}{money(t.amount)}
                      </TableCell>
                      <TableCell className="text-sm">{t.note ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <TxDialog
        mode={openTx}
        businessId={businessId}
        accounts={accounts.data ?? []}
        onClose={() => { setOpenTx(null); invalidate(); }}
      />
    </div>
  );
}

function AccountDialog({ businessId, account, onClose }: { businessId?: string; account: Account | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.account_type ?? "bank");
  const [number, setNumber] = useState(account?.account_number ?? "");
  const [opening, setOpening] = useState<number>(account?.opening_balance ?? 0);
  const [active, setActive] = useState<boolean>(account?.is_active ?? true);
  const [note, setNote] = useState(account?.note ?? "");

  const save = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("Missing business");
      if (!name.trim()) throw new Error("Name required");
      if (account) {
        const { error } = await supabase.from("accounts").update({
          name, account_type: type, account_number: number || null, is_active: active, note: note || null,
        }).eq("id", account.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("accounts").insert({
          business_id: businessId,
          name, account_type: type, account_number: number || null,
          opening_balance: Number(opening || 0),
          current_balance: Number(opening || 0),
          is_active: active, note: note || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(account ? "Account updated" : "Account created");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{account ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Account Number</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} /></div>
        </div>
        {!account && (
          <div><Label>Opening Balance</Label><Input type="number" value={opening} onChange={(e) => setOpening(Number(e.target.value))} /></div>
        )}
        <div className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /><Label>Active</Label></div>
        <div><Label>Note</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function TxDialog({
  mode, businessId, accounts, onClose,
}: {
  mode: null | "deposit" | "withdraw" | "transfer";
  businessId?: string; accounts: Account[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("Missing business");
      if (!accountId) throw new Error("Select account");
      if (amount <= 0) throw new Error("Amount must be positive");
      if (mode === "transfer") {
        if (!toAccountId || toAccountId === accountId) throw new Error("Select a different destination account");
        const { error } = await supabase.rpc("transfer_between_accounts" as any, {
          _from: accountId, _to: toAccountId, _amount: amount, _note: note || null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("account_transactions").insert({
          business_id: businessId,
          account_id: accountId,
          tx_type: mode!,
          amount,
          reference_type: "manual",
          note: note || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["account-txs"] });
      setAccountId(""); setToAccountId(""); setAmount(0); setNote("");
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const title = mode === "deposit" ? "Deposit" : mode === "withdraw" ? "Withdraw" : mode === "transfer" ? "Transfer Between Accounts" : "";

  return (
    <Dialog open={!!mode} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>{mode === "transfer" ? "From Account" : "Account"}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>{accounts.filter(a => a.is_active).map((a) => <SelectItem key={a.id} value={a.id}>{a.name} — {money(a.current_balance)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {mode === "transfer" && (
            <div>
              <Label>To Account</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>{accounts.filter(a => a.is_active && a.id !== accountId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Amount *</Label><Input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
          <div><Label>Note</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}