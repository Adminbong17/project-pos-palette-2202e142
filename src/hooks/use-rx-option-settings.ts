import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RxOptionKind = "cc" | "investigation" | "frequency" | "instruction" | "advice";

/**
 * Business-level switches for the SHARED (default) prescription option lists.
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

  // default: shared defaults are ON when no row exists
  const isEnabled = (kind: RxOptionKind) => q.data?.[kind] !== false;

  return {
    isLoading: q.isLoading,
    isEnabled,
    setEnabled: (kind: RxOptionKind, enabled: boolean) => setEnabled.mutate({ kind, enabled }),
    isSaving: setEnabled.isPending,
  };
}
