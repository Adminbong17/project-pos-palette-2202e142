import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wallet, CheckCircle2 } from "lucide-react";

import { getCreditLink, submitCreditOrder } from "@/lib/rx-credit-links.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/rx-pay/$token")({
  head: () => ({
    meta: [
      { title: "Buy Rx Credits — QweekRx" },
      {
        name: "description",
        content:
          "Top up prescription credits: send the amount by bKash, Nagad or bank and submit the transaction reference to get credits added.",
      },
      { property: "og:title", content: "Buy Rx Credits — QweekRx" },
      {
        property: "og:description",
        content: "Manual bKash / Nagad / bank top-up for QweekRx prescription credits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RxPayPage,
});

const METHODS = ["bkash", "nagad", "rocket", "bank"];

function RxPayPage() {
  const { token } = Route.useParams();
  const load = useServerFn(getCreditLink);
  const submit = useServerFn(submitCreditOrder);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bkash");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [txn, setTxn] = useState("");
  const [done, setDone] = useState<{ credits: number; amount: number } | null>(null);

  const link = useQuery({
    queryKey: ["credit-link", token],
    queryFn: async () => await load({ data: { token } }),
  });

  const rate = link.data?.found ? link.data.rate_per_credit : 3;
  const credits = Math.floor((Number(amount) || 0) / rate);

  const send = useMutation({
    mutationFn: async () =>
      await submit({
        data: {
          token,
          amount: Number(amount) || 0,
          method,
          payer_name: name,
          payer_phone: phone,
          txn_ref: txn,
        },
      }),
    onSuccess: (res: any) => setDone({ credits: res.credits, amount: res.amount }),
    onError: (e: any) => toast.error(e?.message ?? "Could not submit payment"),
  });

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 sm:py-12">
      <h1 className="font-display text-2xl font-semibold">Buy prescription credits</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pay manually, then submit the transaction reference. Credits are added once the platform
        admin confirms the payment.
      </p>

      {link.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : !link.data?.found ? (
        <p className="mt-6 text-sm text-destructive">This payment link is not valid.</p>
      ) : done ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <p className="text-sm font-semibold">Payment submitted</p>
            <p className="text-sm text-muted-foreground">
              {done.amount} tk · {done.credits} credit(s) will be added after admin confirmation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              {link.data.business_name} · {link.data.target_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              Rate: <span className="font-semibold text-foreground">{rate} tk = 1 credit</span> (e.g.
              30 tk = {Math.floor(30 / rate)} credits).
              {link.data.label ? (
                <>
                  <br />
                  {link.data.label}
                </>
              ) : null}
            </p>

            {!link.data.active ? (
              <p className="text-sm text-destructive">
                This link is closed — contact the platform admin.
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium">
                    Amount paid (tk)
                    <Input
                      className="mt-1"
                      inputMode="numeric"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="30"
                    />
                  </label>
                  <label className="text-xs font-medium">
                    Payment method
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      {METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium">
                    Your name
                    <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
                  </label>
                  <label className="text-xs font-medium">
                    Your phone
                    <Input
                      className="mt-1"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                    />
                  </label>
                  <label className="text-xs font-medium sm:col-span-2">
                    Transaction ID / reference
                    <Input className="mt-1" value={txn} onChange={(e) => setTxn(e.target.value)} />
                  </label>
                </div>

                <p className="text-sm">
                  You will get <span className="font-semibold">{credits}</span> credit(s).
                </p>

                <Button
                  className="w-full"
                  disabled={send.isPending || credits < 1}
                  onClick={() => send.mutate()}
                >
                  {send.isPending ? "Submitting…" : "Submit payment"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
