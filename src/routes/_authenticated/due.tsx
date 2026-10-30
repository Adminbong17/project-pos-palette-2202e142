import { formatDate } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format-date";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FoldTable } from "@/components/fold-table";
import { DATE_PRESETS, resolvePresetRange, type DatePresetKey } from "@/lib/date-presets";
import { printHrmReport } from "@/lib/hrm-print";
import { printDueVoucher, type DueVoucherData } from "@/lib/due-print";
import { printReceiptInWhitePage, type ReceiptSale } from "@/lib/receipt-print";
import { toast } from "sonner";
import {
  HandCoins,
  Receipt,
  Printer,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Users,
  Wallet,
  Building2,
  Calendar,
  History,
  ArrowRight,
  Plus,
  CircleDollarSign,
  TrendingDown,
  CreditCard,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/due")({
  head: () => ({ meta: [{ title: "Due Management — বকেয়া খাতা — Sheikh Pharma" }] }),
  component: DueManagementPage,
});

type DueSaleRow = {
  id: string;
  invoice_no: string | null;
  ref_no: string | null;
  transaction_date: string;
  created_at: string;
  status: string;
  payment_status: string;
  final_total: number;
  total_paid: number;
  contact_id: string | null;
  location_id: string | null;
  additional_notes: string | null;
  contact: {
    id?: string;
    name: string | null;
    mobile: string | null;
    address_line_1: string | null;
  } | null;
  location: {
    name: string | null;
  } | null;
};

type PaymentHistoryItem = {
  id: string;
  amount: number;
  method: string;
  paid_on: string;
  note: string | null;
  created_at: string;
};

const PAYMENT_METHODS = [
  { key: "cash", label: "নগদ (Cash)" },
  { key: "bkash", label: "বিকাশ (bKash)" },
  { key: "nagad", label: "নগদ অ্যাপ (Nagad)" },
  { key: "rocket", label: "রকেট (Rocket)" },
  { key: "bank", label: "ব্যাংক ট্রান্সফার (Bank)" },
  { key: "card", label: "কার্ড (Card)" },
];

