import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardList,
  UserCog,
  ListChecks,
  Building2,
  KeyRound,
  MessageSquare,
  Wallet,
} from "lucide-react";
import { useCurrentRole } from "@/hooks/use-current-role";
import { isRxMode } from "@/lib/rx-mode";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin — QweekPOS" },
      {
        name: "description",
        content:
          "Admin hub: manage prescriptions, doctors and approvals, prescription option lists and business requests.",
      },
      { property: "og:title", content: "Admin — QweekPOS" },
      {
        property: "og:description",
        content: "Central admin hub for prescriptions, doctors and business settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminHub,
});

const CARDS = [
  {
    to: "/admin/prescriptions",
    label: "Admin Prescriptions",
    desc: "See and manage every prescription in the system.",
    icon: ClipboardList,
    rx: true,
  },
  {
    to: "/admin/doctors",
    label: "Doctors & Approvals",
    desc: "Approve signups, set roles and allowed sections.",
    icon: UserCog,
    rx: true,
  },
  {
    to: "/rx-options",
    label: "Manage Rx Options",
    desc: "C/C, investigations, frequencies, instructions and advice lists.",
    icon: ListChecks,
    rx: true,
  },
  {
    to: "/admin/users",
    label: "All Users & Logins",
    desc: "Every account with email, username, role and password control.",
    icon: KeyRound,
    rx: true,
    superOnly: true,
  },
  {
    to: "/admin/sms",
    label: "SMS Gateway",
    desc: "API key, secret key and sender ID for all SMS sending.",
    icon: MessageSquare,
    rx: true,
    superOnly: true,
  },
  {
    to: "/admin/rx-credit-links",
    label: "Credit Purchase Links",
    desc: "Payment links for clinics and doctors, and manual top-up approvals.",
    icon: Wallet,
    rx: true,
    superOnly: true,
  },
  {
    to: "/admin/business-requests",
    label: "Business Requests",
    desc: "Review new business signup requests.",
    icon: Building2,
    rx: false,
    superOnly: true,
  },
];

function AdminHub() {
  const { isAdmin, isLoading } = useCurrentRole();
  const { isSuperAdmin, isLoading: superLoading } = useIsSuperAdmin();
  const rxMode = isRxMode();

  if (isLoading || superLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="font-display text-xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This area is only available to admins.
        </p>
      </div>
    );
  }

  // Platform-wide tools (all users, business requests) stay with the super
  // admin; a business owner only sees tools scoped to their own business.
  const cards = (rxMode ? CARDS.filter((c) => c.rx) : CARDS).filter(
    (c: any) => (c.superOnly ? isSuperAdmin : true),
  );

  return (
    <div className="p-4 sm:p-6">
      <h1 className="font-display text-xl font-semibold sm:text-2xl">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose what you want to manage.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to as any}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <c.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{c.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{c.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
