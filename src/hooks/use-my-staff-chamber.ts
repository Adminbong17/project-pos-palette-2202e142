import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffChamberAccess = {
  id: string;
  chamber_id: string | null;
  assignedChamberIds: string[];
  isAllLocations: boolean;
};

/**
 * The locations (chambers) assigned to the signed-in staff account.
 * Supports multiple locations or all locations access.
 */
export function useMyStaffChamber(businessId?: string) {
  return useQuery({
    queryKey: ["my-staff-chamber", businessId],
    enabled: !!businessId,
    queryFn: async (): Promise<StaffChamberAccess | null> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("rx_staff")
        .select("id, chamber_id, allowed_sections")
        .eq("business_id", businessId!)
        .eq("user_id", uid)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const rawSections = ((data as any).allowed_sections ?? []) as string[];
      const chamberFromSections = rawSections
        .filter((s) => typeof s === "string" && s.startsWith("chamber:"))
        .map((s) => s.replace("chamber:", ""));

      const assignedChamberIds = Array.from(
        new Set([
          ...chamberFromSections,
          ...(data.chamber_id ? [data.chamber_id] : []),
        ])
      );

      // If no specific chambers are tagged and chamber_id is empty, staff has access to all locations
      const isAllLocations = assignedChamberIds.length === 0 && !data.chamber_id;

      return {
        id: data.id,
        chamber_id: data.chamber_id ?? assignedChamberIds[0] ?? null,
        assignedChamberIds,
        isAllLocations,
      };
    },
  });
}

