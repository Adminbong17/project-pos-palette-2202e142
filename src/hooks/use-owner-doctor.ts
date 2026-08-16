import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The doctor a clinical record belongs to for the signed-in user:
 * a doctor owns their own records, an assistant works under their doctor.
 * Keeps one doctor's data out of another doctor's screens.
 */
export function useOwnerDoctorId(businessId?: string) {
  const q = useQuery({
    queryKey: ["owner-doctor-id", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("rx_staff")
        .select("doctor_id")
        .eq("business_id", businessId!)
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.doctor_id as string | undefined) ?? uid;
    },
  });
  return { doctorId: q.data ?? null, isLoading: q.isLoading };
}
