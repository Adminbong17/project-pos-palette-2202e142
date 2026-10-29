import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isSuperAdminEmail, SUPER_ADMIN_EMAIL, SUPER_ADMIN_EMAILS } from "@/lib/super-admin-auth";

export { SUPER_ADMIN_EMAIL, SUPER_ADMIN_EMAILS, isSuperAdminEmail };

/** True only for the platform owner accounts — not for per-business admins. */
export function useIsSuperAdmin() {
  const q = useQuery({
    queryKey: ["is-super-admin"],
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email;
      if (email) return isSuperAdminEmail(email);
      const { data } = await supabase.auth.getUser();
      return isSuperAdminEmail(data.user?.email ?? "");
    },
  });
  return { isSuperAdmin: !!q.data, isLoading: q.isLoading };
}
