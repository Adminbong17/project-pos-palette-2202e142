import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useRxBillingState } from "@/hooks/use-rx-billing";
import { sendRxBillingOtp, verifyRxBillingOtp } from "@/lib/rx-billing.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/rx-billing/phone")({
  component: BillPhonePage,
});

function BillPhonePage() {
  const { data: business } = useCurrentBusiness();
  const { state, refetch } = useRxBillingState();
  const send = useServerFn(sendRxBillingOtp);
  const verify = useServerFn(verifyRxBillingOtp);

  const [phone, setPhone] = useState(state.phone ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSend() {
    setBusy(true);
    try {
      const r = await send({ data: { phone } });
      setSent(true);
      toast.success(
        r.delivered ? "Code sent by SMS" : `SMS gateway not configured — your code is ${r.code}`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (!business?.id) return;
    setBusy(true);
    try {
      await verify({ data: { phone, code, businessId: business.id } });
      toast.success("Phone verified");
      setSent(false);
      setCode("");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not verify");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-primary" /> Bill SMS number
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {state.phone_verified ? `Verified: ${state.phone}` : "Not verified yet"}
        </p>
        <Input
          className="h-9 text-sm"
          placeholder="01XXXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {sent && (
          <Input
            className="h-9 text-sm"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy || !phone} onClick={onSend}>
            {sent ? "Resend code" : "Send code"}
          </Button>
          {sent && (
            <Button size="sm" disabled={busy || code.length < 6} onClick={onVerify}>
              Verify
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
