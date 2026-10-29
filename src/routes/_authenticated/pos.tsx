import { formatDate, formatDateTime } from "@/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  X,
  ScanLine,
  Smartphone,
  ScanText,
  UserPlus,
  Clock,
  Printer,
  FolderArchive,
  CreditCard,
  Banknote,
  Building2,
  AlertCircle,
  PackageCheck,
  Check,
  RotateCcw,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { PhoneScanDialog } from "@/components/PhoneScanDialog";
import { OcrScanner } from "@/components/OcrScanner";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "POS — Sheikh Pharma & QweekPOS" }] }),
  component: PosScreen,
});

type CartLine = {
  variation_id: string;
  product_id: string;
  name: string;
  sub_sku: string;
  original_price: number;
  unit_price: number;
  quantity: number;
  total_amount: number;
};

type SaleSnapshot = {
  invoice_no: string;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  payment_method: string;
  customer_name: string | null;
  date: string;
};

type FlatItem = {
  variation_id: string;
  product_id: string;
  name: string;
  variant_label: string | null;
  sub_sku: string;
  barcode: string;
  price: number;
  stock: number;
  image: string | null;
  category_id: string | null;
};

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash (নগদ)" },
  { id: "bkash", label: "bKash (বিকাশ)" },
  { id: "nagad", label: "Nagad (নগদ)" },
  { id: "rocket", label: "Rocket (রকেট)" },
  { id: "card", label: "Card (কার্ড)" },
  { id: "bank_transfer", label: "Bank (ব্যাংক)" },
  { id: "due", label: "Due / Credit (বাকী)" },
];

