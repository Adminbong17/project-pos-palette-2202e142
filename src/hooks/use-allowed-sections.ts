import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "./use-current-business";
import { useCurrentRole } from "./use-current-role";
import { useIsSuperAdmin } from "./use-super-admin";

/**
 * One entry per page — every key is unique, so an admin can hand out a single
 * page without dragging a whole group along. Older grouped keys stored in the
 * database are expanded through LEGACY_GROUPS below.
 */
export const ALL_SECTIONS: { key: string; label: string; path: string; category?: string }[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard", category: "General" },
  { key: "pos", label: "POS", path: "/pos", category: "Operations" },
  { key: "sales", label: "Sales", path: "/sales", category: "Operations" },
  { key: "purchases", label: "Purchases", path: "/purchases", category: "Operations" },
  { key: "products", label: "Products", path: "/products", category: "Inventory" },
  { key: "files", label: "Files", path: "/files", category: "Operations" },
  { key: "contacts", label: "Contacts", path: "/contacts", category: "Operations" },
  { key: "stock-transfers", label: "Stock Transfers", path: "/stock-transfers", category: "Inventory" },
  { key: "expenses", label: "Expenses", path: "/expenses", category: "Finance" },
  { key: "accounts", label: "Accounts", path: "/accounts", category: "Finance" },
  { key: "reports", label: "Reports", path: "/reports", category: "Finance" },
  { key: "settings", label: "Settings (full)", path: "/settings", category: "System" },
  { key: "quick-box", label: "Quick Box Add", path: "/quick-box", category: "Inventory" },
  { key: "manufacturing", label: "Manufacturing", path: "/manufacturing", category: "Operations" },
  { key: "restaurant", label: "Restaurant", path: "/restaurant", category: "Operations" },
  { key: "repair", label: "Repair", path: "/repair", category: "Operations" },
  { key: "crm", label: "CRM", path: "/crm", category: "Operations" },
  { key: "hrm", label: "HRM", path: "/hrm", category: "Operations" },
  // Clinical pages — one key per page.
  { key: "rx-dashboard", label: "Doctor Dashboard", path: "/rx-dashboard", category: "Clinical" },
  { key: "rx-write", label: "Prescriptions", path: "/prescriptions", category: "Clinical" },
  { key: "rx-lists", label: "My Rx Lists", path: "/rx-lists", category: "Clinical" },
  { key: "rx-staff", label: "My Staff", path: "/rx-staff", category: "Clinical" },
  { key: "rx-appointments", label: "Patient Queue", path: "/rx-appointments", category: "Clinical" },
  { key: "clinic-dashboard", label: "Clinic Dashboard", path: "/clinic-dashboard", category: "Clinical" },
  { key: "clinic-doctors", label: "Clinic Doctors", path: "/clinic-doctors", category: "Clinical" },
  { key: "clinic-services", label: "Products & Services", path: "/clinic-services", category: "Clinical" },
  { key: "clinic-sales", label: "Clinic Sales", path: "/clinic-sales", category: "Clinical" },
  { key: "clinic-plans", label: "Treatment Plans (EMI)", path: "/clinic-plans", category: "Clinical" },
  { key: "lab-reports", label: "Lab Reports", path: "/lab-reports", category: "Clinical" },
  { key: "rx-billing", label: "Rx Billing", path: "/rx-billing", category: "Clinical" },
  { key: "rx-credit-history", label: "Credit & Payment History", path: "/rx-credit-history", category: "Clinical" },
  { key: "biz-settings", label: "Business Settings", path: "/settings/business", category: "Clinical" },
];

/** Presets for fast marking */
export const PRESETS = {
  ALL: ALL_SECTIONS.map((s) => s.key),
  POS_STANDARD: [
    "dashboard",
    "pos",
    "sales",
    "purchases",
    "products",
    "quick-box",
    "files",
    "contacts",
    "stock-transfers",
    "expenses",
    "accounts",
    "reports",
  ],
  POS_CASHIER: ["pos", "sales", "contacts"],
  DOCTOR_CLINIC: [
    "rx-dashboard",
    "rx-write",
    "rx-lists",
    "rx-staff",
    "rx-appointments",
    "clinic-dashboard",
    "clinic-doctors",
    "clinic-services",
    "clinic-sales",
    "clinic-plans",
    "lab-reports",
    "rx-billing",
    "rx-credit-history",
    "biz-settings",
  ],
  DOCTOR_ONLY: ["rx-dashboard", "rx-write", "rx-lists", "rx-staff", "rx-appointments"],
};

/** Old grouped keys → the individual pages they used to unlock. */
export const LEGACY_GROUPS: Record<string, string[]> = {
  prescriptions: [
    "rx-dashboard",
    "rx-write",
    "rx-lists",
    "rx-staff",
    "clinic-dashboard",
    "clinic-services",
    "clinic-plans",
    "lab-reports",
    "rx-billing",
    "rx-credit-history",
    "biz-settings",
  ],
  clinic: [
    "clinic-dashboard",
    "clinic-doctors",
    "clinic-services",
    "clinic-sales",
    "clinic-plans",
    "lab-reports",
    "rx-billing",
    "rx-credit-history",
    "biz-settings",
  ],
  "rx-queue": ["rx-appointments", "clinic-services", "clinic-plans"],
};

const VALID_KEYS = new Set(ALL_SECTIONS.map((s) => s.key));

