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
  { key: "prescriptions", label: "Prescriptions", path: "/prescriptions" },
];

const DEFAULT_SALESMAN = ["pos", "purchases", "quick-box"];

// Sections every signed-in user can always reach, regardless of role config.
const ALWAYS_ALLOWED = ["quick-box"];

function withAlways(list: string[]) {
  return Array.from(new Set([...list, ...ALWAYS_ALLOWED]));
}

export function useAllowedSections() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin, isLoading: roleLoading } = useCurrentRole();

  const q = useQuery({
    queryKey: ["allowed-sections", business?.id],
    enabled: !!business?.id && !roleLoading && !isAdmin,
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
      if (!ur) return withAlways(DEFAULT_SALESMAN);
      const userOverride = (ur as any).allowed_sections as string[] | null;
      if (userOverride && userOverride.length) return withAlways(userOverride);
      const { data: role } = await supabase
        .from("roles")
        .select("allowed_sections")
        .eq("id", ur.role_id)
        .maybeSingle();
      const list = (role as any)?.allowed_sections as string[] | null;
      return withAlways(list && list.length ? list : DEFAULT_SALESMAN);
    },
  });

  return {
    isAdmin,
    isLoading: roleLoading || (!isAdmin && q.isLoading),
    sections: isAdmin ? null : (q.data ?? withAlways(DEFAULT_SALESMAN)),
  };
}

export function isPathAllowed(pathname: string, sections: string[] | null) {
  if (sections === null) return true;
  return ALL_SECTIONS.some(
    (s) => sections.includes(s.key) && (pathname === s.path || pathname.startsWith(s.path + "/")),
  );
}
