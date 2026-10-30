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
  Calendar,
  HandCoins,
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
  qty_str?: string;
  total_str?: string;
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
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);
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

  // Sale Date State (Today or Previous Day / Backdated Entry)
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const todayStr = useMemo(() => getTodayStr(), []);
  const yesterdayStr = useMemo(() => getYesterdayStr(), []);
  const [saleDate, setSaleDate] = useState<string>(todayStr);
  const isBackdated = saleDate !== todayStr;

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

  // Keyboard navigation & focus refs
  const qtyInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const totalInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const dropdownItemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pendingFocusRef = useRef<{ id: string; field: "qty" | "total" } | null>(null);

  function focusQty(variationId: string) {
    pendingFocusRef.current = { id: variationId, field: "qty" };
    const el = qtyInputRefs.current.get(variationId);
    if (el) {
      el.focus();
      el.select();
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      pendingFocusRef.current = null;
      return;
    }
    setTimeout(() => {
      const retry = qtyInputRefs.current.get(variationId);
      if (retry) {
        retry.focus();
        retry.select();
        retry.scrollIntoView({ behavior: "smooth", block: "nearest" });
        pendingFocusRef.current = null;
      }
    }, 50);
  }

  function focusTotal(variationId: string) {
    pendingFocusRef.current = { id: variationId, field: "total" };
    const el = totalInputRefs.current.get(variationId);
    if (el) {
      el.focus();
      el.select();
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      pendingFocusRef.current = null;
      return;
    }
    setTimeout(() => {
      const retry = totalInputRefs.current.get(variationId);
      if (retry) {
        retry.focus();
        retry.select();
        retry.scrollIntoView({ behavior: "smooth", block: "nearest" });
        pendingFocusRef.current = null;
      }
    }, 50);
  }

  function focusSearch() {
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 40);
  }

  // Ensure newly mounted cart line input is focused promptly
  useEffect(() => {
    if (pendingFocusRef.current) {
      const { id, field } = pendingFocusRef.current;
      const el = field === "qty" ? qtyInputRefs.current.get(id) : totalInputRefs.current.get(id);
      if (el) {
        el.focus();
        el.select();
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        pendingFocusRef.current = null;
      }
    }
  }, [cart]);

  // Auto-save the in-progress cart so a power cut does not lose it.
  const { clearDraft: clearPosDraft } = useAutosaveDraft(
    business?.id ? `pos:${business.id}` : null,
    { cart, discount, discountType, paymentMethod, amountPaid, contactId, saleDate },
    (d) => {
      if (d.cart?.length) setCart(d.cart);
      if (d.discount) setDiscount(d.discount);
      if (d.discountType) setDiscountType(d.discountType);
      if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
      if (d.amountPaid) setAmountPaid(d.amountPaid);
      if (d.contactId) setContactId(d.contactId);
      if (d.saleDate) setSaleDate(d.saleDate);
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
  // The listener is registered ONCE; latest cart/save state is read via a ref
  // so it never goes stale and is never torn down / re-added on cart changes.
  const shortcutStateRef = useRef<{ cartLen: number; save: any }>({ cartLen: 0, save: null });
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { cartLen, save: s } = shortcutStateRef.current;
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        if (cartLen > 0 && s && !s.isPending) {
          s.mutate(false);
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        if (cartLen > 0 && s && !s.isPending) {
          s.mutate(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const firstLocationId = (locations[0] as any)?.id as string | undefined;
  useEffect(() => {
    if (!locationId && firstLocationId) {
      setLocationId(firstLocationId);
    }
  }, [locationId, firstLocationId]);

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

  const safeSelectedIdx = Math.min(selectedIdx, Math.max(0, Math.min(filteredItems.length - 1, 14)));

  useEffect(() => {
    if (dropdownOpen && dropdownItemRefs.current.has(safeSelectedIdx)) {
      dropdownItemRefs.current.get(safeSelectedIdx)?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [safeSelectedIdx, dropdownOpen]);

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
          quantity: 0,
          total_amount: 0,
          qty_str: "",
          total_str: "",
        },
      ];
    });
  }

  function selectProduct(item: FlatItem) {
    addToCart(item);
    if (item.stock <= 0) {
      toast.warning(`${item.name} is out of stock!`);
    } else {
      toast.success(`Added ${item.name}`);
    }
    setSearch("");
    setDropdownOpen(false);
    setSelectedIdx(0);
    focusQty(item.variation_id);
  }

  function handleQtyChange(variation_id: string, rawVal: string) {
    setCart((c) =>
      c.map((l) => {
        if (l.variation_id !== variation_id) return l;
        if (rawVal === "") {
          return { ...l, qty_str: "", quantity: 0 };
        }
        const q = Math.max(0, Number(rawVal) || 0);
        return { ...l, qty_str: rawVal, quantity: q };
      })
    );
  }

  function handleTotalChange(variation_id: string, rawVal: string) {
    setCart((c) =>
      c.map((l) => {
        if (l.variation_id !== variation_id) return l;
        if (rawVal === "") {
          return { ...l, total_str: "", total_amount: 0 };
        }
        const t = Math.max(0, Number(rawVal) || 0);
        return { ...l, total_str: rawVal, total_amount: t };
      })
    );
  }

  function adjustQty(variation_id: string, delta: number) {
    setCart((c) =>
      c.map((l) => {
        if (l.variation_id !== variation_id) return l;
        const currentQ = l.quantity || 0;
        const nextQ = Math.max(0, currentQ + delta);
        return {
          ...l,
          quantity: nextQ,
          qty_str: nextQ === 0 ? "" : String(nextQ),
        };
      })
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

  // Helper to calculate effective line values
  const getLineEffective = (l: CartLine) => {
    const qty = l.quantity || 0;
    const unitPrice = l.unit_price > 0 ? l.unit_price : l.original_price;
    const softPrice = Number((unitPrice * qty).toFixed(2));
    const hasTotalInput = l.total_str !== undefined && l.total_str.trim() !== "";
    const totalAmount = hasTotalInput ? (Number(l.total_str) || 0) : softPrice;
    return { qty, softPrice, totalAmount, hasTotalInput };
  };

  // Calculations
  const subtotal = cart.reduce((s, l) => {
    const { softPrice } = getLineEffective(l);
    return s + softPrice;
  }, 0);
  const lineDiscount = cart.reduce((s, l) => {
    const { softPrice, totalAmount, hasTotalInput } = getLineEffective(l);
    return s + (hasTotalInput ? Math.max(0, softPrice - totalAmount) : 0);
  }, 0);
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
      const missingQty = cart.find((l) => (l.quantity || 0) <= 0);
      if (missingQty) {
        throw new Error(`দয়া করে "${missingQty.name}" এর পরিমাণ (Quantity) দিন`);
      }

      let txDate: Date;
      if (saleDate && saleDate !== todayStr) {
        const now = new Date();
        const [y, m, day] = saleDate.split("-").map(Number);
        txDate = new Date(y, m - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
      } else {
        txDate = new Date();
      }

      const datePart = `${txDate.getFullYear()}${String(txDate.getMonth() + 1).padStart(2, "0")}${String(txDate.getDate()).padStart(2, "0")}`;
      const rand = Math.floor(10000 + Math.random() * 90000);
      const invoiceNo = `SKP-${datePart}-${rand}`;
      const paid = draft ? 0 : Math.min(paidNum, total);
      const payment_status = draft ? "due" : paid >= total ? "paid" : paid > 0 ? "partial" : "due";

      const txDateISO = txDate.toISOString();

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
          transaction_date: txDateISO,
          created_at: txDateISO,
          total_before_tax: subtotal,
          discount_amount: totalDiscount,
          final_total: total,
          total_paid: paid,
        })
        .select("id")
        .single();
      if (error) throw error;

      const lines = cart.map((l) => {
        const { qty, softPrice, totalAmount, hasTotalInput } = getLineEffective(l);
        const lineDisc = hasTotalInput ? Math.max(0, softPrice - totalAmount) : 0;
        return {
          transaction_id: tx.id,
          product_id: l.product_id,
          variation_id: l.variation_id,
          quantity: qty,
          unit_price: l.unit_price,
          unit_price_inc_tax: l.unit_price,
          line_discount_amount: lineDisc,
        };
      });
      const { error: lerr } = await supabase.from("transaction_sell_lines").insert(lines);
      if (lerr) throw lerr;

      if (!draft && paid > 0) {
        await supabase.from("transaction_payments").insert({
          transaction_id: tx.id,
          business_id: business.id,
          amount: paid,
          method: paymentMethod,
          paid_on: txDateISO,
          created_at: txDateISO,
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
            lines: cart.map((l) => {
        const { qty, totalAmount } = getLineEffective(l);
        return { ...l, quantity: qty, total_amount: totalAmount };
      }),
            subtotal,
            discount: totalDiscount,
            total,
            paid,
            change: paid - total,
            payment_method: paymentMethod,
            customer_name: contacts.find((c: any) => c.id === contactId)?.name ?? null,
            date: formatDateTime(txDate),
          };
      return { id: tx.id, snapshot };
    },
    onSuccess: ({ snapshot }) => {
      toast.success(
        snapshot
          ? isBackdated
            ? `Sale finalized for ${saleDate === yesterdayStr ? "Yesterday" : saleDate}!`
            : "Sale finalized successfully!"
          : "Sale held as Draft!"
      );
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

  // Keep the keyboard-shortcut handler's view of state current (no re-subscribe).
  shortcutStateRef.current = { cartLen: cart.length, save };

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
      if (draft.transaction_date || draft.created_at) {
        const dt = new Date(draft.transaction_date || draft.created_at);
        const dtStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        setSaleDate(dtStr);
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
      selectProduct(matches[0]);
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

              {/* Due Management / বকেয়া খাতা Button */}
              <Link
                to="/due"
                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-200 hover:bg-rose-500/20 px-2.5 text-xs font-semibold cursor-pointer"
                title="বকেয়া খাতা ও কালেকশন (Due Management)"
              >
                <HandCoins className="h-3.5 w-3.5 text-rose-600" />
                <span>বকেয়া খাতা</span>
              </Link>

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

              {/* Sale Date Indicator in Header */}
              {isBackdated ? (
                <div
                  className="flex items-center gap-1.5 h-8.5 px-3 rounded-lg border border-amber-500/60 bg-amber-500/15 text-amber-900 dark:text-amber-200 text-xs font-semibold shadow-2xs"
                  title="পূর্ববর্তী তারিখের সেল এন্ট্রি চলছে"
                >
                  <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>তারিখ: <strong>{saleDate === yesterdayStr ? "গতকাল" : formatDate(saleDate)}</strong></span>
                  <button
                    type="button"
                    onClick={() => setSaleDate(todayStr)}
                    className="ml-1 text-[11px] underline hover:text-foreground font-bold cursor-pointer"
                    title="আজকের তারিখে ফিরে যান"
                  >
                    (আজকে ফিরুন)
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-1.5 h-8.5 px-2.5 rounded-lg border border-border bg-card text-muted-foreground text-xs">
                  <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-mono text-[11px]">{formatDate(todayStr)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Search Bar & Scanners */}
          <div className="relative space-y-2 sm:space-y-0 sm:flex sm:gap-2">
            <div className="relative flex-1" ref={searchContainerRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                placeholder="Search medicine name, SKU, or barcode (F2)…"
                className="w-full h-10 rounded-xl border border-border bg-input pl-9 pr-9 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                value={search}
                onFocus={() => {
                  if (search.trim()) setDropdownOpen(true);
                }}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setDropdownOpen(true);
                  setSelectedIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if (!dropdownOpen) setDropdownOpen(true);
                    const maxIdx = Math.max(0, Math.min(filteredItems.length - 1, 14));
                    setSelectedIdx((prev) => Math.min(prev + 1, maxIdx));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedIdx((prev) => Math.max(prev - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredItems.length > 0) {
                      const item = filteredItems[safeSelectedIdx] ?? filteredItems[0];
                      if (item) {
                        selectProduct(item);
                      }
                    }
                  } else if (e.key === "Escape") {
                    setSearch("");
                    setDropdownOpen(false);
                    setSelectedIdx(0);
                  }
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setDropdownOpen(false);
                    setSelectedIdx(0);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Instant Dropdown Suggestions */}
              {dropdownOpen && search.trim() && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden divide-y divide-border/60 max-h-80 overflow-y-auto">
                  {filteredItems.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                      No medicine found for "{search}"
                    </div>
                  ) : (
                    filteredItems.slice(0, 15).map((item, idx) => {
                      const isOutOfStock = item.stock <= 0;
                      const isHighlighted = idx === safeSelectedIdx;
                      return (
                        <div
                          key={item.variation_id}
                          ref={(el) => {
                            if (el) dropdownItemRefs.current.set(idx, el);
                            else dropdownItemRefs.current.delete(idx);
                          }}
                          onMouseEnter={() => setSelectedIdx(idx)}
                          onClick={() => selectProduct(item)}
                          className={`px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isHighlighted
                              ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/40 font-medium"
                              : "hover:bg-muted/60"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs sm:text-sm truncate">
                                {item.name}
                                {item.variant_label ? ` — ${item.variant_label}` : ""}
                              </span>
                              {isHighlighted && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-bold shrink-0 shadow-xs">
                                  Enter ↵
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              <span className="font-mono">SKU: {item.sub_sku}</span>
                              {item.barcode && <span className="font-mono">· {item.barcode}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                item.stock > 10
                                  ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                                  : item.stock > 0
                                    ? "border-amber-500/40 text-amber-600 bg-amber-500/10"
                                    : "border-destructive/40 text-destructive bg-destructive/10"
                              }`}
                            >
                              {item.stock > 0 ? `${item.stock} in stock` : "0 stock"}
                            </Badge>
                            <span className="text-xs font-bold text-primary min-w-[55px] text-right">
                              ৳{item.price.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
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
                        onClick={() => selectProduct(item)}
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
                              selectProduct(item);
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
            /* Pharmacy Sale Cart Product Rows (Replaced the placeholder banners) */
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              {cart.length === 0 ? (
                /* Empty Cart State */
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-3 bg-muted/10 rounded-2xl border border-dashed border-border/70 p-8">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center text-3xl shadow-inner">
                    💊
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">কার্ট সম্পূর্ণ খালি (Cart is Empty)</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      উপরের সার্চবারে মেডিসিনের নাম, SKU লিখুন অথবা বারকোড স্ক্যানার দিয়ে স্ক্যান করলে সাথে সাথে কার্ট রো-তে যোগ হবে।
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-card border border-border/80 shadow-2xs font-medium">
                      <kbd className="font-mono font-bold text-primary mr-1">F2</kbd> Focus Search
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-card border border-border/80 shadow-2xs font-medium">
                      <kbd className="font-mono font-bold text-primary mr-1">Enter</kbd> Add Top Match
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-card border border-border/80 shadow-2xs font-medium">
                      <kbd className="font-mono font-bold text-primary mr-1">F4</kbd> Finalize Sale
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-card border border-border/80 shadow-2xs font-medium">
                      <kbd className="font-mono font-bold text-primary mr-1">F8</kbd> Hold Draft
                    </span>
                  </div>
                </div>
              ) : (
                /* Cart Product Rows Table */
                <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs flex flex-col">
                  {/* Table Header Bar */}
                  <div className="p-3 bg-muted/40 border-b border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Added Cart Products ({cart.length} items · {cart.reduce((a, b) => a + b.quantity, 0)} units)
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearCart}
                      className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 cursor-pointer gap-1"
                      title="Clear all products from cart"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Clear All</span>
                    </Button>
                  </div>

                  {/* Responsive Table of Cart Products */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/30 border-b border-border/60 text-muted-foreground font-semibold">
                        <tr>
                          <th className="p-3 w-10 text-center">#</th>
                          <th className="p-3 min-w-[200px]">Medicine / Item</th>
                          <th className="p-3 w-28 text-right">Unit Price</th>
                          <th className="p-3 w-36 text-center">Quantity</th>
                          <th className="p-3 w-32 text-right">Total (৳)</th>
                          <th className="p-3 w-14 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {cart.map((l, i) => {
                          const { qty, softPrice, totalAmount, hasTotalInput } = getLineEffective(l);
                          const hasQty = (l.qty_str !== undefined ? l.qty_str !== "" : l.quantity > 0) && (l.quantity || 0) > 0;
                          const discountAmount = Number((softPrice - totalAmount).toFixed(2));
                          const qtyDisplay = l.qty_str !== undefined ? l.qty_str : (l.quantity === 0 ? "" : String(l.quantity));
                          const totalDisplay = l.total_str !== undefined ? l.total_str : (l.total_amount === 0 ? "" : String(l.total_amount));

                          return (
                            <tr
                              key={l.variation_id}
                              ref={i === cart.length - 1 ? (lastLineRef as any) : undefined}
                              className="hover:bg-muted/40 transition-colors group"
                            >
                              <td className="p-3 text-center text-muted-foreground font-mono font-medium align-middle">
                                {i + 1}
                              </td>
                              <td className="p-3 align-middle">
                                <div className="font-bold text-foreground text-sm leading-tight">
                                  {l.name}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono mt-0.5">
                                  <span>SKU: {l.sub_sku}</span>
                                </div>
                              </td>
                              <td className="p-3 text-right align-middle">
                                <span className="font-semibold text-foreground">
                                  ৳{l.unit_price > 0 ? l.unit_price.toFixed(2) : l.original_price.toFixed(2)}
                                </span>
                              </td>
                              <td className="p-3 align-middle">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => adjustQty(l.variation_id, -1)}
                                    className="h-7 w-7 grid place-items-center rounded-lg border border-border bg-card hover:bg-muted font-bold text-xs cursor-pointer shadow-2xs active:scale-95"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <input
                                    ref={(el) => {
                                      if (el) qtyInputRefs.current.set(l.variation_id, el);
                                      else qtyInputRefs.current.delete(l.variation_id);
                                    }}
                                    type="number"
                                    min="0"
                                    placeholder="Qty"
                                    value={qtyDisplay}
                                    onChange={(e) => handleQtyChange(l.variation_id, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        if (!l.qty_str && (l.quantity === 0 || !l.quantity)) {
                                          handleQtyChange(l.variation_id, "1");
                                        }
                                        focusTotal(l.variation_id);
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        focusSearch();
                                      }
                                    }}
                                    className="w-14 h-7 text-center rounded-lg border border-border bg-input text-xs font-bold font-mono focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => adjustQty(l.variation_id, 1)}
                                    className="h-7 w-7 grid place-items-center rounded-lg border border-border bg-card hover:bg-muted font-bold text-xs cursor-pointer shadow-2xs active:scale-95"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="p-3 text-right align-top">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="font-bold text-primary text-xs">৳</span>
                                  <input
                                    ref={(el) => {
                                      if (el) totalInputRefs.current.set(l.variation_id, el);
                                      else totalInputRefs.current.delete(l.variation_id);
                                    }}
                                    type="number"
                                    step="any"
                                    placeholder={hasQty ? softPrice.toFixed(2) : "0.00"}
                                    value={totalDisplay}
                                    onChange={(e) => handleTotalChange(l.variation_id, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        focusSearch();
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        focusSearch();
                                      }
                                    }}
                                    className="w-24 h-7 text-right rounded-lg border border-border bg-input px-2 text-xs font-bold font-mono focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                                  />
                                </div>
                                {/* Soft Price (Red) or Converted Item Discount */}
                                <div className="mt-1 text-right min-h-[16px]">
                                  {hasQty && !hasTotalInput && (
                                    <button
                                      type="button"
                                      onClick={() => handleTotalChange(l.variation_id, softPrice.toFixed(2))}
                                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400 font-mono tracking-tight hover:underline cursor-pointer transition-colors"
                                      title="Standard price for this quantity (Click to apply)"
                                    >
                                      ৳{softPrice.toFixed(2)}
                                    </button>
                                  )}
                                  {hasQty && hasTotalInput && (
                                    <div className="text-[11px] font-mono tracking-tight font-bold">
                                      {discountAmount > 0.001 ? (
                                        <span className="text-rose-600 dark:text-rose-400">
                                          Discount: -৳{discountAmount.toFixed(2)}
                                        </span>
                                      ) : discountAmount < -0.001 ? (
                                        <span className="text-amber-600 dark:text-amber-400">
                                          +৳{Math.abs(discountAmount).toFixed(2)}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground font-normal text-[10px]">
                                          ৳0.00 discount
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-center align-top pt-3.5">
                                <button
                                  type="button"
                                  onClick={() => removeLine(l.variation_id)}
                                  className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer mx-auto"
                                  title="Remove item"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-muted/30 border-t border-border/80 font-bold">
                        <tr>
                          <td colSpan={3} className="p-3 text-right text-muted-foreground">
                            Total Units ({cart.reduce((a, b) => a + b.quantity, 0)} pcs):
                          </td>
                          <td className="p-3 text-center font-mono">
                            {cart.reduce((a, b) => a + b.quantity, 0)}
                          </td>
                          <td className="p-3 text-right font-mono text-sm text-primary">
                            ৳{subtotal.toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2 border-t border-border/50 bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono font-bold text-[10px]">F2</kbd> Focus Search
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono font-bold text-[10px]">↑/↓</kbd> Select Product
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono font-bold text-[10px]">Enter</kbd> Qty → Price → Search
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

      {/* RIGHT: BILLING & PAYMENT PANEL */}
      <div className="w-full lg:w-[380px] xl:w-[400px] flex flex-col bg-card border-l border-border/60">
        {/* Customer Select & Quick Add */}
        <div className="p-3.5 border-b border-border/60 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Payment & Checkout</h2>
            </div>
            {cart.length > 0 && (
              <Badge variant="outline" className="text-[11px] font-mono font-bold bg-primary/10 text-primary border-primary/30">
                {cart.length} item{cart.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Select Customer (গ্রাহক)</label>
            <div className="flex items-center gap-1.5">
              <select
                className="flex-1 h-9 rounded-xl border border-border bg-input px-3 text-xs font-medium"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
              >
                <option value="">Walk-in customer (খুচরা ক্রেতা)</option>
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

          {/* Sale Date (আজকের বিক্রয় / পূর্ববর্তী তারিখ এন্ট্রি) */}
          <div className="space-y-1 pt-1 border-t border-border/40">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Sale Date (বিক্রয় তারিখ)</span>
              </label>
              {isBackdated ? (
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/40">
                  ⚠️ পূর্ববর্তী তারিখ (Backdated)
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground font-medium">আজকের বিক্রয়</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                max={todayStr}
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value || todayStr)}
                className={`flex-1 h-8.5 rounded-xl border bg-input px-2.5 text-xs font-bold font-mono outline-none transition-all ${
                  isBackdated
                    ? "border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-100 ring-1 ring-amber-500/40"
                    : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setSaleDate(todayStr)}
                className={`h-8.5 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  !isBackdated
                    ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
                title="আজকের তারিখ সেট করুন"
              >
                আজকে
              </button>
              <button
                type="button"
                onClick={() => setSaleDate(yesterdayStr)}
                className={`h-8.5 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  saleDate === yesterdayStr
                    ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
                title="গতকালকের তারিখ সেট করুন"
              >
                গতকাল
              </button>
            </div>
            {isBackdated && (
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-tight">
                ইনভয়েস ও অ্যাকাউন্টিং রিপোর্ট এই তারিখে ({saleDate === yesterdayStr ? "গতকাল" : formatDate(saleDate)}) রেকর্ড হবে।
              </p>
            )}
          </div>
        </div>

        {/* Calculation & Payment Controls */}
        <div className="p-4 space-y-3.5 text-xs flex-1 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-3">
            {/* Quick Bill Summary Box */}
            <div className="rounded-xl border border-border/70 bg-background/80 p-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Total Quantity</span>
                <span className="font-mono font-bold text-foreground">{cart.reduce((a, b) => a + b.quantity, 0)} units</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono font-bold text-foreground">৳{subtotal.toFixed(2)}</span>
              </div>
              {lineDiscount > 0.0001 && (
                <div className="flex justify-between items-center text-xs text-emerald-600 font-medium">
                  <span>Item Discount (auto)</span>
                  <span>-৳{lineDiscount.toFixed(2)}</span>
                </div>
              )}
              {/* Extra Discount Controls */}
              <div className="flex justify-between items-center gap-2 pt-1 border-t border-border/40">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-xs">Extra Discount</span>
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
            </div>

            {/* Grand Total Big Display */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Payable</span>
                <div className="text-[11px] text-muted-foreground">সর্বমোট প্রদেয়</div>
              </div>
              <span className="text-2xl font-black text-primary font-mono tracking-tight">৳{total.toFixed(2)}</span>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-medium text-muted-foreground">Payment Method (পরিশোধ পদ্ধতি)</label>
              <select
                className="w-full h-9 rounded-xl border border-border bg-input px-3 text-xs font-semibold focus:border-primary outline-none"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons: Hold Draft vs Finalize Sale */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="grid grid-cols-2 gap-2">
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
                    selectProduct(m);
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