/** Turn any stored list (old grouped keys or new page keys) into page keys. */
export function expandSections(list: string[] | null | undefined): string[] | null {
  if (!list) return list === null ? null : null;
  const out = new Set<string>();
  for (const key of list) {
    const group = LEGACY_GROUPS[key];
    if (group) group.forEach((k) => out.add(k));
    else if (VALID_KEYS.has(key)) out.add(key);
  }
  return Array.from(out);
}

const DEFAULT_SALESMAN = ["pos", "purchases"];

// Clinical-only keys: users limited to these never get POS/inventory extras.
const CLINICAL_KEYS = [
  "rx-dashboard",
  "rx-write",
  "rx-lists",
  "rx-staff",
  "rx-appointments",
  "clinic-dashboard",
  "clinic-doctors",
  "clinic-services",
  "clinic-sales",
  "clinic-plans",
  "lab-reports",
  "rx-billing",
  "rx-credit-history",
  "biz-settings",
];

// A clinic admin only manages doctors, assistants and the serial queue.
const DEFAULT_CLINIC = expandSections(["clinic", "rx-queue"])!;
const DEFAULT_DOCTOR = expandSections(["prescriptions", "rx-queue"])!;

// A "doctor" only needs the prescription module — no POS/inventory extras.
export function isPrescriptionOnly(list: string[] | null) {
  const expanded = expandSections(list);
  if (!expanded) return false;
  return expanded.length > 0 && expanded.every((k) => CLINICAL_KEYS.includes(k));
}

export function useAllowedSections() {
  const { isSuperAdmin, isLoading: superLoading } = useIsSuperAdmin();
  const { data: business } = useCurrentBusiness();
  const { isAdmin, isDoctor, isAssistant, isClinicAdmin, isLoading: roleLoading } = useCurrentRole();
  const clinicalOnlyRole = isDoctor || isAssistant || isClinicAdmin;

  const q = useQuery({
    queryKey: ["allowed-sections", business?.id],
    enabled: !!business?.id && !roleLoading,
    staleTime: 15 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string[] | null> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return expandSections(DEFAULT_SALESMAN);

      const { data: urRows } = await supabase
        .from("user_roles")
        .select("role_id, allowed_sections")
        .eq("user_id", userId)
        .eq("business_id", business!.id);

      // If the admin explicitly marked an array of modules (even empty []), strictly enforce it.
      const explicitRow = (urRows ?? []).find((r: any) => Array.isArray(r.allowed_sections));
      if (explicitRow) {
        return expandSections(explicitRow.allowed_sections) ?? [];
      }

      const ur = urRows?.[0] ?? null;
      if (!ur) return isAdmin ? null : expandSections(DEFAULT_SALESMAN);

      if (isAdmin && !ur.role_id) return null;

      const { data: role } = await supabase
        .from("roles")
        .select("allowed_sections")
        .eq("id", ur.role_id)
        .maybeSingle();

      const list = (role as any)?.allowed_sections as string[] | null;
      if (Array.isArray(list)) {
        return expandSections(list) ?? [];
      }

      // Admins with no section limit configured keep full access.
      return isAdmin ? null : expandSections(DEFAULT_SALESMAN);
    },
  });

  const raw = Array.isArray(q.data)
    ? q.data
    : q.data === null
      ? (isAdmin ? null : expandSections(DEFAULT_SALESMAN))
      : (isAdmin ? null : expandSections(DEFAULT_SALESMAN));

  // A Doctor / Assistant account with no explicit grant stays clinical-only.
  // When the super admin has explicitly picked sections for that user (hasExplicitGrant),
  // those exact picks strictly win — no auto-adding of other modules.
  const hasExplicitGrant = Array.isArray(q.data);
  const sections =
    raw && clinicalOnlyRole && !hasExplicitGrant
      ? (isClinicAdmin ? DEFAULT_CLINIC : DEFAULT_DOCTOR)
      : raw;

  if (isSuperAdmin) {
    return {
      isAdmin: true,
      isLoading: superLoading,
      sections: null,
    };
  }

  return {
    isAdmin,
    isLoading: roleLoading || q.isLoading,
    sections,
  };
}

export function isPathAllowed(pathname: string, sections: string[] | null) {
  if (sections === null) return true;
  const expanded = expandSections(sections) ?? [];
  return ALL_SECTIONS.some(
    (s) => expanded.includes(s.key) && (pathname === s.path || pathname.startsWith(s.path + "/")),
  );
}

// First landing path for a set of allowed sections.
export function sectionHomePath(sections: string[] | null) {
  if (sections === null) return "/dashboard";
  const list = expandSections(sections) ?? [];
  if (list.length === 0) return "/dashboard";
  if (list.includes("dashboard")) return "/dashboard";
  if (list.includes("pos")) return "/pos";
  if (list.includes("rx-dashboard")) return "/rx-dashboard";
  if (list.includes("rx-appointments")) return "/rx-appointments";
  if (list.includes("rx-write")) return "/prescriptions";
  if (list.includes("clinic-dashboard")) return "/clinic-dashboard";
  if (list.includes("sales")) return "/sales";
  if (list.includes("purchases")) return "/purchases";
  if (list.includes("products")) return "/products";
  if (list.includes("clinic-sales")) return "/clinic-sales";
  if (list.includes("clinic-plans")) return "/clinic-plans";
  if (list.includes("clinic-services")) return "/clinic-services";
  if (list.includes("lab-reports")) return "/lab-reports";
  const match = ALL_SECTIONS.find((s) => list.includes(s.key));
  return match?.path ?? "/dashboard";
}
