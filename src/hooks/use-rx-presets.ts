import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeUnicodeText } from "@/lib/unicode-sanitize";
import { toast } from "sonner";

export type PresetKind =
  | "cc"
  | "vital"
  | "investigation"
  | "frequency"
  | "advice"
  | "instruction"
  | "medicine";

export type Preset = { id: string; name: string };

const EMPTY_PRESETS: Preset[] = [];

/**
 * Per-doctor personal lists (C/C, vitals, investigations, frequencies,
 * advice, medicines). Rows live in `rx_presets` and are visible only to the
 * doctor who created them — nothing is written to the shared product catalog.
 */
export function useRxPresets(kind: PresetKind, businessId: string | undefined) {
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ["auth-uid"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const uid = me.data ?? undefined;

  const list = useQuery({
    queryKey: ["rx-presets", kind, uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rx_presets")
        .select("id, name")
        .eq("user_id", uid!)
        .eq("kind", kind)
        .order("name")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Preset[];
    },
  });

  const add = useMutation({
    mutationFn: async (name: string) => {
      const n = sanitizeUnicodeText(name).trim();
      if (!n) return;
      if (!uid || !businessId) throw new Error("Not ready");
      if ((list.data ?? []).some((p) => p.name.toLowerCase() === n.toLowerCase())) return;
      const { error } = await supabase
        .from("rx_presets")
        .insert({ user_id: uid, business_id: businessId, kind, name: n });
      if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rx-presets", kind, uid] }),
    onError: (e: any) => toast.error(e.message ?? "Could not save to your list"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rx_presets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rx-presets", kind, uid] }),
    onError: (e: any) => toast.error(e.message ?? "Could not remove"),
  });

  const items = list.data ?? EMPTY_PRESETS;
  const addFn = useCallback((name: string) => add.mutate(name), [add]);
  const removeFn = useCallback((id: string) => remove.mutate(id), [remove]);

  return useMemo(
    () => ({
      items,
      isLoading: list.isLoading,
      add: addFn,
      remove: removeFn,
    }),
    [items, list.isLoading, addFn, removeFn],
  );
}
