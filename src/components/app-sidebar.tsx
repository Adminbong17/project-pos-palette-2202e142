import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck, BarChart3,
  Receipt, Wallet, Settings, Factory, UtensilsCrossed, Wrench, HeartHandshake,
  Building2, Stethoscope, ClipboardList, BookOpen, UserCog, FolderArchive, Boxes, PackagePlus, FileText, ListChecks, CalendarClock,
} from "lucide-react";
import { useAllowedSections } from "@/hooks/use-allowed-sections";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { isRxMode, RX_PATHS, RX_ONLY_PATHS } from "@/lib/rx-mode";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";


const sections = [
  {
    label: "Main",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true, key: "dashboard" },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/pos", label: "POS", icon: ShoppingCart, enabled: true, key: "pos" },
      { to: "/sales", label: "Sales", icon: Receipt, enabled: true, key: "sales" },
      { to: "/purchases", label: "Purchases", icon: Truck, enabled: true, key: "purchases" },
      { to: "/products", label: "Products", icon: Package, enabled: true, key: "products" },
      { to: "/quick-box", label: "Quick Box Add", icon: PackagePlus, enabled: true, key: "quick-box" },
      { to: "/files", label: "Files", icon: FolderArchive, enabled: true, key: "files" },
      { to: "/contacts", label: "Contacts", icon: Users, enabled: true, key: "contacts" },
      { to: "/stock-transfers", label: "Stock Transfers", icon: ClipboardList, enabled: true, key: "stock-transfers" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/expenses", label: "Expenses", icon: Wallet, enabled: true, key: "expenses" },
      { to: "/accounts", label: "Accounts", icon: BookOpen, enabled: true, key: "accounts" },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/reports", label: "All Reports", icon: BarChart3, enabled: true, key: "reports" },
      { to: "/reports/profit", label: "Profit Report", icon: Wallet, enabled: true, key: "__admin" },
      { to: "/reports/inventory-movement", label: "Inventory Movement", icon: Boxes, enabled: true, key: "reports" },
    ],
  },
  {
    label: "Modules",
    items: [
      { to: "/manufacturing", label: "Manufacturing", icon: Factory, enabled: true, key: "manufacturing" },
      { to: "/restaurant", label: "Restaurant", icon: UtensilsCrossed, enabled: true, key: "restaurant" },
      { to: "/repair", label: "Repair", icon: Wrench, enabled: true, key: "repair" },
      { to: "/crm", label: "CRM", icon: HeartHandshake, enabled: true, key: "crm" },
      { to: "/hrm", label: "HRM", icon: Users, enabled: true, key: "hrm" },
      { to: "/clinic-dashboard", label: "Clinic Dashboard", icon: Building2, enabled: true, key: "clinic" },
      { to: "/clinic-doctors", label: "Clinic Doctors", icon: Stethoscope, enabled: true, key: "clinic" },
      { to: "/clinic-services", label: "Products & Services", icon: Package, enabled: true, key: "clinic" },
      { to: "/clinic-sales", label: "Clinic Sales", icon: ShoppingCart, enabled: true, key: "clinic" },
      { to: "/clinic-plans", label: "Treatment Plans (EMI)", icon: CalendarClock, enabled: true, key: "clinic" },
      { to: "/clinic-plans", label: "Treatment Plans (EMI)", icon: CalendarClock, enabled: true, key: "clinic-plans" },
      { to: "/clinic-services", label: "Products & Services", icon: Package, enabled: true, key: "clinic-services" },
      { to: "/clinic-sales", label: "Clinic Sales", icon: ShoppingCart, enabled: true, key: "clinic-sales" },
      { to: "/clinic-dashboard", label: "Clinic Dashboard", icon: Building2, enabled: true, key: "prescriptions" },
      { to: "/rx-dashboard", label: "Doctor Dashboard", icon: LayoutDashboard, enabled: true, key: "prescriptions" },
      { to: "/prescriptions", label: "Prescriptions", icon: FileText, enabled: true, key: "prescriptions" },

      { to: "/rx-appointments", label: "Patient Queue", icon: CalendarClock, enabled: true, key: "rx-queue" },
      { to: "/rx-staff", label: "My Staff", icon: Users, enabled: true, key: "prescriptions" },
      { to: "/rx-lists", label: "My Rx Lists", icon: BookOpen, enabled: true, key: "prescriptions" },
      { to: "/rx-billing", label: "Rx Billing", icon: Wallet, enabled: true, key: "prescriptions" },
      { to: "/rx-options", label: "Manage Rx Options", icon: ListChecks, enabled: true, key: "__admin" },
      { to: "/admin/prescriptions", label: "Admin Prescription", icon: ClipboardList, enabled: true, key: "__admin" },
      { to: "/admin/doctors", label: "Doctors & Approvals", icon: UserCog, enabled: true, key: "__admin" },
      { to: "/admin/rx-billing", label: "Rx Billing Admin", icon: Wallet, enabled: true, key: "__admin" },
      { to: "/admin/businesses", superOnly: true, label: "Businesses & Modules", icon: Building2, enabled: true, key: "__admin" },
      { to: "/admin/users", superOnly: true, label: "All Users & Logins", icon: UserCog, enabled: true, key: "__admin" },
      { to: "/admin/backups", superOnly: true, label: "Backups & Restore", icon: FolderArchive, enabled: true, key: "__admin" },
      { to: "/admin", superOnly: true, label: "Admin Hub", icon: Settings, enabled: true, key: "__admin" },

    ],
  },
  {
    label: "Configure",
    items: [
      { to: "/settings/locations", label: "Locations", icon: Building2, enabled: true, key: "settings" },
      { to: "/settings/users", label: "Users & Roles", icon: UserCog, enabled: true, key: "settings" },
      { to: "/settings/business", label: "Settings", icon: Settings, enabled: true, key: "settings" },
    ],
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, sections: allowed, isLoading } = useAllowedSections();
  const rxMode = isRxMode();
  const { data: business } = useCurrentBusiness();
  // Doctor mode and clinic mode are separate: the clinic dashboard only
  // appears for businesses marked as a clinic (multi-doctor + reception).
  const clinicMode = !!business?.clinic_mode;
  const { isSuperAdmin } = useIsSuperAdmin();
  const base = isLoading
    ? []
    : isAdmin
      ? sections
      : sections
          .map((sec) => ({
            ...sec,
            items: sec.items.filter((it: any) => allowed!.includes(it.key)),
          }))
          .filter((sec) => sec.items.length > 0);
  const scoped = rxMode
    ? base.map((sec) => ({ ...sec, items: sec.items.filter((it) => RX_PATHS.includes(it.to)) }))
    : base.map((sec) => ({ ...sec, items: sec.items.filter((it) => !RX_ONLY_PATHS.includes(it.to)) }));
  // Same destination can be listed under multiple permission keys — show it once.
  const modeScoped = scoped.map((sec) => ({
    ...sec,
    // Platform-wide admin tools belong to the super admin only; a business
    // owner is an admin of their own business, not of the whole platform.
    items: sec.items.filter((it: any) => (it.superOnly ? isSuperAdmin : true))
      .filter((it) =>
        ["/clinic-dashboard", "/clinic-doctors", "/clinic-services", "/clinic-sales", "/clinic-plans"].includes(it.to)
          ? clinicMode
          : true,
      ),
  }));
  const visibleSections = modeScoped
    .map((sec) => {
      const seen = new Set<string>();
      return { ...sec, items: sec.items.filter((it) => !seen.has(it.to) && seen.add(it.to)) };
    })
    .filter((sec) => sec.items.length > 0);

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">Q</div>
          <div className="leading-tight">
            <div className="font-display text-sm font-semibold">QweekPOS</div>
            <div className="text-[10px] text-muted-foreground">v1.0</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {visibleSections.map((sec) => (
          <SidebarGroup key={sec.label}>
            <SidebarGroupLabel>{sec.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sec.items.map((item) => {
                  const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton asChild isActive={active} disabled={!item.enabled}>
                        {item.enabled ? (
                          <Link to={item.to as any}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        ) : (
                          <div className="opacity-40 cursor-not-allowed">
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                            <span className="ml-auto text-[9px] uppercase">soon</span>
                          </div>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
