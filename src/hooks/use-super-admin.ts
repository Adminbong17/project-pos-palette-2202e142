import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SUPER_ADMIN_EMAIL = "admin@bongbangla.top";

/** True only for the platform owner account — not for per-business admins. */
export function useIsSuperAdmin() {
  const q = useQuery({
    queryKey: ["is-super-admin"],
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email ?? (await supabase.auth.getUser()).data.user?.email ?? "";
      return email.toLowerCase() === SUPER_ADMIN_EMAIL;
    },
  });
  return { isSuperAdmin: !!q.data, isLoading: q.isLoading };
}
