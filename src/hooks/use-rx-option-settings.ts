import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RxOptionKind = "cc" | "investigation" | "frequency" | "instruction" | "advice";

export const RX_OPTION_KINDS: { kind: RxOptionKind; label: string }[] = [
  { kind: "cc", label: "C/C (Chief Complaints)" },
  { kind: "investigation", label: "Investigations" },
  { kind: "frequency", label: "Frequencies" },
  { kind: "instruction", label: "Rx Instructions" },
  { kind: "advice", label: "Advices" },
];

/**
 * Business-level switches for the SHARED (default) prescription option lists,
 * plus the signed-in doctor's personal override (set by an admin).
 * When a kind is switched off, doctors only see their own personal presets
 * for that kind while writing a prescription.
 */
export function useRxOptionSettings(businessId: string | undefined) {
  const qc = useQueryClient();
  const key = ["rx-option-settings", businessId];

  const q = useQuery({
    queryKey: key,
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rx_option_settings")
        .select("kind, enabled")
        .eq("business_id", businessId!);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      for (const r of data ?? []) map[r.kind as string] = r.enabled;
      return map;
    },
  });

  // Per-doctor override for the signed-in user (admin-managed).
  const mine = useQuery({
    queryKey: ["rx-option-settings-mine", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return {} as Record<string, boolean>;
      const { data, error } = await supabase
        .from("rx_user_option_settings")
        .select("kind, enabled")
        .eq("business_id", businessId!)
        .eq("user_id", uid);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      for (const r of data ?? []) map[r.kind as string] = r.enabled;
      return map;
    },
  });

  const setEnabled = useMutation({
    mutationFn: async ({ kind, enabled }: { kind: RxOptionKind; enabled: boolean }) => {
      if (!businessId) throw new Error("No business");
      const { error } = await supabase
        .from("rx_option_settings")
        .upsert({ business_id: businessId, kind, enabled }, { onConflict: "business_id,kind" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toast.error(e.message ?? "Could not save setting"),
  });

  // default: shared defaults are ON when no row exists.
  // A per-doctor row always wins over the business default.
  const isEnabled = (kind: RxOptionKind) => {
    const mineVal = mine.data?.[kind];
    if (typeof mineVal === "boolean") return mineVal;
    return q.data?.[kind] !== false;
  };

  return {
    isLoading: q.isLoading || mine.isLoading,
    isEnabled,
    setEnabled: (kind: RxOptionKind, enabled: boolean) => setEnabled.mutate({ kind, enabled }),
    isSaving: setEnabled.isPending,
  };
}

/**
 * Admin view/edit of ONE doctor's shared-list overrides inside a business.
 * `null` for a kind means "follow the business default".
 */
export function useRxUserOptionSettings(businessId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  const key = ["rx-user-option-settings", businessId, userId];

  const q = useQuery({
    queryKey: key,
    enabled: !!businessId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rx_user_option_settings")
        .select("kind, enabled")
        .eq("business_id", businessId!)
        .eq("user_id", userId!);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      for (const r of data ?? []) map[r.kind as string] = r.enabled;
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async ({ kind, enabled }: { kind: RxOptionKind; enabled: boolean | null }) => {
      if (!businessId || !userId) throw new Error("Not ready");
      if (enabled === null) {
        const { error } = await supabase
          .from("rx_user_option_settings")
          .delete()
          .eq("business_id", businessId)
          .eq("user_id", userId)
          .eq("kind", kind);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("rx_user_option_settings")
        .upsert(
          { business_id: businessId, user_id: userId, kind, enabled },
          { onConflict: "business_id,user_id,kind" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["rx-option-settings-mine", businessId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  return {
    isLoading: q.isLoading,
    /** true / false / null (= follow business default) */
    valueOf: (kind: RxOptionKind): boolean | null => {
      const v = q.data?.[kind];
      return typeof v === "boolean" ? v : null;
    },
    set: (kind: RxOptionKind, enabled: boolean | null) => save.mutate({ kind, enabled }),
    isSaving: save.isPending,
  };
}
