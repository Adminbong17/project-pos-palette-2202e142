import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Wallet, ShoppingCart, Receipt, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rx-billing")({
  head: () => ({
    meta: [
      { title: "Rx Billing & Credits — QweekRx" },
      {
        name: "description",
        content:
          "See your prescription credits, this month's prescription bill, verify your phone number for SMS bills and pay outstanding invoices.",
      },
      { property: "og:title", content: "Rx Billing & Credits — QweekRx" },
      {
        property: "og:description",
        content: "Prescription credits, monthly billing and phone verification for doctors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RxBillingLayout,
});

const tabs = [
  { to: "/rx-billing", label: "Overview", icon: Wallet, exact: true },
  { to: "/rx-billing/buy", label: "Buy Credits", icon: ShoppingCart },
  { to: "/rx-billing/bills", label: "Monthly Bills", icon: Receipt },
  { to: "/rx-billing/phone", label: "Bill SMS Number", icon: ShieldCheck },
];

function RxBillingLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Rx Billing &amp; Credits</h1>
        <p className="text-sm text-muted-foreground">
          Each part on its own page — plan overview, buying credits, monthly bills and the SMS number
          used for bill alerts.
        </p>
      </div>
      <nav className="flex flex-wrap gap-1.5 border-b border-border/60 pb-2">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to as any}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
