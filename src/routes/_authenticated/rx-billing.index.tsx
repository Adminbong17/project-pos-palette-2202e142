import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet, Receipt, History } from "lucide-react";

import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { useClinicDoctors } from "@/hooks/use-clinic-doctors";
import { useRxBillingState, rxTierRate } from "@/hooks/use-rx-billing";
import { RxBillingBanner } from "@/components/rx-billing-banner";
import { ClinicCreditsCard } from "@/components/clinic-credits-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/rx-billing/")({
  component: RxBillingOverview,
});

function RxBillingOverview() {
  const { data: business } = useCurrentBusiness();
  const { isDoctor, isAdmin } = useCurrentRole();
  // Doctors working under a clinic are funded by their clinic, not the platform.
  const clinicFunded = !!business?.clinic_mode && isDoctor && !isAdmin;
  // Clinic admins manage the shared pool and hand credits to their doctors.
  const clinicAdmin = !!business?.clinic_mode && isAdmin;
  const clinicDoctors = useClinicDoctors(clinicAdmin ? business?.id : undefined);
  const { state, isLoading } = useRxBillingState();

  if (clinicFunded) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-primary" /> Credits from your clinic
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-2xl font-semibold">{isLoading ? "…" : state.credits}</p>
          <p className="text-xs text-muted-foreground">
            You are under a clinic, so your clinic provides your prescription credits — there is no
            platform bill for you. Ask your clinic admin to add more when they run out.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        1 credit = 1 prescription. On subscription: first 100 prescriptions ৳5 each, above 100 all
        become ৳4 each, above 200 all become ৳3 each — counted fresh every month and billed by SMS.
      </p>

      <RxBillingBanner />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-primary" /> Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">{isLoading ? "…" : state.mode}</p>
            {state.mode === "credit" && (
              <p className="text-xs text-muted-foreground">{state.credits} credit(s) left</p>
            )}
            {state.mode === "free" && (
              <p className="text-xs text-muted-foreground">No charge for your account.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Receipt className="h-4 w-4 text-primary" /> This month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{state.month_count} prescriptions</p>
            <p className="text-xs text-muted-foreground">
              ৳{state.month_amount} at ৳{rxTierRate(state.month_count)} each
            </p>
          </CardContent>
        </Card>
      </div>

      {clinicAdmin && (
        <ClinicCreditsCard
          businessId={business?.id}
          doctors={(clinicDoctors.data ?? []).map((d) => ({ user_id: d.user_id, name: d.name }))}
        />
      )}

      <div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/rx-credit-history">
            <History className="h-4 w-4" /> Payment &amp; credit history
          </Link>
        </Button>
      </div>
    </div>
  );
}
