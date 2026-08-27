import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "./use-current-business";
import { useCurrentRole } from "./use-current-role";

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
  { key: "settings", label: "Settings", path: "/settings" },
  { key: "quick-box", label: "Quick Box Add", path: "/quick-box" },
  { key: "manufacturing", label: "Manufacturing", path: "/manufacturing" },
  { key: "restaurant", label: "Restaurant", path: "/restaurant" },
  { key: "repair", label: "Repair", path: "/repair" },
  { key: "crm", label: "CRM", path: "/crm" },
  { key: "hrm", label: "HRM", path: "/hrm" },
  { key: "prescriptions", label: "Doctor Dashboard", path: "/rx-dashboard" },
  { key: "clinic", label: "Clinic Dashboard", path: "/clinic-dashboard" },
  { key: "clinic", label: "Clinic Doctors", path: "/clinic-doctors" },
  { key: "clinic", label: "Products & Services", path: "/clinic-services" },
  { key: "clinic", label: "Clinic Sales", path: "/clinic-sales" },
  { key: "clinic", label: "Treatment Plans (EMI)", path: "/clinic-plans" },
  { key: "clinic", label: "Lab Reports", path: "/lab-reports" },
  { key: "clinic-sales", label: "Lab Reports", path: "/lab-reports" },
  { key: "prescriptions", label: "Lab Reports", path: "/lab-reports" },
  { key: "clinic-plans", label: "Treatment Plans (EMI)", path: "/clinic-plans" },
  { key: "clinic-services", label: "Products & Services", path: "/clinic-services" },
  { key: "clinic-sales", label: "Clinic Sales", path: "/clinic-sales" },
  { key: "prescriptions", label: "Clinic Dashboard", path: "/clinic-dashboard" },
  { key: "prescriptions", label: "Prescriptions", path: "/prescriptions" },
  { key: "prescriptions", label: "My Rx Lists", path: "/rx-lists" },
  { key: "prescriptions", label: "My Staff", path: "/rx-staff" },
  // Independent doctors and their staff run their own services + treatment plans.
  { key: "prescriptions", label: "Services & Fees", path: "/clinic-services" },
  { key: "prescriptions", label: "Treatment Plans (EMI)", path: "/clinic-plans" },
  { key: "rx-queue", label: "Patient Queue", path: "/rx-appointments" },
  { key: "rx-queue", label: "Services & Fees", path: "/clinic-services" },
  { key: "rx-queue", label: "Treatment Plans (EMI)", path: "/clinic-plans" },
  { key: "prescriptions", label: "Rx Billing", path: "/rx-billing" },
  { key: "prescriptions", label: "Credit & Payment History", path: "/rx-credit-history" },
  { key: "clinic", label: "Rx Billing", path: "/rx-billing" },
  { key: "clinic", label: "Credit & Payment History", path: "/rx-credit-history" },
  // Clinic / doctor accounts manage their own name, address and SMS number.
  { key: "clinic", label: "Settings", path: "/settings/business" },
  { key: "prescriptions", label: "Settings", path: "/settings/business" },


];


const DEFAULT_SALESMAN = ["pos", "purchases", "quick-box"];

// Sections every signed-in user can always reach, regardless of role config.
const ALWAYS_ALLOWED = ["quick-box"];

// Clinical-only keys: users limited to these never get POS/inventory extras.
const CLINICAL_KEYS = [
  "prescriptions",
  "rx-queue",
  "clinic",
  "clinic-services",
  "clinic-sales",
  "clinic-plans",
];

// A clinic admin only manages doctors, assistants and the serial queue.
const DEFAULT_CLINIC = ["clinic", "rx-queue"];

// A "doctor" only needs the prescription module — no POS/inventory extras.
export function isPrescriptionOnly(list: string[] | null) {
  if (!list) return false;
  return list.length > 0 && list.every((k) => CLINICAL_KEYS.includes(k));
}

function withAlways(list: string[]) {
  if (isPrescriptionOnly(list)) return list;
  return Array.from(new Set([...list, ...ALWAYS_ALLOWED]));
}

export function useAllowedSections() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin, isDoctor, isAssistant, isClinicAdmin, isLoading: roleLoading } = useCurrentRole();
  const clinicalOnlyRole = isDoctor || isAssistant || isClinicAdmin;

  const q = useQuery({
    queryKey: ["allowed-sections", business?.id],
    enabled: !!business?.id && !roleLoading,
    queryFn: async () => {
      const { data: uid } = await supabase.auth.getUser();
      const userId = uid.user?.id;
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
      ? (isClinicAdmin ? DEFAULT_CLINIC : ["prescriptions", "rx-queue"])
      : raw;



  return {
    isAdmin,
    isLoading: roleLoading || q.isLoading,
    sections,
  };
}


export function isPathAllowed(pathname: string, sections: string[] | null) {
  if (sections === null) return true;
  return ALL_SECTIONS.some(
    (s) => sections.includes(s.key) && (pathname === s.path || pathname.startsWith(s.path + "/")),
  );
}

// First landing path for a set of allowed sections (Assistant → Patient Queue).
export function sectionHomePath(sections: string[] | null) {
  if (!sections || sections.length === 0) return "/dashboard";
  if (sections.includes("clinic")) return "/clinic-dashboard";
  if (sections.includes("rx-queue") && !sections.includes("prescriptions"))
    return "/rx-appointments";
  if (sections.includes("clinic-sales")) return "/clinic-sales";
  if (sections.includes("clinic-plans")) return "/clinic-plans";
  if (sections.includes("clinic-services")) return "/clinic-services";
  if (sections.includes("prescriptions")) return "/rx-dashboard";
  if (sections.includes("dashboard")) return "/dashboard";
  const match = ALL_SECTIONS.find((s) => sections.includes(s.key));
  return match?.path ?? "/pos";
}
