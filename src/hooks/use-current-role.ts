import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "./use-current-business";
import { useIsSuperAdmin } from "./use-super-admin";

function normalizeRole(role: string | null) {
  if (!role) return null;
  if (role === "Admin" || role.startsWith("Admin#")) return "Admin";
  if (role === "Salesman") return "Salesman";
  return role;
}

export function useCurrentRole() {
  const { isSuperAdmin } = useIsSuperAdmin();
  const { data: business, isLoading: bizLoading } = useCurrentBusiness();
  const q = useQuery({
    queryKey: ["current-role", business?.id],
    enabled: !isSuperAdmin && !!business?.id,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_user_role_name", {
        _business_id: business!.id,
      });
      if (error) throw error;
      return normalizeRole((data as string | null) ?? null);
    },
  });
  return {
    role: isSuperAdmin ? "Admin" : (q.data ?? null),
    isLoading: isSuperAdmin ? false : (bizLoading || q.isLoading),
    isSalesman: !isSuperAdmin && q.data === "Salesman",
    isAdmin: isSuperAdmin || q.data === "Admin",
    isDoctor: !isSuperAdmin && q.data === "Doctor",
    isAssistant: !isSuperAdmin && q.data === "Assistant",
    isClinicAdmin: !isSuperAdmin && q.data === "Clinic Admin",
  };
}
