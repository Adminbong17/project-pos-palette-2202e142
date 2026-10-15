import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "./use-current-business";
import { useCurrentRole } from "./use-current-role";

/**
 * One entry per page — every key is unique, so an admin can hand out a single
 * page without dragging a whole group along. Older grouped keys stored in the
 * database are expanded through LEGACY_GROUPS below.
 */
export const ALL_SECTIONS: { key: string; label: string; path: string }[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard" },
  { key: "pos", label: "POS", path: "/pos" },
  { key: "sales", label: "Sales", path: "/sales" },
  { key: "purchases", label: "Purchases", path: "/purchases" },
  { key: "products", label: "Products", path: "/products" },
  { key: "files", label: "Files", path: "/files" },
  { key: "contacts", label: "Contacts", path: "/contacts" },
  { key: "stock-transfers", label: "Stock Transfers", path: "/stock-transfers" },
  { key: "expenses", label: "Expenses", path: "/expenses" },
  { key: "accounts", label: "Accounts", path: "/accounts" },
  { key: "reports", label: "Reports", path: "/reports" },
  { key: "settings", label: "Settings (full)", path: "/settings" },
  { key: "quick-box", label: "Quick Box Add", path: "/quick-box" },
  { key: "manufacturing", label: "Manufacturing", path: "/manufacturing" },
  { key: "restaurant", label: "Restaurant", path: "/restaurant" },
  { key: "repair", label: "Repair", path: "/repair" },
  { key: "crm", label: "CRM", path: "/crm" },
  { key: "hrm", label: "HRM", path: "/hrm" },
  // Clinical pages — one key per page.
  { key: "rx-dashboard", label: "Doctor Dashboard", path: "/rx-dashboard" },
  { key: "rx-write", label: "Prescriptions", path: "/prescriptions" },
  { key: "rx-lists", label: "My Rx Lists", path: "/rx-lists" },
  { key: "rx-staff", label: "My Staff", path: "/rx-staff" },
  { key: "rx-appointments", label: "Patient Queue", path: "/rx-appointments" },
  { key: "clinic-dashboard", label: "Clinic Dashboard", path: "/clinic-dashboard" },
  { key: "clinic-doctors", label: "Clinic Doctors", path: "/clinic-doctors" },
  { key: "clinic-services", label: "Products & Services", path: "/clinic-services" },
  { key: "clinic-sales", label: "Clinic Sales", path: "/clinic-sales" },
  { key: "clinic-plans", label: "Treatment Plans (EMI)", path: "/clinic-plans" },
  { key: "lab-reports", label: "Lab Reports", path: "/lab-reports" },
  { key: "rx-billing", label: "Rx Billing", path: "/rx-billing" },
  { key: "rx-credit-history", label: "Credit & Payment History", path: "/rx-credit-history" },
  { key: "biz-settings", label: "Business Settings", path: "/settings/business" },
];

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

const DEFAULT_SALESMAN = ["pos", "purchases", "quick-box"];

// Sections every signed-in user can always reach, regardless of role config.
const ALWAYS_ALLOWED = ["quick-box"];

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

function withAlways(list: string[]) {
  const expanded = expandSections(list) ?? [];
  if (isPrescriptionOnly(expanded)) return expanded;
  return Array.from(new Set([...expanded, ...ALWAYS_ALLOWED]));
}

export function useAllowedSections() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin, isDoctor, isAssistant, isClinicAdmin, isLoading: roleLoading } = useCurrentRole();
  const clinicalOnlyRole = isDoctor || isAssistant || isClinicAdmin;

  const q = useQuery({
    queryKey: ["allowed-sections", business?.id],
    enabled: !!business?.id && !roleLoading,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return withAlways(DEFAULT_SALESMAN);
      const { data: ur } = await supabase
        .from("user_roles")
        .select("role_id, allowed_sections")
        .eq("user_id", userId)
        .eq("business_id", business!.id)
        .maybeSingle();
      if (!ur) return isAdmin ? null : withAlways(DEFAULT_SALESMAN);
      const userOverride = (ur as any).allowed_sections as string[] | null;
      if (userOverride && userOverride.length) return withAlways(userOverride);
      if (isAdmin && !ur.role_id) return null;
      const { data: role } = await supabase
        .from("roles")
        .select("allowed_sections")
        .eq("id", ur.role_id)
        .maybeSingle();
      const list = (role as any)?.allowed_sections as string[] | null;
      if (list && list.length) return withAlways(list);
      // Admins with no section limit configured keep full access.
      return isAdmin ? null : withAlways(DEFAULT_SALESMAN);
    },
  });

  const raw = isAdmin
    ? (q.data ?? null)
    : (q.data ?? withAlways(DEFAULT_SALESMAN));
  // A Doctor / Assistant account with no explicit grant stays clinical-only.
  // When the super admin has explicitly picked sections for that user, those
  // picks win — that is how POS-only or POS + Rx access is handed out.
  const hasExplicitGrant = Array.isArray(q.data) && q.data.length > 0;
  const sections =
    raw && clinicalOnlyRole && !hasExplicitGrant
      ? (isClinicAdmin ? DEFAULT_CLINIC : DEFAULT_DOCTOR)
      : raw;

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

// First landing path for a set of allowed sections (Assistant → Patient Queue).
export function sectionHomePath(sections: string[] | null) {
  const list = expandSections(sections) ?? [];
  if (list.length === 0) return "/dashboard";
  if (list.includes("dashboard")) return "/dashboard";
  if (list.includes("clinic-dashboard")) return "/clinic-dashboard";
  if (list.includes("rx-dashboard")) return "/rx-dashboard";
  if (list.includes("rx-appointments")) return "/rx-appointments";
  if (list.includes("rx-write")) return "/prescriptions";
  if (list.includes("clinic-sales")) return "/clinic-sales";
  if (list.includes("clinic-plans")) return "/clinic-plans";
  if (list.includes("clinic-services")) return "/clinic-services";
  const match = ALL_SECTIONS.find((s) => list.includes(s.key));
  return match?.path ?? "/pos";
}
