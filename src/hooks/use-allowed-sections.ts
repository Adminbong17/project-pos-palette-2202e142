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
  { key: "reports", label: "Reports", path: "/reports" },
  { key: "settings", label: "Settings", path: "/settings" },
  { key: "quick-box", label: "Quick Box Add", path: "/quick-box" },
  { key: "prescriptions", label: "Doctor Dashboard", path: "/rx-dashboard" },
  { key: "prescriptions", label: "Clinic Dashboard", path: "/clinic-dashboard" },
  { key: "prescriptions", label: "Prescriptions", path: "/prescriptions" },
  { key: "prescriptions", label: "My Rx Lists", path: "/rx-lists" },
  { key: "prescriptions", label: "My Staff", path: "/rx-staff" },
  { key: "rx-queue", label: "Patient Queue", path: "/rx-appointments" },
  { key: "prescriptions", label: "Rx Billing", path: "/rx-billing" },

];

const DEFAULT_SALESMAN = ["pos", "purchases", "quick-box"];

// Sections every signed-in user can always reach, regardless of role config.
const ALWAYS_ALLOWED = ["quick-box"];

// Clinical-only keys: users limited to these never get POS/inventory extras.
const CLINICAL_KEYS = ["prescriptions", "rx-queue"];

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
  const { isAdmin, isDoctor, isAssistant, isLoading: roleLoading } = useCurrentRole();
  const clinicalOnlyRole = isDoctor || isAssistant;

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
  // A Doctor / Assistant account never gets POS, inventory or shop dashboard
  // access, even if extra sections were toggled on for them by mistake.
  const sections =
    raw && clinicalOnlyRole
      ? (() => {
          const clinical = raw.filter((k) => CLINICAL_KEYS.includes(k));
          return clinical.length ? clinical : ["prescriptions"];
        })()
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
  if (sections.includes("rx-queue") && !sections.includes("prescriptions"))
    return "/rx-appointments";
  if (sections.includes("prescriptions")) return "/rx-dashboard";
  if (sections.includes("dashboard")) return "/dashboard";
  const match = ALL_SECTIONS.find((s) => sections.includes(s.key));
  return match?.path ?? "/pos";
}
