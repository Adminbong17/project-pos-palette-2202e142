import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useAllowedSections, isPathAllowed } from "@/hooks/use-allowed-sections";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — QweekPOS" }] }),
  component: SettingsLayout,
});

const tabs = [
  { to: "/settings/business", label: "Business" },
  { to: "/settings/locations", label: "Locations" },
  { to: "/settings/tax-rates", label: "Tax Rates" },
  { to: "/settings/units", label: "Units" },
  { to: "/settings/brands", label: "Brands" },
  { to: "/settings/categories", label: "Categories" },
] as const;

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, sections } = useAllowedSections();
  // Clinic / doctor accounts only reach the Business tab — hide the rest.
  const visibleTabs = tabs.filter((t) => isAdmin || isPathAllowed(t.to, sections));
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your business configuration and master data.</p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-border/60">
        {tabs.map((t) => {
          const active = pathname === t.to;
          return (
            <Link key={t.to} to={t.to}
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${active
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
