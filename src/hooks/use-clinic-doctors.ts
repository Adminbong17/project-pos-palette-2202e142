import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClinicDoctorLite = { user_id: string; name: string; email: string };

/**
 * Doctors that belong to a clinic business (role name starting with "Doctor").
 * Shared by Clinic Doctors and the Rx Billing dashboard.
 */
export function useClinicDoctors(businessId?: string) {
  return useQuery({
    queryKey: ["clinic-doctors-lite", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: bus } = await supabase
        .from("business_users")
        .select("user_id")
        .eq("business_id", businessId!)
        .eq("is_active", true);
      const ids = (bus ?? []).map((b) => b.user_id);
      if (!ids.length) return [] as ClinicDoctorLite[];
      const [{ data: roles }, { data: userRoles }, { data: profiles }] = await Promise.all([
        supabase.from("roles").select("id, name").eq("business_id", businessId!),
        supabase
          .from("user_roles")
          .select("user_id, role_id")
          .eq("business_id", businessId!)
          .in("user_id", ids),
        supabase
          .from("profiles")
          .select("id, email, first_name, last_name, doctor_name")
          .in("id", ids),
      ]);
      const roleById = new Map((roles ?? []).map((r) => [r.id, String(r.name ?? "")] as const));
      const doctorIds = new Set(
        (userRoles ?? [])
          .filter((ur) => ur.role_id && (roleById.get(ur.role_id) ?? "").startsWith("Doctor"))
          .map((ur) => ur.user_id),
      );
      return (profiles ?? [])
        .filter((p) => doctorIds.has(p.id))
        .map((p: any) => ({
          user_id: p.id,
          name:
            p.doctor_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "—",
          email: p.email ?? "—",
        })) as ClinicDoctorLite[];
    },
  });
}
