import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SUPER_ADMIN_EMAIL = "admin@bongbangla.top";

/** True only for the platform owner account — not for per-business admins. */
export function useIsSuperAdmin() {
  const q = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return (data.user?.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL;
    },
  });
  return { isSuperAdmin: !!q.data, isLoading: q.isLoading };
}
