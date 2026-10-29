import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Business = {
  id: string;
  name: string;
  owner_id: string;
  currency_id: number;
  sku_prefix: string | null;
  logo: string | null;
  time_zone: string;
  clinic_mode?: boolean | null;
  clinic_type?: "general" | "dental" | null;
  notify_phone?: string | null;
  address?: string | null;
};

export function useCurrentBusiness() {
  return useQuery({
    queryKey: ["current-business"],
    staleTime: 10 * 60 * 1000, // Fresh cache for 10 minutes — fast navigation without re-fetching
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("current_business_id")
        .eq("id", userId)
        .maybeSingle();

      let bizId = profile?.current_business_id ?? null;

      // Fast path: fetch business directly
      if (bizId) {
        const { data: directBiz } = await supabase
          .from("businesses")
          .select(
            "id, name, owner_id, currency_id, sku_prefix, logo, time_zone, clinic_mode, clinic_type, notify_phone, address",
          )
          .eq("id", bizId)
          .maybeSingle();

        if (directBiz) {
          // If user owns it, return immediately (zero extra network calls!)
          if (directBiz.owner_id === userId) {
            return directBiz as Business;
          }
          // If user is an active member, return immediately
          const { data: activeCurrent } = await supabase
            .from("business_users")
            .select("business_id")
            .eq("user_id", userId)
            .eq("business_id", bizId)
            .eq("is_active", true)
            .maybeSingle();
          if (activeCurrent) {
            return directBiz as Business;
          }
        }
        bizId = null;
      }

      // Fallback 1: Business owned by this user
      if (!bizId) {
        const { data: ownedBiz } = await supabase
          .from("businesses")
          .select("id")
          .eq("owner_id", userId)
          .limit(1)
          .maybeSingle();
        bizId = ownedBiz?.id ?? null;
      }

      // Fallback 2: First active business membership
      if (!bizId) {
        const { data: bu } = await supabase
          .from("business_users")
          .select("business_id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        bizId = bu?.business_id ?? null;
      }

      // Fallback 3: First available business on platform
      if (!bizId) {
        const { data: firstBiz } = await supabase
          .from("businesses")
          .select("id")
          .limit(1)
          .maybeSingle();
        bizId = firstBiz?.id ?? null;
      }

      if (!bizId) return null;

      const { data: biz } = await supabase
        .from("businesses")
        .select(
          "id, name, owner_id, currency_id, sku_prefix, logo, time_zone, clinic_mode, clinic_type, notify_phone, address",
        )
        .eq("id", bizId)
        .maybeSingle();
      return (biz as Business) ?? null;
    },
  });
}