function DueManagementPage() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin } = useCurrentRole();
  const qc = useQueryClient();

  // Filters
  const [tab, setTab] = useState<"invoices" | "customers">("invoices");
  const [statusFilter, setStatusFilter] = useState<"all_due" | "partial" | "full_due" | "cleared" | "all">("all_due");
  const [dateRange, setDateRange] = useState<DatePresetKey>("allTime");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");

  // Pagination for DOM performance (prevents browser freezing when thousands of invoices exist)
  const [invoicePage, setInvoicePage] = useState(1);
  const INVOICE_PAGE_SIZE = 50;
  const [customerPage, setCustomerPage] = useState(1);
  const CUSTOMER_PAGE_SIZE = 50;

  useEffect(() => {
    setInvoicePage(1);
    setCustomerPage(1);
  }, [search, statusFilter, dateRange, customFrom, customTo, selectedLocationId]);

  // Single Invoice Payment Modal
  const [payRow, setPayRow] = useState<DueSaleRow | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [payDate, setPayDate] = useState<string>("");
  const [payNote, setPayNote] = useState<string>("");

  // Customer Bulk Payment Modal
  const [bulkCustomer, setBulkCustomer] = useState<{
    id: string | null;
    name: string;
    mobile: string | null;
    totalDue: number;
    invoices: DueSaleRow[];
  } | null>(null);
  const [bulkAmount, setBulkAmount] = useState<string>("");
  const [bulkMethod, setBulkMethod] = useState<string>("cash");
  const [bulkDate, setBulkDate] = useState<string>("");
  const [bulkNote, setBulkNote] = useState<string>("");

  // Payment History Dialog
  const [historyRow, setHistoryRow] = useState<DueSaleRow | null>(null);

  // Voucher print state
  const [printWidth, setPrintWidth] = useState<"58" | "80" | "A4">("80");
  const [lastVoucher, setLastVoucher] = useState<DueVoucherData | null>(null);

  // Fetch Business Locations
  const { data: locations = [] } = useQuery({
    queryKey: ["business-locations", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_locations")
        .select("id, name")
        .eq("business_id", business!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Resolve Date Range
  const { fromISO, toISO } = useMemo(() => {
    return resolvePresetRange(dateRange, customFrom, customTo);
  }, [dateRange, customFrom, customTo]);

  // Fetch Sales Transactions with lean payload and caching
  const { data: allSales = [], isLoading } = useQuery({
    queryKey: ["due-sales", business?.id],
    enabled: !!business?.id,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `id, invoice_no, ref_no, transaction_date, created_at, status, payment_status, final_total, total_paid, contact_id, location_id,
           contact:contacts(id, name, mobile, address_line_1),
           location:business_locations(name)`
        )
        .eq("business_id", business!.id)
        .eq("type", "sell")
        .eq("status", "final")
        .order("transaction_date", { ascending: false })
        .limit(2000);

      if (error) throw error;
      return (data ?? []) as unknown as DueSaleRow[];
    },
  });

  // Fetch Payment History for open dialog
  const { data: historyPayments = [], isLoading: historyLoading } = useQuery({
    queryKey: ["transaction-payments", historyRow?.id],
    enabled: !!historyRow?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_payments")
        .select("id, amount, method, paid_on, note, created_at")
        .eq("transaction_id", historyRow!.id)
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentHistoryItem[];
    },
  });

  // Calculate Due and Status for each row
  const rowsWithDue = useMemo(() => {
    return allSales.map((r) => {
      const total = Number(r.final_total || 0);
      const paid = Number(r.total_paid || 0);
      const due = Math.max(0, total - paid);
      const isSettled = due <= 0.001;
      const isPartial = paid > 0 && due > 0.001;
      const isFullDue = paid <= 0.001 && due > 0.001;

      return {
        ...r,
        dueAmount: due,
        isSettled,
        isPartial,
        isFullDue,
      };
    });
  }, [allSales]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return rowsWithDue.filter((r) => {
      // Location filter
      if (selectedLocationId !== "all" && r.location_id !== selectedLocationId) {
        return false;
      }

      // Date range filter
      if (dateRange !== "allTime") {
        if (fromISO && r.transaction_date < fromISO) return false;
        if (toISO && r.transaction_date >= toISO) return false;
      }

      // Status filter
      if (statusFilter === "all_due" && r.dueAmount <= 0.001) return false;
      if (statusFilter === "partial" && !r.isPartial) return false;
      if (statusFilter === "full_due" && !r.isFullDue) return false;
      if (statusFilter === "cleared" && !r.isSettled) return false;

      // Text search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const inv = (r.invoice_no || r.ref_no || "").toLowerCase();
        const cust = (r.contact?.name || "walk-in").toLowerCase();
        const phone = (r.contact?.mobile || "").toLowerCase();
        const loc = (r.location?.name || "").toLowerCase();
        if (!inv.includes(q) && !cust.includes(q) && !phone.includes(q) && !loc.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [rowsWithDue, selectedLocationId, dateRange, fromISO, toISO, statusFilter, search]);

  // Global KPIs (computed over all active due sales)
  const stats = useMemo(() => {
    let totalDueReceivable = 0;
    let totalDueInvoices = 0;
    let totalCollected = 0;
    let totalBillValue = 0;
    const customersWithDue = new Set<string>();

    rowsWithDue.forEach((r) => {
      totalBillValue += Number(r.final_total || 0);
      totalCollected += Number(r.total_paid || 0);
      if (r.dueAmount > 0.001) {
        totalDueReceivable += r.dueAmount;
        totalDueInvoices += 1;
        customersWithDue.add(r.contact_id || `walkin-${r.id}`);
      }
    });

    return {
      totalDueReceivable,
      totalDueInvoices,
      totalCollected,
      totalBillValue,
      uniqueCustomersCount: customersWithDue.size,
    };
  }, [rowsWithDue]);

  // Group by customer for Customer Ledger Tab
  const customerLedgers = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string | null;
        name: string;
        mobile: string | null;
        address: string | null;
        totalInvoices: number;
        dueInvoicesCount: number;
        totalBill: number;
        totalPaid: number;
        totalDue: number;
        invoices: DueSaleRow[];
      }
    >();

    rowsWithDue.forEach((r) => {
      const key = r.contact_id || `walkin-${r.id}`;
      const name = r.contact?.name || "Walk-in Customer (খুচরা ক্রেতা)";
      const mobile = r.contact?.mobile || null;
      const address = r.contact?.address_line_1 || null;

      const existing = map.get(key) || {
        id: r.contact_id,
        name,
        mobile,
        address,
        totalInvoices: 0,
        dueInvoicesCount: 0,
        totalBill: 0,
        totalPaid: 0,
        totalDue: 0,
        invoices: [],
      };

      existing.totalInvoices += 1;
      existing.totalBill += Number(r.final_total || 0);
      existing.totalPaid += Number(r.total_paid || 0);
      existing.totalDue += r.dueAmount;
      if (r.dueAmount > 0.001) {
        existing.dueInvoicesCount += 1;
      }
      existing.invoices.push(r);
      map.set(key, existing);
    });

    const list = Array.from(map.values());

    // Filter customer list by search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.mobile || "").toLowerCase().includes(q) ||
          (c.address || "").toLowerCase().includes(q)
      );
    }

    // Default sort by largest due first
    return list.sort((a, b) => b.totalDue - a.totalDue);
  }, [rowsWithDue, search]);

  const totalInvoicePages = Math.max(1, Math.ceil(filteredRows.length / INVOICE_PAGE_SIZE));
  const paginatedInvoices = useMemo(() => {
    const start = (invoicePage - 1) * INVOICE_PAGE_SIZE;
    return filteredRows.slice(start, start + INVOICE_PAGE_SIZE);
  }, [filteredRows, invoicePage]);

  const totalCustomerPages = Math.max(1, Math.ceil(customerLedgers.length / CUSTOMER_PAGE_SIZE));
  const paginatedCustomers = useMemo(() => {
    const start = (customerPage - 1) * CUSTOMER_PAGE_SIZE;
    return customerLedgers.slice(start, start + CUSTOMER_PAGE_SIZE);
  }, [customerLedgers, customerPage]);

  // Currency formatter
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(n || 0);

  // Open Payment Modal for a single invoice
  const openPayModal = (row: DueSaleRow) => {
    const remaining = Math.max(0, Number(row.final_total || 0) - Number(row.total_paid || 0));
    setPayRow(row);
    setPayAmount(remaining.toFixed(2));
    setPayMethod("cash");
    setPayDate(new Date().toISOString().slice(0, 16));
    setPayNote("বকেয়া আদায় / Due collection");
  };

  // Open Bulk Customer Payment Modal
  const openBulkPayModal = (cust: (typeof customerLedgers)[0]) => {
    const unpaidInvoices = cust.invoices
      .filter((i) => Math.max(0, Number(i.final_total || 0) - Number(i.total_paid || 0)) > 0.001)
      .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

    setBulkCustomer({
      id: cust.id,
      name: cust.name,
      mobile: cust.mobile,
      totalDue: cust.totalDue,
      invoices: unpaidInvoices,
    });
    setBulkAmount(cust.totalDue.toFixed(2));
    setBulkMethod("cash");
    setBulkDate(new Date().toISOString().slice(0, 16));
    setBulkNote(`কাস্টমার বকেয়া পরিশোধ — ${cust.name}`);
  };

  // Submit Single Invoice Payment Mutation
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payRow || !business) throw new Error("ইনভয়েস পাওয়া যায়নি");
      const amountNum = parseFloat(payAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error("সঠিক টাকার পরিমাণ লিখুন");
      }

      const total = Number(payRow.final_total || 0);
      const currentPaid = Number(payRow.total_paid || 0);
      const remainingDue = Math.max(0, total - currentPaid);

      if (amountNum > remainingDue + 0.01) {
        throw new Error(`বকেয়া টাকার চেয়ে বেশি জমা দেওয়া যাবে না (বকেয়া: ${money(remainingDue)})`);
      }

      const newTotalPaid = Math.min(total, currentPaid + amountNum);
      const newStatus = newTotalPaid >= total - 0.001 ? "paid" : "partial";
      const txDateISO = payDate ? new Date(payDate).toISOString() : new Date().toISOString();

      // 1. Record payment in transaction_payments
      const { error: payErr } = await supabase.from("transaction_payments").insert({
        transaction_id: payRow.id,
        business_id: business.id,
        amount: amountNum,
        method: payMethod,
        paid_on: txDateISO,
        note: payNote.trim() || `Due payment for invoice ${payRow.invoice_no}`,
      });
      if (payErr) throw payErr;

      // 2. Update transaction total_paid and payment_status
      const { error: txErr } = await supabase
        .from("transactions")
        .update({
          total_paid: newTotalPaid,
          payment_status: newStatus,
        })
        .eq("id", payRow.id);
      if (txErr) throw txErr;

      return {
        amountNum,
        newTotalPaid,
        newRemainingDue: Math.max(0, total - newTotalPaid),
        newStatus,
        txDateISO,
      };
    },
    onSuccess: (res) => {
      if (!payRow) return;

      const voucher: DueVoucherData = {
        voucherNo: `REC-${Date.now().toString().slice(-6)}`,
        invoiceNo: payRow.invoice_no ?? payRow.ref_no ?? "—",
        date: fmtDateTime(res.txDateISO),
        customerName: payRow.contact?.name ?? "Walk-in Customer",
        customerMobile: payRow.contact?.mobile ?? null,
        customerAddress: payRow.contact?.address_line_1 ?? null,
        totalBill: Number(payRow.final_total || 0),
        previouslyPaid: Number(payRow.total_paid || 0),
        amountPaidNow: res.amountNum,
        remainingDue: res.newRemainingDue,
        paymentMethod: payMethod,
        note: payNote,
        business,
      };

      setLastVoucher(voucher);

      toast.success(
        `৳${res.amountNum.toFixed(2)} বকেয়া সফলভাবে আদায় ও টোটাল ক্যাশে যুক্ত হয়েছে! (স্ট্যাটাস: ${
          res.newStatus === "paid" ? "পরিশোধিত" : "আংশিক বকেয়া"
        })`
      );

      // Invalidate relevant query caches
      qc.invalidateQueries({ queryKey: ["due-sales"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["get_business_sales_total"] });
      qc.invalidateQueries({ queryKey: ["reports-sales"] });

      setPayRow(null);
    },
    onError: (e: any) => {
      toast.error(e.message || "বকেয়া আদায় ব্যর্থ হয়েছে");
    },
  });

  // Submit Bulk Customer Payment Mutation (FIFO across unpaid invoices)
  const bulkPayMutation = useMutation({
    mutationFn: async () => {
      if (!bulkCustomer || !business) throw new Error("কাস্টমার তথ্য পাওয়া যায়নি");
      let remainingToAllocate = parseFloat(bulkAmount);
      if (isNaN(remainingToAllocate) || remainingToAllocate <= 0) {
        throw new Error("সঠিক টাকার পরিমাণ লিখুন");
      }

      if (remainingToAllocate > bulkCustomer.totalDue + 0.01) {
        throw new Error(`মোট বকেয়া টাকার চেয়ে বেশি জমা নেওয়া যাবে না (বকেয়া: ${money(bulkCustomer.totalDue)})`);
      }

      const txDateISO = bulkDate ? new Date(bulkDate).toISOString() : new Date().toISOString();
      let updatedCount = 0;

      for (const inv of bulkCustomer.invoices) {
        if (remainingToAllocate <= 0.001) break;

        const invTotal = Number(inv.final_total || 0);
        const invPaid = Number(inv.total_paid || 0);
        const invDue = Math.max(0, invTotal - invPaid);

        if (invDue <= 0.001) continue;

        const allocateAmount = Math.min(invDue, remainingToAllocate);
        const newTotalPaid = Math.min(invTotal, invPaid + allocateAmount);
        const newStatus = newTotalPaid >= invTotal - 0.001 ? "paid" : "partial";

        // Insert into transaction_payments
        const { error: pErr } = await supabase.from("transaction_payments").insert({
          transaction_id: inv.id,
          business_id: business.id,
          amount: allocateAmount,
          method: bulkMethod,
          paid_on: txDateISO,
          note: bulkNote || `Bulk settlement from ${bulkCustomer.name}`,
        });
        if (pErr) throw pErr;

        // Update transaction
        const { error: tErr } = await supabase
          .from("transactions")
          .update({
            total_paid: newTotalPaid,
            payment_status: newStatus,
          })
          .eq("id", inv.id);
        if (tErr) throw tErr;

        remainingToAllocate -= allocateAmount;
        updatedCount += 1;
      }

      return { updatedCount, totalPaid: parseFloat(bulkAmount) };
    },
    onSuccess: (res) => {
      toast.success(
        `৳${res.totalPaid.toFixed(2)} সফলভাবে জমা হয়েছে এবং ${res.updatedCount} টি ইনভয়েসের বকেয়া সমন্বয় করা হয়েছে!`
      );
      qc.invalidateQueries({ queryKey: ["due-sales"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["get_business_sales_total"] });
      setBulkCustomer(null);
    },
    onError: (e: any) => {
      toast.error(e.message || "বকেয়া সমন্বয় ব্যর্থ হয়েছে");
    },
  });

  // Print Full Due Statement on Sheikh Pharma letterhead
  const handlePrintDueStatement = () => {
    const periodStr = dateRange === "custom" ? `${customFrom || "শুরু"} হতে ${customTo || "শেষ"}` : dateRange;
    printHrmReport({
      title: "বকেয়া খাতা ও বিবরণী (Due Statement)",
      subtitle: `ফিল্টার: ${periodStr} • সর্বমোট বকেয়া: ${money(stats.totalDueReceivable)}`,
      business,
      columns: [
        { label: "ইনভয়েস নং", align: "left" },
        { label: "তারিখ", align: "left" },
        { label: "গ্রাহক / কাস্টমার", align: "left" },
        { label: "মোবাইল নং", align: "left" },
        { label: "শাখা", align: "left" },
        { label: "মোট বিল", align: "right" },
        { label: "জমা", align: "right" },
        { label: "বকেয়া (BDT)", align: "right" },
      ],
      rows: filteredRows.map((r) => [
        r.invoice_no ?? r.ref_no ?? "—",
        formatDate(r.transaction_date),
        r.contact?.name ?? "Walk-in Customer",
        r.contact?.mobile ?? "—",
        r.location?.name ?? "—",
        money(Number(r.final_total || 0)),
        money(Number(r.total_paid || 0)),
        money(r.dueAmount),
      ]),
      footer: [
        [
          "সর্বমোট সংক্ষেপ",
          "",
          "",
          "",
          `${filteredRows.length} টি চালান`,
          money(filteredRows.reduce((s, r) => s + Number(r.final_total || 0), 0)),
          money(filteredRows.reduce((s, r) => s + Number(r.total_paid || 0), 0)),
          money(filteredRows.reduce((s, r) => s + r.dueAmount, 0)),
        ],
      ],
      size: "A4",
      filename: `due-statement-${Date.now()}`,
    });
  };

  // Reprint original sale receipt
  const reprintSale = async (saleId: string) => {
    if (!business) return;
    try {
      const [txRes, linesRes, bizRes] = await Promise.all([
        supabase
          .from("transactions")
          .select(
            "id, invoice_no, ref_no, transaction_date, final_total, discount_amount, total_paid, location_id, contact:contacts(name), location:business_locations(name, landmark, city, state, country, zip_code, mobile, alternate_number)"
          )
          .eq("id", saleId)
          .single(),
        supabase
          .from("transaction_sell_lines")
          .select("quantity, unit_price, product:products(name), variation:variations(name, sub_sku)")
          .eq("transaction_id", saleId),
        supabase.from("businesses").select("name, address, notify_phone").eq("id", business.id).single(),
      ]);
      if (txRes.error) throw txRes.error;
      if (linesRes.error) throw linesRes.error;
      const tx: any = txRes.data;
      const lines = (linesRes.data ?? []).map((l: any) => {
        const qty = Number(l.quantity);
        const price = Number(l.unit_price);
        const vname = l.variation?.name && l.variation.name !== "DUMMY" ? ` (${l.variation.name})` : "";
        return { name: `${l.product?.name ?? ""}${vname}`, quantity: qty, unit_price: price, total_amount: qty * price };
      });
      const subtotal = lines.reduce((s, l) => s + l.total_amount, 0);
      const discount = Number(tx.discount_amount || 0);
      const total = Number(tx.final_total || 0);
      const paid = Number(tx.total_paid || 0);
      const loc = tx.location;
      const bizInfo: any = bizRes.data ?? {};
      const address =
        (loc ? [loc.landmark, loc.city, loc.state, loc.zip_code, loc.country].filter(Boolean).join(", ") : "") ||
        bizInfo.address ||
        "";
      const mobile =
        (loc ? [loc.mobile, loc.alternate_number].filter(Boolean).join(" / ") : "") || bizInfo.notify_phone || "";
      const sale: ReceiptSale = {
        invoice_no: tx.invoice_no ?? tx.ref_no ?? "—",
        lines,
        subtotal,
        discount,
        total,
        paid,
        change: paid - total,
        payment_method: "cash",
        customer_name: tx.contact?.name ?? null,
        date: fmtDateTime(tx.transaction_date),
      };
      printReceiptInWhitePage(sale, printWidth, {
        businessName: bizRes.data?.name ?? "",
        businessAddress: address,
        businessMobile: mobile,
      });
    } catch (e: any) {
      toast.error(e.message ?? "রশিদ প্রিন্ট করা যায়নি");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* HEADER SECTION */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <HandCoins className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                বকেয়া খাতা (Due Management)
                <Badge variant="outline" className="border-rose-500/30 text-rose-600 bg-rose-500/10 text-xs font-semibold">
                  বকেয়া কালেকশন
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                সকল বাকি চালান ও গ্রাহকের বকেয়া টাকা আদায় ও টোটাল ক্যাশে যোগ করার মডিউল।
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {lastVoucher && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => printDueVoucher(lastVoucher, printWidth)}
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20 gap-1.5"
            >
              <Printer className="h-4 w-4" />
              <span>শেষ রসিদ প্রিন্ট ({lastVoucher.voucherNo})</span>
            </Button>
          )}

          <select
            value={printWidth}
            onChange={(e) => setPrintWidth(e.target.value as "58" | "80" | "A4")}
            className="h-9 rounded-lg border border-border bg-input px-2.5 text-xs font-medium"
            title="রশিদ প্রিন্ট সাইজ"
          >
            <option value="80">রসিদ: 80mm POS</option>
            <option value="58">রসিদ: 58mm Thermal</option>
            <option value="A4">বিবরণী: A4 Letterhead</option>
          </select>

          <Button
            onClick={handlePrintDueStatement}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
          >
            <Printer className="h-4 w-4" />
            <span>বকেয়া খাতা প্রিন্ট (A4)</span>
          </Button>

          <Button asChild variant="default">
            <Link to="/pos">
              <Plus className="h-4 w-4 mr-1.5" /> নতুন বিক্রয় (POS)
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Due */}
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
            <span className="text-xs font-semibold">সর্বমোট বকেয়া (Total Due)</span>
            <TrendingDown className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-400 mt-2">
            {money(stats.totalDueReceivable)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">দোকানের পাওনা বকেয়া টাকা</p>
        </div>

        {/* Due Invoices Count */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
            <span className="text-xs font-semibold">বকেয়া চালান (Due Invoices)</span>
            <Receipt className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-2">
            {stats.totalDueInvoices.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">মোট বাকি বিক্রির ইনভয়েস</p>
        </div>

        {/* Total Collected */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
            <span className="text-xs font-semibold">আদায়কৃত টাকা (Collected)</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-2">
            {money(stats.totalCollected)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">ক্যাশে জমা হওয়া টাকা</p>
        </div>

        {/* Due Customers Count */}
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
            <span className="text-xs font-semibold">বকেয়া কাস্টমার (Customers)</span>
            <Users className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-400 mt-2">
            {stats.uniqueCustomersCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">যাদের কাছে বাকি রয়েছে</p>
        </div>

        {/* Total Bill Value */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">মোট বিক্রয় মূল্য (Total Bill)</span>
            <CircleDollarSign className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground mt-2">
            {money(stats.totalBillValue)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">সকল চালানের মোট মূল্য</p>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main View Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
            <button
              onClick={() => setTab("invoices")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                tab === "invoices"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>ইনভয়েস ভিত্তিক বকেয়া ({filteredRows.length})</span>
            </button>
            <button
              onClick={() => setTab("customers")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                tab === "customers"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>কাস্টমার ভিত্তিক খাতা ({customerLedgers.filter((c) => c.totalDue > 0.001).length})</span>
            </button>
          </div>

          {/* Status Sub-Filters */}
          {tab === "invoices" && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">স্ট্যাটাস:</span>
              <button
                onClick={() => setStatusFilter("all_due")}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                  statusFilter === "all_due"
                    ? "bg-rose-500 text-white border-rose-600"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                সব বকেয়া
              </button>
              <button
                onClick={() => setStatusFilter("full_due")}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                  statusFilter === "full_due"
                    ? "bg-rose-600 text-white border-rose-700"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                সম্পূর্ণ বাকি
              </button>
              <button
                onClick={() => setStatusFilter("partial")}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                  statusFilter === "partial"
                    ? "bg-amber-500 text-white border-amber-600"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                আংশিক বাকি
              </button>
              <button
                onClick={() => setStatusFilter("cleared")}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                  statusFilter === "cleared"
                    ? "bg-emerald-600 text-white border-emerald-700"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                পরিশোধিত
              </button>
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                  statusFilter === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                সকল চালান
              </button>
            </div>
          )}
        </div>

        {/* Date presets & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">তারিখ:</span>
            {DATE_PRESETS.map(({ key, label }) => (
              <Button
                key={key}
                size="sm"
                variant={dateRange === key ? "default" : "outline"}
                onClick={() => setDateRange(key)}
                className="h-7.5 px-2.5 text-xs"
              >
                {label}
              </Button>
            ))}
            {dateRange === "custom" && (
              <div className="flex items-center gap-1.5 ml-1">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-7.5 rounded-md border border-border bg-input px-2 text-xs"
                />
                <span className="text-xs text-muted-foreground">হতে</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-7.5 rounded-md border border-border bg-input px-2 text-xs"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Location selector */}
            {locations.length > 1 && (
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="h-8.5 rounded-lg border border-border bg-input px-2.5 text-xs"
              >
                <option value="all">সকল শাখা (All Locations)</option>
                {locations.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            )}

            {/* Search Input */}
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ইনভয়েস, কাস্টমার বা মোবাইল..."
                className="h-8.5 w-full rounded-lg border border-border bg-input pl-8 pr-7 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: INVOICE DUES LIST */}
      {tab === "invoices" && (
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <FoldTable className="w-full text-sm min-w-[980px]">
              <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground border-b border-border/80">
                <tr>
                  <th className="text-left p-3.5">তারিখ</th>
                  <th className="text-left p-3.5">ইনভয়েস নং</th>
                  <th className="text-left p-3.5">কাস্টমার / গ্রাহক</th>
                  <th className="text-left p-3.5">শাখা</th>
                  <th className="text-right p-3.5">মোট বিল</th>
                  <th className="text-right p-3.5">জমা</th>
                  <th className="text-right p-3.5">বকেয়া (Due)</th>
                  <th className="text-center p-3.5">স্ট্যাটাস</th>
                  <th className="text-right p-3.5">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      বকেয়া তালিকা লোড হচ্ছে...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      কোনো বকেয়া ইনভয়েস পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((r) => {
                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 whitespace-nowrap text-xs">
                          {formatDate(r.transaction_date)}
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(r.transaction_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-xs font-semibold text-primary">
                          {r.invoice_no ?? r.ref_no ?? "—"}
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-foreground">
                            {r.contact?.name ?? "Walk-in Customer"}
                          </div>
                          {r.contact?.mobile ? (
                            <div className="text-xs text-muted-foreground font-mono">{r.contact.mobile}</div>
                          ) : null}
                        </td>
                        <td className="p-3.5 text-xs text-muted-foreground">{r.location?.name ?? "—"}</td>
                        <td className="p-3.5 text-right font-mono font-medium">
                          {money(Number(r.final_total || 0))}
                        </td>
                        <td className="p-3.5 text-right font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                          {money(Number(r.total_paid || 0))}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-base">
                          {r.dueAmount > 0.001 ? (
                            <span className="text-rose-600 dark:text-rose-400">{money(r.dueAmount)}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">৳ 0.00</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          {r.dueAmount <= 0.001 ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px]">
                              পরিশোধিত
                            </Badge>
                          ) : r.isPartial ? (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[11px]">
                              আংশিক বাকি
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[11px]">
                              সম্পূর্ণ বকেয়া
                            </Badge>
                          )}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Pay Due Button */}
                            {r.dueAmount > 0.001 ? (
                              <Button
                                size="sm"
                                onClick={() => openPayModal(r)}
                                className="h-8 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold gap-1 px-3 shadow-xs"
                                title="বকেয়া টাকা জমা ও পরিশোধ করুন"
                              >
                                <HandCoins className="h-3.5 w-3.5" />
                                <span>টাকা জমা</span>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                className="h-8 rounded-lg text-emerald-700 bg-emerald-50 text-xs border-emerald-200"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> ক্লিয়ার্ড
                              </Button>
                            )}

                            {/* Payment History Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setHistoryRow(r)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="পেমেন্ট হিস্ট্রি দেখুন"
                            >
                              <History className="h-3.5 w-3.5" />
                            </Button>

                            {/* Sale Reprint Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reprintSale(r.id)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="ইনভয়েস প্রিন্ট"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </FoldTable>
          </div>

          {/* Pagination Controls */}
          {totalInvoicePages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 bg-muted/20 text-xs flex-wrap gap-2">
              <span className="text-muted-foreground">
                মোট {filteredRows.length.toLocaleString()} টির মধ্যে {((invoicePage - 1) * INVOICE_PAGE_SIZE) + 1} হতে {Math.min(invoicePage * INVOICE_PAGE_SIZE, filteredRows.length).toLocaleString()} টি দেখানো হচ্ছে
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={invoicePage <= 1}
                  onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                  className="h-7.5 px-3 text-xs"
                >
                  পূর্ববর্তী
                </Button>
                <span className="font-semibold px-2">
                  পাতা {invoicePage} / {totalInvoicePages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={invoicePage >= totalInvoicePages}
                  onClick={() => setInvoicePage((p) => Math.min(totalInvoicePages, p + 1))}
                  className="h-7.5 px-3 text-xs"
                >
                  পরবর্তী
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CUSTOMER DUE LEDGER */}
      {tab === "customers" && (
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <FoldTable className="w-full text-sm min-w-[850px]">
              <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground border-b border-border/80">
                <tr>
                  <th className="text-left p-3.5">কাস্টমার / গ্রাহক</th>
                  <th className="text-left p-3.5">মোবাইল নং</th>
                  <th className="text-center p-3.5">বকেয়া চালান সংখ্যা</th>
                  <th className="text-right p-3.5">মোট ক্রয়মূল্য</th>
                  <th className="text-right p-3.5">মোট পরিশোধিত</th>
                  <th className="text-right p-3.5">মোট বকেয়া (Net Due)</th>
                  <th className="text-right p-3.5">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {customerLedgers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      কোনো কাস্টমার পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((c, idx) => (
                    <tr key={c.id || `walkin-${idx}`} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-semibold text-foreground">
                        {c.name}
                        {c.address ? <div className="text-xs text-muted-foreground font-normal">{c.address}</div> : null}
                      </td>
                      <td className="p-3.5 font-mono text-xs text-muted-foreground">{c.mobile || "—"}</td>
                      <td className="p-3.5 text-center">
                        <Badge
                          variant="outline"
                          className={
                            c.dueInvoicesCount > 0
                              ? "border-rose-500/40 text-rose-600 bg-rose-500/10 font-bold"
                              : "border-border text-muted-foreground"
                          }
                        >
                          {c.dueInvoicesCount} টি চালান
                        </Badge>
                      </td>
                      <td className="p-3.5 text-right font-mono font-medium">{money(c.totalBill)}</td>
                      <td className="p-3.5 text-right font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                        {money(c.totalPaid)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-base">
                        {c.totalDue > 0.001 ? (
                          <span className="text-rose-600 dark:text-rose-400">{money(c.totalDue)}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">পরিশোধিত</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {c.totalDue > 0.001 ? (
                            <Button
                              size="sm"
                              onClick={() => openBulkPayModal(c)}
                              className="h-8 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold gap-1 px-3"
                              title="কাস্টমারের সম্পূর্ণ বা আংশিক বকেয়া জমা নিন"
                            >
                              <HandCoins className="h-3.5 w-3.5" />
                              <span>বকেয়া আদায়</span>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground mr-2">পরিশোধিত</span>
                          )}

                          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                            <Link to="/contacts">লেজার দেখুন</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </FoldTable>
          </div>

          {/* Customer Ledger Pagination Controls */}
          {totalCustomerPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 bg-muted/20 text-xs flex-wrap gap-2">
              <span className="text-muted-foreground">
                মোট {customerLedgers.length.toLocaleString()} জন কাস্টমারের মধ্যে {((customerPage - 1) * CUSTOMER_PAGE_SIZE) + 1} হতে {Math.min(customerPage * CUSTOMER_PAGE_SIZE, customerLedgers.length).toLocaleString()} জন দেখানো হচ্ছে
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={customerPage <= 1}
                  onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                  className="h-7.5 px-3 text-xs"
                >
                  পূর্ববর্তী
                </Button>
                <span className="font-semibold px-2">
                  পাতা {customerPage} / {totalCustomerPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={customerPage >= totalCustomerPages}
                  onClick={() => setCustomerPage((p) => Math.min(totalCustomerPages, p + 1))}
                  className="h-7.5 px-3 text-xs"
                >
                  পরবর্তী
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SINGLE INVOICE PAYMENT / CLEAR DUE MODAL */}
      <Dialog open={!!payRow} onOpenChange={(o) => !o && setPayRow(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <HandCoins className="h-5 w-5 text-rose-600" />
              <span>বকেয়া টাকা জমা ও পরিশোধ (Pay Due)</span>
            </DialogTitle>
          </DialogHeader>

          {payRow && (
            <div className="space-y-4 pt-1">
              {/* Invoice Summary Card */}
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">চালান নং:</span>
                  <span className="font-mono font-bold text-primary">{payRow.invoice_no ?? payRow.ref_no ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">কাস্টমার:</span>
                  <span className="font-bold text-foreground">{payRow.contact?.name ?? "Walk-in Customer"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">মোট বিল:</span>
                  <span className="font-mono">{money(Number(payRow.final_total || 0))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">পূর্বে পরিশোধিত:</span>
                  <span className="font-mono text-emerald-700">{money(Number(payRow.total_paid || 0))}</span>
                </div>
                <div className="border-t border-rose-500/20 pt-2 flex justify-between items-center text-sm font-bold text-rose-600">
                  <span>বর্তমান বকেয়া:</span>
                  <span className="font-mono text-base font-extrabold">
                    {money(Math.max(0, Number(payRow.final_total || 0) - Number(payRow.total_paid || 0)))}
                  </span>
                </div>
              </div>

              {/* Payment Amount Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold">আদায়কৃত টাকার পরিমাণ (Amount to Pay) *</Label>
                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const rem = Math.max(0, Number(payRow.final_total || 0) - Number(payRow.total_paid || 0));
                        setPayAmount(rem.toFixed(2));
                      }}
                      className="text-[11px] font-bold text-rose-600 hover:underline px-1.5 py-0.5 rounded bg-rose-50"
                    >
                      সম্পূর্ণ বকেয়া
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const rem = Math.max(0, Number(payRow.final_total || 0) - Number(payRow.total_paid || 0));
                        setPayAmount((rem / 2).toFixed(2));
                      }}
                      className="text-[11px] font-medium text-muted-foreground hover:underline px-1.5 py-0.5 rounded bg-muted"
                    >
                      ৫০% টাকা
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm text-primary">৳</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-8 text-base font-bold font-mono h-11"
                    autoFocus
                  />
                </div>

                {/* Live Remaining Preview */}
                {(() => {
                  const rem = Math.max(0, Number(payRow.final_total || 0) - Number(payRow.total_paid || 0));
                  const entered = parseFloat(payAmount) || 0;
                  const newBal = Math.max(0, rem - entered);
                  return (
                    <div className="flex items-center justify-between text-[11px] pt-1 px-1">
                      <span className="text-muted-foreground">জমা দেওয়ার পর অবশিষ্ট বকেয়া:</span>
                      <span className={`font-mono font-bold ${newBal <= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {newBal <= 0 ? "সম্পূর্ণ পরিশোধিত (Cleared)" : money(newBal)}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">পরিশোধের মাধ্যম (Payment Method)</Label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-input px-3 text-xs"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">আদায়ের তারিখ ও সময় (Collection Date)</Label>
                <Input
                  type="datetime-local"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">নোট / মন্তব্য (Optional Note)</Label>
                <Input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="বকেয়া আদায় / মন্তব্য..."
                  className="h-9 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 gap-2">
            <Button variant="outline" onClick={() => setPayRow(null)} disabled={payMutation.isPending}>
              বাতিল
            </Button>
            <Button
              onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending || !payAmount || parseFloat(payAmount) <= 0}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {payMutation.isPending ? "জমা হচ্ছে..." : "বকেয়া পরিশোধ ও টোটাল এ যোগ করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK CUSTOMER SETTLEMENT MODAL */}
      <Dialog open={!!bulkCustomer} onOpenChange={(o) => !o && setBulkCustomer(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Users className="h-5 w-5 text-rose-600" />
              <span>এককালীন কাস্টমার বকেয়া আদায়</span>
            </DialogTitle>
          </DialogHeader>

          {bulkCustomer && (
            <div className="space-y-4 pt-1">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">কাস্টমার নাম:</span>
                  <span className="font-bold text-foreground">{bulkCustomer.name}</span>
                </div>
                {bulkCustomer.mobile && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">মোবাইল:</span>
                    <span className="font-mono">{bulkCustomer.mobile}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">মোট বাকি চালান:</span>
                  <span className="font-bold">{bulkCustomer.invoices.length} টি</span>
                </div>
                <div className="border-t border-rose-500/20 pt-2 flex justify-between items-center text-sm font-bold text-rose-600">
                  <span>সর্বমোট বকেয়া:</span>
                  <span className="font-mono text-base font-extrabold">{money(bulkCustomer.totalDue)}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-muted text-[11px] text-muted-foreground">
                ℹ️ টাকা জমা দিলে পুরাতন চালান থেকে শুরু করে ক্রমানুসারে (FIFO) স্বয়ংক্রিয়ভাবে বকেয়া সমন্বয় হবে এবং
                টোটাল কালেকশনে যুক্ত হবে।
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">আদায়কৃত মোট টাকার পরিমাণ *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm text-primary">৳</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bulkAmount}
                    onChange={(e) => setBulkAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-8 text-base font-bold font-mono h-11"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">পরিশোধের মাধ্যম</Label>
                <select
                  value={bulkMethod}
                  onChange={(e) => setBulkMethod(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-input px-3 text-xs"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">আদায়ের তারিখ</Label>
                <Input
                  type="datetime-local"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 gap-2">
            <Button variant="outline" onClick={() => setBulkCustomer(null)} disabled={bulkPayMutation.isPending}>
              বাতিল
            </Button>
            <Button
              onClick={() => bulkPayMutation.mutate()}
              disabled={bulkPayMutation.isPending || !bulkAmount || parseFloat(bulkAmount) <= 0}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {bulkPayMutation.isPending ? "সমন্বয় হচ্ছে..." : "বকেয়া সমন্বয় ও জমা করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PAYMENT HISTORY DIALOG */}
      <Dialog open={!!historyRow} onOpenChange={(o) => !o && setHistoryRow(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <History className="h-5 w-5 text-primary" />
              <span>পেমেন্ট ইতিহাস (Payment History)</span>
            </DialogTitle>
          </DialogHeader>

          {historyRow && (
            <div className="space-y-3 pt-1">
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>চালান নং: <b>{historyRow.invoice_no ?? historyRow.ref_no}</b></span>
                <span>মোট বিল: <b>{money(Number(historyRow.final_total || 0))}</b></span>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="p-2.5 text-left">তারিখ</th>
                      <th className="p-2.5 text-left">মাধ্যম</th>
                      <th className="p-2.5 text-right">টাকার পরিমাণ</th>
                      <th className="p-2.5 text-left">নোট</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {historyLoading ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-muted-foreground">
                          হিস্ট্রি লোড হচ্ছে...
                        </td>
                      </tr>
                    ) : historyPayments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-muted-foreground">
                          এখনো কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি।
                        </td>
                      </tr>
                    ) : (
                      historyPayments.map((p) => (
                        <tr key={p.id}>
                          <td className="p-2.5 whitespace-nowrap">{fmtDateTime(p.paid_on || p.created_at)}</td>
                          <td className="p-2.5 uppercase font-medium">{p.method}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-600">
                            {money(Number(p.amount || 0))}
                          </td>
                          <td className="p-2.5 text-muted-foreground">{p.note || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryRow(null)}>
              বন্ধ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
