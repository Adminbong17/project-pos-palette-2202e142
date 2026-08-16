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
};

export function useCurrentBusiness() {
  return useQuery({
    queryKey: ["current-business"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_business_id")
        .eq("id", u.user.id)
        .maybeSingle();

      let bizId = profile?.current_business_id ?? null;
      if (!bizId) {
        // fall back to first membership
        const { data: bu } = await supabase
          .from("business_users")
          .select("business_id")
          .eq("user_id", u.user.id)
          .limit(1)
          .maybeSingle();
        bizId = bu?.business_id ?? null;
      }
      if (!bizId) return null;

      const { data: biz } = await supabase
        .from("businesses")
        .select("id, name, owner_id, currency_id, sku_prefix, logo, time_zone, clinic_mode")
        .eq("id", bizId)
        .maybeSingle();
      return (biz as Business) ?? null;
    },
  });
}
