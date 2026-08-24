import { AlertTriangle, PhoneCall, CreditCard } from "lucide-react";
import { useRxBillingState, rxTierRate } from "@/hooks/use-rx-billing";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { Button } from "@/components/ui/button";

/**
 * Shows the doctor's prescription billing status:
 *  - red lock banner when a bill is overdue (after the 5th) or credits ran out
 *  - a quiet summary line otherwise (credits left / running month bill)
 */
export function RxBillingBanner({ compact = false }: { compact?: boolean }) {
  const { isLoading, state, locked, outOfCredits } = useRxBillingState();
  const { data: business } = useCurrentBusiness();
  const { isDoctor, isAdmin } = useCurrentRole();
  // Doctors inside a clinic are funded by the clinic: no payment links / helpline.
  const clinicFunded = !!business?.clinic_mode && isDoctor && !isAdmin;
  if (isLoading || state.mode === "free") return null;

  const helpline = state.helpline || "01712472839";

  if (locked || outOfCredits) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
        <div className="flex flex-wrap items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-destructive">
              {locked ? "Prescription writing is locked" : "No prescription credits left"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {locked
                ? `Your bill for ${state.overdue_bill?.period_start?.slice(0, 7) ?? "last month"} (৳${
                    state.overdue_bill?.amount ?? 0
                  }) was due on ${state.overdue_bill?.due_date ?? "the 5th"}. Please pay to continue.`
                : clinicFunded
                  ? "Ask your clinic admin to add prescription credits to your account."
                  : "Ask the admin to add credits to your account to continue."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!clinicFunded && state.payment_link && (
                <Button size="sm" asChild>
                  <a href={state.payment_link} target="_blank" rel="noreferrer">
                    <CreditCard className="mr-1 h-4 w-4" /> Pay bill
                  </a>
                </Button>
              )}
              {!clinicFunded && (
              <Button size="sm" variant="outline" asChild>
                <a href={`tel:${helpline}`}>
                  <PhoneCall className="mr-1 h-4 w-4" /> Helpline {helpline}
                </a>
              </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <p className="text-xs text-muted-foreground">
        {state.mode === "credit"
          ? `${state.credits} prescription credit(s) left`
          : `${state.month_count} this month · ৳${state.month_amount} (৳${rxTierRate(state.month_count)}/Rx)`}
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      {state.mode === "credit" ? (
        <span>
          <span className="font-semibold">{state.credits}</span> prescription credit(s) left · used{" "}
          {state.month_count} this month
        </span>
      ) : (
        <span>
          <span className="font-semibold">{state.month_count}</span> prescriptions this month ·
          running bill <span className="font-semibold">৳{state.month_amount}</span> (৳
          {rxTierRate(state.month_count)} each) · due by the 5th of next month
        </span>
      )}
    </div>
  );
}