function PosScreen() {
  const { data: business } = useCurrentBusiness();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [locationId, setLocationId] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [scanOpen, setScanOpen] = useState(false);
  const [phoneScanOpen, setPhoneScanOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [lastSale, setLastSale] = useState<SaleSnapshot | null>(null);
  const [printWidth, setPrintWidth] = useState<"58" | "80" | "A4">("80");

  // Modals
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [draftsModalOpen, setDraftsModalOpen] = useState(false);
  const [recentSalesModalOpen, setRecentSalesModalOpen] = useState(false);

  // New Customer Form State
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [custSaving, setCustSaving] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartScrollRef = useRef<HTMLDivElement>(null);
  const lastLineRef = useRef<HTMLDivElement>(null);
  const prevCartLen = useRef(0);

  // Auto-save the in-progress cart so a power cut does not lose it.
  const { clearDraft: clearPosDraft } = useAutosaveDraft(
    business?.id ? `pos:${business.id}` : null,
    { cart, discount, discountType, paymentMethod, amountPaid, contactId },
    (d) => {
      if (d.cart?.length) setCart(d.cart);
      if (d.discount) setDiscount(d.discount);
      if (d.discountType) setDiscountType(d.discountType);
      if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
      if (d.amountPaid) setAmountPaid(d.amountPaid);
      if (d.contactId) setContactId(d.contactId);
    },
    { isEmpty: (d) => !d.cart?.length, restoreMessage: "Unsaved cart restored" },
  );

  useEffect(() => {
    if (cart.length > prevCartLen.current) {
      lastLineRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevCartLen.current = cart.length;
  }, [cart.length]);

  // Keyboard Shortcuts (F2: Search focus, F4: Finalize, F8: Hold / Draft)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        if (cart.length > 0 && !save.isPending) {
          save.mutate(false);
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        if (cart.length > 0 && !save.isPending) {
          save.mutate(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length]);

  // Locations — auto-pick first
  const { data: locations = [] } = useQuery({
    queryKey: ["locations", business?.id],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("business_locations")
        .select("id, name, landmark, city, state, country, zip_code, mobile, alternate_number, email")
        .eq("business_id", business!.id);
      return data ?? [];
    },
    enabled: !!business,
  });

  useEffect(() => {
    if (!locationId && locations.length > 0) {
      setLocationId(locations[0].id);
    }
  }, [locationId, locations]);

  const currentLocation = locations.find((l: any) => l.id === locationId) as any;
  const locAddress =
    (currentLocation
      ? [currentLocation.landmark, currentLocation.city, currentLocation.state, currentLocation.zip_code, currentLocation.country]
          .filter(Boolean)
          .join(", ")
      : "") || (business?.address ?? "");
  const locMobile =
    (currentLocation ? [currentLocation.mobile, currentLocation.alternate_number].filter(Boolean).join(" / ") : "") ||
    (business?.notify_phone ?? "");

  // Customers
  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ["contacts-customers", business?.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, mobile, address_line_1")
        .eq("business_id", business!.id)
        .in("type", ["customer", "both"])
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
    enabled: !!business,
  });

  // Product Categories
  const { data: categories = [] } = useQuery({
    queryKey: ["pos-categories", business?.id],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .eq("business_id", business!.id)
        .order("name");
      return data ?? [];
    },
    enabled: !!business,
  });

  // Products with variations and inventory
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["pos-products", business?.id],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const PAGE = 1000;
      const all: any[] = [];
      let pageCount = 0;
      for (let from = 0; pageCount < 50; from += PAGE) {
        pageCount++;
        const { data, error } = await supabase
          .from("products")
          .select(`
            id, name, sku, image, barcode, category_id,
            variations:variations!variations_product_id_fkey(
              id, name, sub_sku, barcode, default_sell_price, mrp,
              variation_location_details(qty_available, location_id)
            )
          `)
          .eq("business_id", business!.id)
          .eq("is_inactive", false)
          .eq("not_for_selling", false)
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) {
          toast.error(`Load products: ${error.message}`);
          return all;
        }
        const batch = data ?? [];
        all.push(...batch);
        if (batch.length < PAGE) break;
      }
      return all;
    },
    enabled: !!business,
  });

  // Held Drafts
  const { data: heldDrafts = [], refetch: refetchDrafts } = useQuery({
    queryKey: ["pos-drafts", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id, invoice_no, final_total, total_before_tax, discount_amount, created_at, contact_id,
          contacts:contacts(name, mobile),
          lines:transaction_sell_lines(product_id, variation_id, quantity, unit_price)
        `)
        .eq("business_id", business!.id)
        .eq("type", "sell")
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!business,
  });

  // Recent Sales for Reprint
  const { data: recentSales = [], refetch: refetchRecentSales } = useQuery({
    queryKey: ["pos-recent-sales", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id, invoice_no, final_total, total_paid, payment_status, created_at, contact_id,
          contacts:contacts(name, mobile)
        `)
        .eq("business_id", business!.id)
        .eq("type", "sell")
        .eq("status", "final")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!business,
  });

  // Flatten items
  const allItems: FlatItem[] = useMemo(() => {
    const out: FlatItem[] = [];
    for (const p of products as any[]) {
      for (const v of p.variations ?? []) {
        const vld = (v.variation_location_details ?? []).find((d: any) => d.location_id === locationId);
        const hasVariant = v.name && v.name !== "DUMMY";
        out.push({
          variation_id: v.id,
          product_id: p.id,
          name: p.name ?? "Unnamed product",
          variant_label: hasVariant ? v.name : null,
          sub_sku: v.sub_sku || p.sku || "",
          barcode: (v.barcode || p.barcode || "") as string,
          price: Number(v.mrp ?? v.default_sell_price ?? 0),
          stock: vld ? Number(vld.qty_available) : 0,
          image: p.image,
          category_id: p.category_id || null,
        });
      }
    }
    return out;
  }, [products, locationId]);

  // Filtered items based on search and category
  const filteredItems: FlatItem[] = useMemo(() => {
    let list = allItems;
    if (selectedCategory !== "all") {
      list = list.filter((i) => i.category_id === selectedCategory);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.sub_sku.toLowerCase().includes(q) ||
          (i.barcode && i.barcode.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [allItems, selectedCategory, search]);

  // Cart operations
  function addToCart(item: FlatItem) {
    setCart((c) => {
      const idx = c.findIndex((l) => l.variation_id === item.variation_id);
      if (idx >= 0) {
        return c.map((l, i) => {
          if (i !== idx) return l;
          const nextQty = l.quantity + 1;
          const unitPrice = l.unit_price > 0 ? l.unit_price : item.price;
          return {
            ...l,
            quantity: nextQty,
            unit_price: unitPrice,
            total_amount: Number((unitPrice * nextQty).toFixed(2)),
          };
        });
      }
      return [
        ...c,
        {
          variation_id: item.variation_id,
          product_id: item.product_id,
          name: item.variant_label ? `${item.name} — ${item.variant_label}` : item.name,
          sub_sku: item.sub_sku,
          original_price: item.price,
          unit_price: item.price,
          quantity: 1,
          total_amount: item.price,
        },
      ];
    });
  }

  function updateQty(variation_id: string, q: number) {
    if (q <= 0) {
      removeLine(variation_id);
      return;
    }
    setCart((c) =>
      c.map((l) => {
        if (l.variation_id !== variation_id) return l;
        const qty = Math.max(0, q);
        const unit_price = l.unit_price > 0 ? l.unit_price : l.original_price;
        return { ...l, quantity: qty, total_amount: Number((unit_price * qty).toFixed(2)) };
      }),
    );
  }

  function updateTotal(variation_id: string, t: number) {
    setCart((c) =>
      c.map((l) => {
        if (l.variation_id !== variation_id) return l;
        const total_amount = Math.max(0, t);
        const unit_price = l.quantity > 0 ? total_amount / l.quantity : 0;
        return { ...l, total_amount, unit_price };
      }),
    );
  }

  function removeLine(variation_id: string) {
    setCart((c) => c.filter((l) => l.variation_id !== variation_id));
  }

  function clearCart() {
    if (cart.length === 0) return;
    if (confirm("Are you sure you want to clear the entire cart?")) {
      setCart([]);
      setDiscount(0);
      setAmountPaid("");
      clearPosDraft();
      toast.info("Cart cleared");
    }
  }

  // Calculations
  const subtotal = cart.reduce((s, l) => s + l.quantity * l.original_price, 0);
  const lineDiscount = cart.reduce((s, l) => s + Math.max(0, l.quantity * l.original_price - l.total_amount), 0);
  const extraDiscount = discountType === "percent" ? (subtotal * discount) / 100 : discount;
  const totalDiscount = lineDiscount + extraDiscount;
  const total = Math.max(0, subtotal - totalDiscount);
  const paidNum = amountPaid ? Number(amountPaid) : total;
  const change = paidNum - total;

  // Save / Finalize Sale Mutation
  const save = useMutation({
    mutationFn: async (draft: boolean) => {
      if (!business) throw new Error("No business");
      if (!locationId) throw new Error("Select a location");
      if (cart.length === 0) throw new Error("Cart is empty");

      const d = new Date();
      const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      const rand = Math.floor(10000 + Math.random() * 90000);
      const invoiceNo = `SKP-${datePart}-${rand}`;
      const paid = draft ? 0 : Math.min(paidNum, total);
      const payment_status = draft ? "due" : paid >= total ? "paid" : paid > 0 ? "partial" : "due";

      const { data: tx, error } = await supabase
        .from("transactions")
        .insert({
          business_id: business.id,
          location_id: locationId,
          type: "sell",
          status: draft ? "draft" : "final",
          payment_status,
          contact_id: contactId || null,
          invoice_no: invoiceNo,
          total_before_tax: subtotal,
          discount_amount: totalDiscount,
          final_total: total,
          total_paid: paid,
        })
        .select("id")
        .single();
      if (error) throw error;

      const lines = cart.map((l) => ({
        transaction_id: tx.id,
        product_id: l.product_id,
        variation_id: l.variation_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        unit_price_inc_tax: l.unit_price,
        line_discount_amount: Math.max(0, l.quantity * l.original_price - l.total_amount),
      }));
      const { error: lerr } = await supabase.from("transaction_sell_lines").insert(lines);
      if (lerr) throw lerr;

      if (!draft && paid > 0) {
        await supabase.from("transaction_payments").insert({
          transaction_id: tx.id,
          business_id: business.id,
          amount: paid,
          method: paymentMethod,
        });
      }

      // Decrement stock for finalized sale
      if (!draft) {
        for (const l of cart) {
          const { data: existing } = await supabase
            .from("variation_location_details")
            .select("id, qty_available")
            .eq("variation_id", l.variation_id)
            .eq("location_id", locationId)
            .maybeSingle();
          if (existing) {
            await supabase
              .from("variation_location_details")
              .update({
                qty_available: Number(existing.qty_available) - l.quantity,
              })
              .eq("id", existing.id);
          } else {
            await supabase.from("variation_location_details").insert({
              product_id: l.product_id,
              variation_id: l.variation_id,
              location_id: locationId,
              qty_available: -l.quantity,
            });
          }
        }
      }

      const snapshot: SaleSnapshot | null = draft
        ? null
        : {
            invoice_no: invoiceNo,
            lines: cart,
            subtotal,
            discount: totalDiscount,
            total,
            paid,
            change: paid - total,
            payment_method: paymentMethod,
            customer_name: contacts.find((c: any) => c.id === contactId)?.name ?? null,
            date: formatDateTime(new Date()),
          };
      return { id: tx.id, snapshot };
    },
    onSuccess: ({ snapshot }) => {
      toast.success(snapshot ? "Sale finalized successfully!" : "Sale held as Draft!");
      if (snapshot) setLastSale(snapshot);
      clearPosDraft();
      setCart([]);
      setDiscount(0);
      setAmountPaid("");
      setContactId("");
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      refetchDrafts();
      refetchRecentSales();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Resume Draft into Cart
  async function resumeDraft(draft: any) {
    try {
      const restoredLines: CartLine[] = [];
      for (const line of draft.lines ?? []) {
        const matchingItem = allItems.find((i) => i.variation_id === line.variation_id);
        restoredLines.push({
          variation_id: line.variation_id,
          product_id: line.product_id,
          name: matchingItem
            ? matchingItem.variant_label
              ? `${matchingItem.name} — ${matchingItem.variant_label}`
              : matchingItem.name
            : "Product",
          sub_sku: matchingItem?.sub_sku || "",
          original_price: matchingItem?.price ?? Number(line.unit_price || 0),
          unit_price: Number(line.unit_price || 0),
          quantity: Number(line.quantity || 1),
          total_amount: Number((Number(line.unit_price || 0) * Number(line.quantity || 1)).toFixed(2)),
        });
      }
      setCart(restoredLines);
      if (draft.contact_id) setContactId(draft.contact_id);
      if (draft.discount_amount) {
        setDiscount(Number(draft.discount_amount));
        setDiscountType("flat");
      }
      // Delete draft row so it transitions to active
      await supabase.from("transactions").delete().eq("id", draft.id);
      refetchDrafts();
      setDraftsModalOpen(false);
      toast.success(`Draft ${draft.invoice_no || ""} restored to cart!`);
    } catch (err: any) {
      toast.error(`Failed to resume draft: ${err.message}`);
    }
  }

  // Delete Draft
  async function deleteDraft(draftId: string) {
    if (!confirm("Are you sure you want to discard this draft?")) return;
    try {
      await supabase.from("transactions").delete().eq("id", draftId);
      refetchDrafts();
      toast.info("Draft discarded");
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  }

  // Reprint Recent Sale
  async function triggerReprintSale(saleId: string) {
    try {
      const { data: tx, error } = await supabase
        .from("transactions")
        .select(`
          id, invoice_no, final_total, total_before_tax, discount_amount, total_paid, created_at, contact_id,
          contacts:contacts(name),
          lines:transaction_sell_lines(product_id, variation_id, quantity, unit_price),
          payments:transaction_payments(method)
        `)
        .eq("id", saleId)
        .single();
      if (error) throw error;

      const lines: CartLine[] = (tx.lines ?? []).map((l: any) => {
        const item = allItems.find((i) => i.variation_id === l.variation_id);
        const qty = Number(l.quantity || 1);
        const price = Number(l.unit_price || 0);
        return {
          variation_id: l.variation_id,
          product_id: l.product_id,
          name: item?.name ?? "Item",
          sub_sku: item?.sub_sku ?? "",
          original_price: item?.price ?? price,
          unit_price: price,
          quantity: qty,
          total_amount: price * qty,
        };
      });

      const snapshot: SaleSnapshot = {
        invoice_no: tx.invoice_no || "N/A",
        lines,
        subtotal: Number(tx.total_before_tax || tx.final_total || 0),
        discount: Number(tx.discount_amount || 0),
        total: Number(tx.final_total || 0),
        paid: Number(tx.total_paid || tx.final_total || 0),
        change: Math.max(0, Number(tx.total_paid || 0) - Number(tx.final_total || 0)),
        payment_method: (tx.payments?.[0] as any)?.method || "cash",
        customer_name: (tx.contacts as any)?.name ?? null,
        date: formatDateTime(new Date(tx.created_at)),
      };

      setRecentSalesModalOpen(false);
      setLastSale(snapshot);
      toast.success("Receipt loaded for reprint");
    } catch (err: any) {
      toast.error(`Reprint error: ${err.message}`);
    }
  }

  // Create Quick Customer
  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !newCustName.trim()) return;
    setCustSaving(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          business_id: business.id,
          name: newCustName.trim(),
          mobile: newCustPhone.trim() || null,
          address_line_1: newCustAddress.trim() || null,
          type: "customer",
          is_active: true,
        })
        .select("id, name")
        .single();
      if (error) throw error;

      toast.success(`Customer ${data.name} created!`);
      await refetchContacts();
      setContactId(data.id);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustAddress("");
      setCustomerModalOpen(false);
    } catch (err: any) {
      toast.error(`Failed to add customer: ${err.message}`);
    } finally {
      setCustSaving(false);
    }
  }

  const [pickerMatches, setPickerMatches] = useState<FlatItem[]>([]);
  const [pickerCode, setPickerCode] = useState("");

  const handleScannedCode = (code: string) => {
    const c = code.trim().toLowerCase();
    const matches = allItems.filter((i) => (i.barcode && i.barcode.toLowerCase() === c) || i.sub_sku.toLowerCase() === c);
    if (matches.length === 1) {
      addToCart(matches[0]);
      toast.success(`Added: ${matches[0].name}`);
    } else if (matches.length > 1) {
      setPickerCode(code);
      setPickerMatches(matches);
    } else {
      setSearch(code);
      toast.message(`No product for "${code}"`);
    }
  };

  const handleOcrText = (raw: string) => {
    const clean = raw.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    if (!clean) {
      toast.error("No readable text");
      return;
    }
    const words = clean.split(" ").filter((w) => w.length >= 3);
    const scored: { item: any; score: number }[] = [];
    for (const it of allItems) {
      const nameWords = it.name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w: string) => w.length >= 3);
      if (!nameWords.length) continue;
      let hits = 0;
      for (const nw of nameWords) if (words.some((w) => w.includes(nw) || nw.includes(w))) hits++;
      const score = hits / nameWords.length;
      if (score > 0) scored.push({ item: it, score });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3).map((s) => s.item);
    if (top.length === 0) {
      setSearch(words.slice(0, 3).join(" "));
      toast.message(`No match. Showing results for "${words.slice(0, 3).join(" ")}"`);
      return;
    }
    setPickerCode(words.slice(0, 4).join(" "));
    setPickerMatches(top);
  };

  if (!business) return null;

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-3rem)]">
      {/* LEFT: PRODUCT CATALOG & GRID */}
      <div className="flex-1 flex flex-col border-r border-border/60 min-h-0 bg-background">
        {/* Top Header Bar */}
        <div className="p-3.5 border-b border-border/60 space-y-3 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 mr-auto">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                <ShoppingCart className="h-4 w-4" />
              </span>
              <div>
                <h1 className="font-display text-base font-bold leading-none">Point of Sale</h1>
                <span className="text-[11px] text-muted-foreground">{business.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Drafts Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraftsModalOpen(true)}
                className="h-8.5 rounded-lg border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 text-xs gap-1.5 cursor-pointer"
                title="View Held Orders / Drafts (F8)"
              >
                <FolderArchive className="h-3.5 w-3.5 text-amber-600" />
                <span>Held Drafts ({heldDrafts.length})</span>
              </Button>

              {/* Recent Sales Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecentSalesModalOpen(true)}
                className="h-8.5 rounded-lg border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-200 hover:bg-blue-500/20 text-xs gap-1.5 cursor-pointer"
                title="Recent Sales & Invoice Reprint"
              >
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span>Recent Invoices</span>
              </Button>

              <Link
                to="/products/short-list"
                className="inline-flex h-8.5 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-medium hover:bg-muted"
              >
                Short List
              </Link>

              {/* Location Selector */}
              <select
                className="h-8.5 rounded-lg border border-border bg-input px-2.5 text-xs font-medium"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">— Select Location —</option>
                {locations.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Bar & Scanners */}
          <div className="relative space-y-2 sm:space-y-0 sm:flex sm:gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                placeholder="Search medicine name, SKU, or barcode (F2)…"
                className="w-full h-10 rounded-xl border border-border bg-input pl-9 pr-9 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredItems.length > 0) {
                      const top = filteredItems[0];
                      addToCart(top);
                      if (top.stock <= 0) {
                        toast.warning(`${top.name} is out of stock!`);
                      } else {
                        toast.success(`Added ${top.name}`);
                      }
                      setSearch("");
                    }
                  } else if (e.key === "Escape") {
                    setSearch("");
                  }
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex gap-1.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScanOpen(true)}
                className="h-10 px-3 rounded-xl border border-border bg-card hover:bg-accent flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title="Camera Barcode Scanner"
              >
                <ScanLine className="h-4 w-4 text-primary shrink-0" />
                <span>Scan</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPhoneScanOpen(true)}
                className="h-10 px-3 rounded-xl border border-border bg-card hover:bg-accent flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title="Use phone camera as wireless barcode reader"
              >
                <Smartphone className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Phone</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOcrOpen(true)}
                className="h-10 px-3 rounded-xl border border-border bg-card hover:bg-accent flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title="Read medicine name from packet via OCR"
              >
                <ScanText className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>OCR</span>
              </Button>
            </div>
          </div>

          {/* Category Filter Pills (Quick filter for search) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar text-xs">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`h-7 px-3 rounded-lg border font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              All Categories ({allItems.length})
            </button>
            {categories.map((c: any) => {
              const count = allItems.filter((i) => i.category_id === c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`h-7 px-3 rounded-lg border font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === c.id
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {c.name} {count > 0 ? `(${count})` : ""}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area: Search Results or Fast Pharmacy Dashboard */}
        <div className="flex-1 overflow-y-auto p-4">
          {productsLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading medicines & catalog…</span>
            </div>
          ) : search.trim() || selectedCategory !== "all" ? (
            /* Search Results Mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>
                  Found <strong className="text-foreground">{filteredItems.length}</strong> matching medicine{filteredItems.length === 1 ? "" : "s"}
                </span>
                <span className="text-[11px]">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono font-bold text-[10px]">Enter</kbd> to add top match
                </span>
              </div>

              {filteredItems.length === 0 ? (
                <div className="text-center py-16 space-y-3 bg-muted/20 rounded-2xl border border-dashed border-border/70 p-6">
                  <div className="h-12 w-12 rounded-2xl bg-muted/60 grid place-items-center mx-auto text-xl">🔍</div>
                  <p className="text-sm font-semibold text-foreground">No medicine found for "{search}"</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Check spelling or search by SKU, generic name, or barcode.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setSelectedCategory("all");
                    }}
                    className="rounded-lg h-8 text-xs font-medium cursor-pointer"
                  >
                    Clear Filter & Search
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs divide-y divide-border/60">
                  {filteredItems.slice(0, 50).map((item, idx) => {
                    const inCart = cart.find((c) => c.variation_id === item.variation_id);
                    const isOutOfStock = item.stock <= 0;
                    return (
                      <div
                        key={item.variation_id}
                        onClick={() => {
                          addToCart(item);
                          if (isOutOfStock) toast.warning(`${item.name} is out of stock!`);
                        }}
                        className={`p-3 flex items-center justify-between gap-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                          idx === 0 ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded-xl bg-muted/70 grid place-items-center text-sm shrink-0 border border-border/50">
                            {item.image ? (
                              <img src={item.image} alt="" className="h-full w-full object-cover rounded-xl" />
                            ) : (
                              "💊"
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                                {item.name}
                                {item.variant_label ? ` — ${item.variant_label}` : ""}
                              </span>
                              {idx === 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold shrink-0">
                                  Top Match (Enter)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              <span className="font-mono">SKU: {item.sub_sku}</span>
                              {item.barcode && <span className="font-mono">· Barcode: {item.barcode}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                              item.stock > 10
                                ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                                : item.stock > 0
                                  ? "border-amber-500/40 text-amber-600 bg-amber-500/10"
                                  : "border-destructive/40 text-destructive bg-destructive/10"
                            }`}
                          >
                            {item.stock > 0 ? `${item.stock} in stock` : "0 stock"}
                          </Badge>

                          <div className="text-right min-w-[70px]">
                            <div className="text-sm font-bold text-primary">৳{item.price.toFixed(2)}</div>
                          </div>

                          <Button
                            size="sm"
                            variant={inCart ? "default" : "outline"}
                            className="h-8 px-2.5 rounded-lg text-xs font-semibold gap-1 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(item);
                              if (isOutOfStock) toast.warning(`${item.name} is out of stock!`);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{inCart ? `Add (${inCart.quantity})` : "Add"}</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Default Pharmacy POS Workspace (Clean & Fast when no search) */
            <div className="space-y-4">
              {/* Ready Status Banner */}
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Fast Pharmacy POS Ready
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Type medicine name/SKU in the search box above or scan with a barcode reader to add directly to sale cart.
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <kbd className="px-2 py-1 rounded bg-background border font-mono font-bold text-xs shadow-2xs">F2</kbd>
                  <span className="text-muted-foreground">Search</span>
                </div>
              </div>

              {/* Quick Actions Grid: Held Drafts & Recent Sales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Held Drafts Box */}
                <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderArchive className="h-4 w-4 text-amber-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Held Drafts ({heldDrafts.length})
                      </h3>
                    </div>
                    {heldDrafts.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDraftsModalOpen(true)}
                        className="h-6 text-[11px] text-amber-600 hover:text-amber-700 cursor-pointer"
                      >
                        View all
                      </Button>
                    )}
                  </div>

                  {heldDrafts.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No held orders. Press [F8] to hold an active cart.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {heldDrafts.slice(0, 3).map((d: any) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-foreground font-mono">{d.invoice_no}</span>
                            <span className="text-muted-foreground ml-2">৳{Number(d.final_total || 0).toFixed(2)}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resumeDraft(d)}
                            className="h-7 px-2 text-[11px] font-semibold text-amber-700 border-amber-500/40 cursor-pointer"
                          >
                            Resume
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Invoices Box */}
                <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Recent Sales ({recentSales.length})
                      </h3>
                    </div>
                    {recentSales.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRecentSalesModalOpen(true)}
                        className="h-6 text-[11px] text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        View all
                      </Button>
                    )}
                  </div>

                  {recentSales.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Completed sales will appear here for instant reprint.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {recentSales.slice(0, 3).map((s: any) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-foreground font-mono">{s.invoice_no}</span>
                            <span className="text-muted-foreground ml-2">৳{Number(s.final_total || 0).toFixed(2)}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => triggerReprintSale(s.id)}
                            className="h-7 px-2 text-[11px] font-semibold text-blue-700 border-blue-500/40 gap-1 cursor-pointer"
                          >
                            <Printer className="h-3 w-3" /> Reprint
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Keyboard Shortcuts Reference */}
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2.5 shadow-2xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Quick Keyboard Navigation
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono font-bold text-[11px]">F2</kbd>
                    <span className="text-muted-foreground">Focus Search</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono font-bold text-[11px]">Enter</kbd>
                    <span className="text-muted-foreground">Add Top Match</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono font-bold text-[11px]">F4</kbd>
                    <span className="text-muted-foreground">Finalize Sale</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono font-bold text-[11px]">F8</kbd>
                    <span className="text-muted-foreground">Hold Draft</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2 border-t border-border/50 bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono font-bold text-[10px]">F2</kbd> Focus Search
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono font-bold text-[10px]">F4</kbd> Finalize Sale
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono font-bold text-[10px]">F8</kbd> Hold Draft
            </span>
          </div>
          <span>{allItems.length} medicines in catalog</span>
        </div>
      </div>

      {/* RIGHT: CART & BILLING PANEL */}
      <div className="w-full lg:w-[420px] flex flex-col bg-card border-l border-border/60">
        {/* Customer Select & Quick Add */}
        <div className="p-3.5 border-b border-border/60 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Sale Cart ({cart.length})</h2>
            </div>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                title="Clear entire cart"
              >
                <Trash2 className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <select
              className="flex-1 h-9 rounded-xl border border-border bg-input px-3 text-xs font-medium"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            >
              <option value="">Walk-in customer</option>
              {contacts.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.mobile ? `(${c.mobile})` : ""}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomerModalOpen(true)}
              className="h-9 px-2.5 rounded-xl border-dashed border-primary/50 text-primary hover:bg-primary/10 text-xs font-semibold shrink-0 cursor-pointer"
              title="Add New Customer"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" /> New
            </Button>
          </div>
        </div>

        {/* Cart Item Rows */}
        <div ref={cartScrollRef} className="flex-1 overflow-y-auto p-2.5 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-muted/60 grid place-items-center text-xl">🛒</div>
              <p className="text-xs font-semibold">Your cart is empty</p>
              <p className="text-[11px] max-w-[200px]">Click any medicine from the catalog or scan barcode to add.</p>
            </div>
          ) : (
            cart.map((l, i) => (
              <div
                key={l.variation_id}
                ref={i === cart.length - 1 ? lastLineRef : undefined}
                className="rounded-xl bg-background border border-border/70 p-3 shadow-2xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold leading-tight text-foreground truncate">{l.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{l.sub_sku}</div>
                  </div>
                  <button
                    onClick={() => removeLine(l.variation_id)}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(l.variation_id, l.quantity - 1)}
                      className="h-6 w-6 grid place-items-center rounded-lg border border-border bg-card hover:bg-muted font-bold text-xs"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      type="number"
                      value={l.quantity === 0 ? "" : l.quantity}
                      onChange={(e) => updateQty(l.variation_id, e.target.value === "" ? 0 : Number(e.target.value))}
                      className="w-12 h-6 text-center rounded-lg border border-border bg-input text-xs font-bold font-mono"
                    />
                    <button
                      onClick={() => updateQty(l.variation_id, l.quantity + 1)}
                      className="h-6 w-6 grid place-items-center rounded-lg border border-border bg-card hover:bg-muted font-bold text-xs"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground">@ ৳{l.unit_price > 0 ? l.unit_price.toFixed(2) : l.original_price.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-primary">৳</span>
                    <input
                      type="number"
                      step="any"
                      value={l.total_amount === 0 ? "" : l.total_amount}
                      onChange={(e) => updateTotal(l.variation_id, e.target.value === "" ? 0 : Number(e.target.value))}
                      className="w-20 h-7 text-right rounded-lg border border-border bg-input px-2 text-xs font-bold font-mono focus:border-primary outline-none"
                    />
                  </div>
                </div>

                {l.quantity * l.original_price - l.total_amount > 0.0001 && (
                  <div className="flex justify-between text-[10px] font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    <span>Item Discount</span>
                    <span>-৳{(l.quantity * l.original_price - l.total_amount).toFixed(2)}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Calculation & Payment Controls */}
        <div className="p-3.5 border-t border-border/60 bg-muted/20 space-y-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono font-semibold">৳{subtotal.toFixed(2)}</span>
          </div>

          {lineDiscount > 0.0001 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Item Discount (auto)</span>
              <span>-৳{lineDiscount.toFixed(2)}</span>
            </div>
          )}

          {/* Extra Discount Controls */}
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Extra Discount</span>
              <div className="flex rounded-lg border border-border overflow-hidden bg-background text-[10px]">
                <button
                  type="button"
                  onClick={() => setDiscountType("flat")}
                  className={`px-2 py-0.5 font-bold ${discountType === "flat" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  ৳
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("percent")}
                  className={`px-2 py-0.5 font-bold ${discountType === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  %
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <input
                type="number"
                step="any"
                value={discount === 0 ? "" : discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-20 h-7 text-right rounded-lg border border-border bg-input px-2 text-xs font-mono font-semibold"
              />
              <span className="text-muted-foreground text-[10px]">{discountType === "percent" ? "%" : "৳"}</span>
            </div>
          </div>

          {/* Grand Total */}
          <div className="flex justify-between items-center text-sm font-bold border-t border-border/60 pt-2 text-foreground">
            <span>Grand Total</span>
            <span className="text-lg font-extrabold text-primary font-mono">৳{total.toFixed(2)}</span>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-medium text-muted-foreground">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-9 rounded-xl border border-border bg-input px-2.5 text-xs font-semibold"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>

              <input
                type="number"
                step="any"
                placeholder={`Paid (৳${total.toFixed(2)})`}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="h-9 rounded-xl border border-border bg-input px-3 text-xs font-bold font-mono focus:border-primary outline-none"
              />
            </div>

            {/* Quick Cash Buttons */}
            <div className="flex items-center gap-1 pt-1 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setAmountPaid(total > 0 ? String(total) : "")}
                className="px-2 py-1 rounded-md border border-primary/40 bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 shrink-0"
              >
                Exact (৳{total.toFixed(2)})
              </button>
              {[50, 100, 500, 1000].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setAmountPaid(String(num))}
                  className="px-2 py-1 rounded-md border border-border bg-background hover:bg-muted text-[10px] font-semibold shrink-0"
                >
                  ৳{num}
                </button>
              ))}
            </div>
          </div>

          {/* Change / Due display */}
          {amountPaid && (
            <div
              className={`flex justify-between items-center p-2 rounded-xl text-xs font-bold ${
                change >= 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 text-destructive"
              }`}
            >
              <span>{change >= 0 ? "Change to return (ফেরত)" : "Due amount (বকেয়া)"}</span>
              <span className="text-sm font-extrabold font-mono">৳{Math.abs(change).toFixed(2)}</span>
            </div>
          )}

          {/* Action Buttons: Hold Draft vs Finalize Sale */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => save.mutate(true)}
              disabled={save.isPending || cart.length === 0}
              className="h-11 rounded-xl font-bold border-amber-500/40 text-amber-900 dark:text-amber-100 hover:bg-amber-500/10 cursor-pointer text-xs"
              title="Hold this sale as Draft (F8)"
            >
              <FolderArchive className="h-4 w-4 mr-1 text-amber-600" />
              <span>Hold Draft (F8)</span>
            </Button>

            <Button
              type="button"
              onClick={() => save.mutate(false)}
              disabled={save.isPending || cart.length === 0}
              className="h-11 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow-md shadow-primary/20 cursor-pointer text-xs"
              title="Finalize Sale & Print Receipt (F4)"
            >
              <Check className="h-4 w-4 mr-1" />
              <span>{save.isPending ? "Finalizing…" : "Finalize (F4)"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* QUICK ADD CUSTOMER MODAL */}
      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-primary" />
              <span>নতুন গ্রাহক যুক্ত করুন (Add Customer)</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer} className="space-y-3.5 pt-2">
            <div>
              <Label className="text-xs">Customer Name (নাম) *</Label>
              <Input
                required
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="e.g. Md. Rafiqul Islam"
                className="mt-1 h-9 rounded-xl text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Mobile Number (মোবাইল নম্বর)</Label>
              <Input
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                className="mt-1 h-9 rounded-xl text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Address (ঠিকানা)</Label>
              <Input
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                placeholder="e.g. Road 4, Sector 7, Uttara"
                className="mt-1 h-9 rounded-xl text-sm"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCustomerModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={custSaving || !newCustName.trim()} className="bg-primary text-primary-foreground">
                {custSaving ? "Saving…" : "Save Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* HELD DRAFTS MANAGER MODAL */}
      <Dialog open={draftsModalOpen} onOpenChange={setDraftsModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderArchive className="h-4 w-4 text-amber-600" />
              <span>সংরক্ষিত ড্রাফট সেল (Held Orders / Drafts)</span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 py-2">
            {heldDrafts.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                কোনো ড্রাফট সেল নেই। সেল চলাকালীন "Hold Draft" চাপলে তা এখানে জমা থাকবে।
              </div>
            ) : (
              heldDrafts.map((d: any) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <div className="font-bold text-sm text-foreground">{d.invoice_no}</div>
                    <div className="text-xs text-muted-foreground">
                      Customer: <span className="font-medium text-foreground">{d.contacts?.name || "Walk-in"}</span> ·{" "}
                      {formatDateTime(new Date(d.created_at))}
                    </div>
                    <div className="text-xs font-semibold text-primary mt-1">
                      {d.lines?.length || 0} items · Total: ৳{Number(d.final_total || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => resumeDraft(d)}
                      className="h-8 rounded-lg bg-primary text-primary-foreground font-semibold text-xs cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Resume to Cart
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteDraft(d.id)}
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                      title="Discard Draft"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RECENT SALES & REPRINT MODAL */}
      <Dialog open={recentSalesModalOpen} onOpenChange={setRecentSalesModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-blue-600" />
              <span>সাম্প্রতিক বিক্রয় ও রসিদ রি-প্রিন্ট (Recent Invoices)</span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 py-2">
            {recentSales.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">কোনো সাম্প্রতিক সেল পাওয়া যায়নি।</div>
            ) : (
              recentSales.map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <div className="font-bold text-sm text-foreground flex items-center gap-2">
                      <span>{s.invoice_no}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          s.payment_status === "paid"
                            ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                            : "border-amber-500/40 text-amber-600 bg-amber-500/10"
                        }`}
                      >
                        {s.payment_status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Customer: {s.contacts?.name || "Walk-in"} · {formatDateTime(new Date(s.created_at))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-foreground font-mono">
                      ৳{Number(s.final_total || 0).toFixed(2)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => triggerReprintSale(s.id)}
                      className="h-8 rounded-lg border-primary/40 text-primary hover:bg-primary/10 text-xs font-semibold cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1" /> Reprint
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecentSalesModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanners */}
      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetected={(code) => handleScannedCode(code)} />
      <PhoneScanDialog open={phoneScanOpen} onClose={() => setPhoneScanOpen(false)} onDetected={(code) => handleScannedCode(code)} />
      <OcrScanner open={ocrOpen} onClose={() => setOcrOpen(false)} onText={handleOcrText} />

      {/* Multi-match Product Picker */}
      {pickerMatches.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setPickerMatches([])}
        >
          <div className="bg-background rounded-2xl w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {pickerMatches.length} products match "{pickerCode}"
              </h3>
              <button onClick={() => setPickerMatches([])} className="p-1 rounded hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Select the correct product:</p>
            <div className="max-h-[60vh] overflow-auto space-y-1">
              {pickerMatches.map((m) => (
                <button
                  key={m.variation_id}
                  onClick={() => {
                    addToCart(m);
                    toast.success(`Added: ${m.name}`);
                    setPickerMatches([]);
                  }}
                  className="w-full text-left rounded-xl border border-border p-3 hover:bg-accent transition-colors"
                >
                  <div className="font-medium text-sm">
                    {m.name}
                    {m.variant_label ? ` — ${m.variant_label}` : ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    SKU: {m.sub_sku} ·{" "}
                    <span className={m.stock > 0 ? "text-emerald-600" : "text-destructive"}>
                      {m.stock > 0 ? `In stock (${m.stock})` : "Out of stock"}
                    </span>{" "}
                    · ৳{m.price.toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {lastSale && (
        <ReceiptModal
          sale={lastSale}
          width={printWidth}
          businessName={business.name ?? "Sheikh Pharma"}
          businessAddress={locAddress}
          businessMobile={locMobile}
          businessEmail={currentLocation?.email ?? ""}
          onWidthChange={setPrintWidth}
          onClose={() => setLastSale(null)}
        />
      )}
    </div>
  );
}

function ReceiptModal({
  sale,
  width,
  businessName,
  businessAddress,
  businessMobile,
  businessEmail,
  onWidthChange,
  onClose,
}: {
  sale: SaleSnapshot;
  width: "58" | "80" | "A4";
  businessName: string;
  businessAddress: string;
  businessMobile: string;
  businessEmail: string;
  onWidthChange: (w: "58" | "80" | "A4") => void;
  onClose: () => void;
}) {
  const mm = width === "58" ? "48mm" : width === "80" ? "72mm" : "210mm";
  const fontSize = width === "58" ? "11px" : width === "80" ? "13px" : "13px";
  const handlePrint = () =>
    printReceiptInWhitePage(sale, width, { businessName, businessAddress, businessMobile, businessEmail });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-sm overflow-hidden print:hidden shadow-2xl">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Print Receipt</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => onWidthChange("58")}
              className={`flex-1 h-9 rounded-lg border text-sm font-medium ${
                width === "58" ? "border-primary bg-primary/10 text-primary" : "border-border"
              }`}
            >
              58 mm
            </button>
            <button
              onClick={() => onWidthChange("80")}
              className={`flex-1 h-9 rounded-lg border text-sm font-medium ${
                width === "80" ? "border-primary bg-primary/10 text-primary" : "border-border"
              }`}
            >
              80 mm
            </button>
            <button
              onClick={() => onWidthChange("A4")}
              className={`flex-1 h-9 rounded-lg border text-sm font-medium ${
                width === "A4" ? "border-primary bg-primary/10 text-primary" : "border-border"
              }`}
            >
              A4
            </button>
          </div>
          <div
            className="rounded-lg border border-border bg-white text-black p-3 max-h-80 overflow-auto"
            style={{ width: width === "A4" ? "100%" : mm, fontSize, fontFamily: "ui-monospace, monospace", margin: "0 auto" }}
          >
            <Receipt
              sale={sale}
              businessName={businessName}
              businessAddress={businessAddress}
              businessMobile={businessMobile}
              businessEmail={businessEmail}
              width={width}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onClose} className="h-10 rounded-xl">
              Skip
            </Button>
            <Button onClick={handlePrint} className="h-10 rounded-xl bg-primary text-primary-foreground font-semibold">
              <Printer className="h-4 w-4 mr-1.5" /> Print
            </Button>
          </div>
        </div>
      </div>

      <div
        id="receipt-print"
        className="hidden"
        style={{ width: mm, fontSize, fontFamily: "ui-monospace, monospace", color: "#000", background: "#fff", padding: "4px" }}
      >
        <Receipt
          sale={sale}
          businessName={businessName}
          businessAddress={businessAddress}
          businessMobile={businessMobile}
          businessEmail={businessEmail}
          width={width}
        />
      </div>
    </div>
  );
}

import {
  printReceiptInWhitePage as sharedPrintReceipt,
  receiptHtml as sharedReceiptHtml,
  receiptCss,
  type ReceiptSale as SharedReceiptSale,
} from "@/lib/receipt-print";

function toSharedSale(sale: SaleSnapshot): SharedReceiptSale {
  return {
    invoice_no: sale.invoice_no,
    lines: sale.lines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      total_amount: l.total_amount,
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    paid: sale.paid,
    change: sale.change,
    payment_method: sale.payment_method,
    customer_name: sale.customer_name,
    date: sale.date,
  };
}

function printReceiptInWhitePage(
  sale: SaleSnapshot,
  width: "58" | "80" | "A4",
  header: { businessName: string; businessAddress: string; businessMobile: string; businessEmail: string },
) {
  sharedPrintReceipt(toSharedSale(sale), width, {
    businessName: header.businessName,
    businessAddress: header.businessAddress,
    businessMobile: header.businessMobile,
  });
}

function Receipt({
  sale,
  businessName,
  businessAddress,
  businessMobile,
  width = "80",
}: {
  sale: SaleSnapshot;
  businessName: string;
  businessAddress: string;
  businessMobile: string;
  businessEmail: string;
  width?: "58" | "80" | "A4";
}) {
  const html = sharedReceiptHtml(toSharedSale(sale), { businessName, businessAddress, businessMobile }, width);
  const mm = width === "58" ? "48mm" : width === "80" ? "72mm" : "100%";
  const fontSize = width === "58" ? "11px" : "13px";
  const css = receiptCss(".receipt-preview-clone", fontSize, mm);
  return (
    <>
      <style>{css}</style>
      <div className="receipt-preview-clone" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
