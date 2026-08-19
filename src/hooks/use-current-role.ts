import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "./use-current-business";

function normalizeRole(role: string | null) {
  if (!role) return null;
  if (role === "Admin" || role.startsWith("Admin#")) return "Admin";
  if (role === "Salesman") return "Salesman";
  return role;
}

export function useCurrentRole() {
  const { data: business, isLoading: bizLoading } = useCurrentBusiness();
  const q = useQuery({
    queryKey: ["current-role", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_user_role_name", {
        _business_id: business!.id,
      });
      if (error) throw error;
      return normalizeRole((data as string | null) ?? null);
    },
  });
  return {
    role: q.data ?? null,
    isLoading: bizLoading || q.isLoading,
    isSalesman: q.data === "Salesman",
    isAdmin: q.data === "Admin",
    isDoctor: q.data === "Doctor",
    isAssistant: q.data === "Assistant",
    isClinicAdmin: q.data === "Clinic Admin",
  };
}
