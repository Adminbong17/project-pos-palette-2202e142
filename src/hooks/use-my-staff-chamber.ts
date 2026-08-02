import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The location (chamber) a doctor assigned to the signed-in staff account.
 * Doctors pick this on the "My Staff" page — assistants cannot change it.
 */
export function useMyStaffChamber(businessId?: string) {
  return useQuery({
    queryKey: ["my-staff-chamber", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("rx_staff")
        .select("id, chamber_id")
        .eq("business_id", businessId!)
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return (data as { id: string; chamber_id: string | null } | null) ?? null;
    },
  });
}
