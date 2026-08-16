import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RxBillingState = {
  business_id?: string;
  account_id?: string | null;
  mode: "credit" | "subscription" | "free";
  credits: number;
  shared_pool?: boolean;
  phone?: string | null;
  phone_verified?: boolean;
  payment_link?: string | null;
  helpline?: string | null;
  month_count: number;
  month_amount: number;
  locked: boolean;
  overdue_bill?: {
    id: string;
    period_start: string;
    amount: number;
    due_date: string;
    count: number;
  } | null;
};

const FALLBACK: RxBillingState = {
  mode: "free",
  credits: 0,
  month_count: 0,
  month_amount: 0,
  locked: false,
};

/** Tiered price for the running month: 5tk ≤100, 4tk ≤200, 3tk above. */
export function rxTierAmount(count: number) {
  if (!count || count <= 0) return 0;
  if (count <= 100) return count * 5;
  if (count <= 200) return count * 4;
  return count * 3;
}

export function rxTierRate(count: number) {
  if (count <= 100) return 5;
  if (count <= 200) return 4;
  return 3;
}

/** Billing state of the signed-in doctor (credits, month bill, lock). */
export function useRxBillingState() {
  const q = useQuery({
    queryKey: ["rx-billing-state"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("rx_billing_state", {});
      if (error) throw error;
      return { ...FALLBACK, ...((data ?? {}) as RxBillingState) };
    },
  });

  const state = q.data ?? FALLBACK;
  const outOfCredits = state.mode === "credit" && (state.credits ?? 0) <= 0;

  return {
    isLoading: q.isLoading,
    state,
    locked: !!state.locked,
    outOfCredits,
    blocked: !!state.locked || outOfCredits,
    refetch: q.refetch,
  };
}
