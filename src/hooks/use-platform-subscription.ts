import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyBusinessSubscription, type CurrentSubscriptionStatus } from "@/lib/subscriptions.functions";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";

export function usePlatformSubscription() {
  const { isSuperAdmin } = useIsSuperAdmin();
  const getSub = useServerFn(getMyBusinessSubscription);

  const q = useQuery({
    queryKey: ["my-platform-subscription"],
    // Super admins are never locked or billed
    enabled: !isSuperAdmin,
    staleTime: 60_000,
    queryFn: async () => await getSub({ data: undefined as never }),
  });

  const sub = q.data as CurrentSubscriptionStatus | null;

  return {
    isLoading: q.isLoading,
    sub,
    isLocked: !isSuperAdmin && !!sub?.is_locked,
    isDueWarning: !isSuperAdmin && !!sub?.is_due_warning,
    isPaid: sub?.is_paid === true,
    isFree: sub?.is_free === true,
    refetch: q.refetch,
  };
}
