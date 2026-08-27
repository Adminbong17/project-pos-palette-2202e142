import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck, BarChart3,
  Receipt, Wallet, Settings, Factory, UtensilsCrossed, Wrench, HeartHandshake,
  Building2, Stethoscope, ClipboardList, BookOpen, UserCog, FolderArchive, Boxes, PackagePlus, FileText, ListChecks, CalendarClock, MessageSquare, History, FlaskConical, Stamp, ShieldCheck,
} from "lucide-react";
import { useAllowedSections } from "@/hooks/use-allowed-sections";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";

import { isRxMode, RX_PATHS, RX_ONLY_PATHS } from "@/lib/rx-mode";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";

// Sub-pages of the Lab module, shown nested under the "Lab" menu button.
const LAB_CHILDREN = [
  { to: "/lab-reports", label: "New Report", icon: FileText, exact: true, key: "clinic" },
  { to: "/lab-reports/staff", label: "Lab Staff", icon: Users, key: "clinic" },
  { to: "/lab-reports/history", label: "Report History", icon: Stamp, key: "clinic" },
];

// Every menu button that owns more than one feature keeps its features on
// separate pages, listed as children under the parent button.
const INVENTORY_CHILDREN = [
  { to: "/products", label: "Products", icon: Package, exact: true, key: "products" },
  { to: "/purchases", label: "Purchases", icon: Truck, key: "purchases" },
  { to: "/quick-box", label: "Quick Box Add", icon: PackagePlus, key: "quick-box" },
  { to: "/stock-transfers", label: "Stock Transfers", icon: ClipboardList, key: "stock-transfers" },
  { to: "/products/stock-adjustments", label: "Stock Adjustments", icon: Boxes, key: "products" },
];

const REPORT_CHILDREN = [
  { to: "/reports", label: "All Reports", icon: BarChart3, exact: true, key: "reports" },
  { to: "/reports/profit", label: "Profit Report", icon: Wallet, key: "__admin" },
  { to: "/reports/inventory-movement", label: "Inventory Movement", icon: Boxes, key: "reports" },
];

const CLINIC_CHILDREN = [
  { to: "/clinic-dashboard", label: "Overview", icon: LayoutDashboard, exact: true, key: "clinic" },
  { to: "/clinic-doctors", label: "Clinic Doctors", icon: Stethoscope, key: "clinic" },
  { to: "/clinic-services", label: "Products & Services", icon: Package, key: "clinic" },
  { to: "/clinic-sales", label: "Clinic Sales", icon: ShoppingCart, key: "clinic" },
  { to: "/clinic-plans", label: "Treatment Plans (EMI)", icon: CalendarClock, key: "clinic" },
];

const DOCTOR_CHILDREN = [
  { to: "/rx-dashboard", label: "Overview", icon: LayoutDashboard, exact: true, key: "prescriptions" },
  { to: "/prescriptions", label: "Prescriptions", icon: FileText, key: "prescriptions" },
  { to: "/rx-appointments", label: "Patient Queue", icon: CalendarClock, key: "rx-queue" },
  { to: "/rx-staff", label: "My Staff", icon: Users, key: "prescriptions" },
  { to: "/rx-lists", label: "My Rx Lists", icon: BookOpen, key: "prescriptions" },
  { to: "/clinic-services", label: "Services & Fees", icon: Package, key: "prescriptions" },
  { to: "/clinic-plans", label: "Treatment Plans (EMI)", icon: CalendarClock, key: "prescriptions" },
];

const BILLING_CHILDREN = [
  { to: "/rx-billing", label: "Overview", icon: Wallet, exact: true, key: "__any" },
  { to: "/rx-billing/buy", label: "Buy Credits", icon: ShoppingCart, key: "__any" },
  { to: "/rx-billing/bills", label: "Monthly Bills", icon: Receipt, key: "__any" },
  { to: "/rx-billing/phone", label: "Bill SMS Number", icon: ShieldCheck, key: "__any" },
  { to: "/rx-credit-history", label: "Credit & Payment History", icon: History, key: "__any" },
];

const ADMIN_CHILDREN = [
  { to: "/admin", label: "Admin Hub", icon: Settings, exact: true, key: "__admin" },
  { to: "/admin/prescriptions", label: "Admin Prescription", icon: ClipboardList, key: "__admin" },
  { to: "/admin/doctors", label: "Doctors & Approvals", icon: UserCog, key: "__admin" },
  { to: "/admin/businesses", label: "Businesses & Modules", icon: Building2, key: "__admin" },
  { to: "/admin/users", label: "All Users & Logins", icon: UserCog, key: "__admin" },
  { to: "/admin/rx-billing", label: "Bill Page (Admin)", icon: Wallet, key: "__admin" },
  { to: "/admin/rx-credit-links", label: "Credit Links", icon: Wallet, key: "__admin" },
  { to: "/admin/credit-purchases", label: "Credit Purchases", icon: Wallet, key: "__admin" },
  { to: "/admin/bkash", label: "bKash Gateway", icon: Wallet, key: "__admin" },
  { to: "/admin/sms", label: "SMS Gateway", icon: MessageSquare, key: "__admin" },
  { to: "/admin/backups", label: "Backups & Restore", icon: FolderArchive, key: "__admin" },
  { to: "/rx-options", label: "Manage Rx Options", icon: ListChecks, key: "__admin" },
];

const SETTINGS_CHILDREN = [
  { to: "/settings/business", label: "Business Settings", icon: Settings, exact: true, key: "__any" },
  { to: "/settings/locations", label: "Locations", icon: Building2, key: "settings" },
  { to: "/settings/users", label: "Users & Roles", icon: UserCog, key: "settings" },
];

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
      { to: "/products", label: "Inventory", icon: Package, enabled: true, key: "products", children: INVENTORY_CHILDREN },
      { to: "/products", label: "Inventory", icon: Package, enabled: true, key: "purchases", children: INVENTORY_CHILDREN },
      { to: "/products", label: "Inventory", icon: Package, enabled: true, key: "quick-box", children: INVENTORY_CHILDREN },
      { to: "/products", label: "Inventory", icon: Package, enabled: true, key: "stock-transfers", children: INVENTORY_CHILDREN },
      { to: "/files", label: "Files", icon: FolderArchive, enabled: true, key: "files" },
      { to: "/contacts", label: "Contacts", icon: Users, enabled: true, key: "contacts" },
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
      { to: "/reports", label: "Reports", icon: BarChart3, enabled: true, key: "reports", children: REPORT_CHILDREN },
      { to: "/reports", label: "Reports", icon: BarChart3, enabled: true, key: "__admin", children: REPORT_CHILDREN },
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
    ],
  },
  {
    label: "Clinic & Rx",
    items: [
      { to: "/clinic-dashboard", label: "Clinic", icon: Building2, enabled: true, key: "clinic", children: CLINIC_CHILDREN },
      { to: "/rx-dashboard", label: "Doctor", icon: Stethoscope, enabled: true, key: "prescriptions", children: DOCTOR_CHILDREN, anyMode: true },
      { to: "/rx-appointments", label: "Patient Queue", icon: CalendarClock, enabled: true, key: "rx-queue", anyMode: true },
      { to: "/clinic-services", label: "Services & Fees", icon: Package, enabled: true, key: "clinic-services", anyMode: true },
      { to: "/clinic-sales", label: "Clinic Sales", icon: ShoppingCart, enabled: true, key: "clinic-sales", anyMode: true },
      { to: "/clinic-plans", label: "Treatment Plans (EMI)", icon: CalendarClock, enabled: true, key: "clinic-plans", anyMode: true },
      { to: "/lab-reports", label: "Lab", icon: FlaskConical, enabled: true, key: "clinic", children: LAB_CHILDREN, anyMode: true },
      { to: "/lab-reports", label: "Lab", icon: FlaskConical, enabled: true, key: "prescriptions", anyMode: true, children: LAB_CHILDREN },
      { to: "/lab-reports", label: "Lab", icon: FlaskConical, enabled: true, key: "clinic-sales", anyMode: true, children: LAB_CHILDREN },
      { to: "/rx-billing", label: "Billing", icon: Wallet, enabled: true, key: "prescriptions", children: BILLING_CHILDREN, anyMode: true },
      { to: "/rx-billing", label: "Billing", icon: Wallet, enabled: true, key: "clinic", children: BILLING_CHILDREN, anyMode: true },
    ],
  },
  {
    label: "Super Admin Tools",
    items: [
      { to: "/admin", superOnly: true, label: "Admin", icon: Settings, enabled: true, key: "__admin", children: ADMIN_CHILDREN },
    ],
  },

  {
    label: "Configure",
    items: [
      { to: "/settings/business", label: "Settings", icon: Settings, enabled: true, key: "settings", children: SETTINGS_CHILDREN },
      // Clinic / doctor users need Settings too (clinic name, address, SMS number).
      { to: "/settings/business", label: "Settings", icon: Settings, enabled: true, key: "clinic", children: SETTINGS_CHILDREN },
      { to: "/settings/business", label: "Settings", icon: Settings, enabled: true, key: "prescriptions", children: SETTINGS_CHILDREN },
    ],
  },
];

// A doctor account (under a clinic or standalone) only ever needs these pages.
const DOCTOR_PATHS = [
  "/rx-dashboard",
  "/prescriptions",
  "/rx-appointments",
  "/rx-staff",
  "/rx-lists",
  "/rx-billing",
  "/rx-credit-history",
  "/clinic-services",
  "/clinic-plans",
  "/lab-reports",
  "/lab-reports/staff",
  "/lab-reports/history",
  "/settings/business",
];


// Meaning-based tone per destination (hue in oklch degrees).
// green = money in / clinical, blue = overview & data, amber = stock & supply,
// red = money out & danger, purple = people, cyan = catalogue, slate = config.
const NAV_HUE: Record<string, number> = {
  "/dashboard": 232, "/rx-dashboard": 232, "/clinic-dashboard": 232,
  "/pos": 150, "/sales": 150, "/clinic-sales": 150,
  "/purchases": 55, "/quick-box": 55, "/stock-transfers": 55,
  "/products": 195, "/clinic-services": 195, "/files": 250, "/contacts": 300,
  "/expenses": 25, "/accounts": 232,
  "/reports": 300, "/reports/profit": 150, "/reports/inventory-movement": 195,
  "/manufacturing": 55, "/restaurant": 25, "/repair": 250, "/crm": 300, "/hrm": 300,
  "/clinic-doctors": 195, "/clinic-plans": 300, "/lab-reports": 195,
  "/prescriptions": 150, "/rx-appointments": 232, "/rx-staff": 300, "/rx-lists": 250,
  "/rx-billing": 55, "/rx-credit-history": 300,
  "/rx-options": 250, "/admin/prescriptions": 150, "/admin/doctors": 300,
  "/admin/rx-billing": 55, "/admin/businesses": 232, "/admin/users": 300,
  "/admin/backups": 195, "/admin/sms": 232, "/admin/bkash": 150, "/admin/rx-credit-links": 55,
  "/admin/credit-purchases": 120, "/admin": 25,
  "/settings/locations": 250, "/settings/users": 300, "/settings/business": 250,
};

function navHue(to: string) {
  return NAV_HUE[to] ?? 250;
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, sections: allowed, isLoading } = useAllowedSections();
  const rxMode = isRxMode();
  const { data: business } = useCurrentBusiness();
  const { isDoctor } = useCurrentRole();
  // Doctor mode and clinic mode are separate: the clinic dashboard only
  // appears for businesses marked as a clinic (multi-doctor + reception).
  const clinicMode = !!business?.clinic_mode;
  const { isSuperAdmin } = useIsSuperAdmin();
  // Clinic doctors see their pool status (read-only), independent doctors buy credits.
  const doctorPaths = DOCTOR_PATHS;

  // A child page is visible when its own module key is granted. `__any` marks a
  // sub-page that belongs to whoever can see the parent.
  const childAllowed = (c: any) =>
    c.key === "__any" ||
    c.key === "__admin" ||
    allowed === null ||
    (allowed as string[]).includes(c.key);

  // A business admin is NOT unrestricted: when the super admin picked a module
  // list for that account, only those modules may appear. `allowed === null`
  // means "no limit configured" (super admin / legacy accounts).
  const base = isLoading
    ? []
    : allowed === null
      ? sections
      : sections
          .map((sec) => ({
            ...sec,
            items: sec.items.filter(
              (it: any) =>
                allowed.includes(it.key) ||
                (it.children ?? []).some((c: any) => c.key !== "__any" && allowed.includes(c.key)),
            ),
          }))
          .filter((sec) => sec.items.length > 0);

  const scoped = rxMode || isDoctor
    ? base.map((sec) => ({ ...sec, items: sec.items.filter((it) => RX_PATHS.includes(it.to)) }))
    : base.map((sec) => ({ ...sec, items: sec.items.filter((it) => !RX_ONLY_PATHS.includes(it.to)) }));
  // Same destination can be listed under multiple permission keys — show it once.
  const modeScoped = scoped.map((sec) => ({
    ...sec,
    // Platform-wide admin tools belong to the super admin only; a business
    // owner is an admin of their own business, not of the whole platform.
    items: sec.items.filter((it: any) => (it.superOnly ? isSuperAdmin : true))
      // A doctor sees only their own clinical pages — no clinic admin pages,
      // no business settings, even inside a clinic business.
      .filter((it) => (isDoctor && !isAdmin ? doctorPaths.includes(it.to) : true))
      .filter((it: any) =>
        ["/clinic-dashboard", "/clinic-doctors", "/clinic-services", "/clinic-sales", "/clinic-plans"].includes(it.to) &&
        !it.anyMode
          ? clinicMode
          : true,
      )
      // Sub-pages follow the same grants and role limits as top-level items.
      .map((it: any) => {
        if (!it.children) return it;
        const children = it.children
          .filter(childAllowed)
          .filter((c: any) => (c.key === "__admin" ? isSuperAdmin || allowed === null : true))
          .filter((c: any) => (isDoctor && !isAdmin ? doctorPaths.includes(c.to) : true))
          .filter((c: any) => (rxMode || isDoctor ? RX_PATHS.includes(c.to) || c.to.startsWith("/lab-reports") : !RX_ONLY_PATHS.includes(c.to)))
          .filter((c: any) =>
            ["/clinic-doctors"].includes(c.to) ? clinicMode : true,
          );
        return { ...it, children };
      }),
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
          <img
            src="/favicon.png"
            alt="QweekPOS"
            className="h-8 w-8 rounded-lg object-cover shadow-sm"
          />
          <div className="leading-tight">
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
                  const children: any[] = (item as any).children ?? [];
                  const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
                  // Keep the group open while any of its sub-pages is open.
                  const expanded =
                    active || children.some((c) => pathname === c.to || pathname.startsWith(c.to + "/"));
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        disabled={!item.enabled}
                        className="nav-box h-auto"
                        style={{ ["--nav-hue" as any]: navHue(item.to) }}
                      >
                        {item.enabled ? (
                          <Link to={item.to as any}>
                            <span className="nav-box-icon">
                              <item.icon className="h-4 w-4" />
                            </span>
                            <span className="truncate">{item.label}</span>
                          </Link>
                        ) : (
                          <div className="opacity-40 cursor-not-allowed">
                            <span className="nav-box-icon">
                              <item.icon className="h-4 w-4" />
                            </span>
                            <span className="truncate">{item.label}</span>
                            <span className="ml-auto text-[9px] uppercase">soon</span>
                          </div>
                        )}
                      </SidebarMenuButton>
                      {children.length > 0 && expanded && (
                        <div className="ml-6 mt-1 space-y-1 border-l border-border/60 pl-2">
                          {children.map((c: any) => {
                            const cActive = c.exact ? pathname === c.to : pathname.startsWith(c.to);
                            return (
                              <Link
                                key={c.to}
                                to={c.to as any}
                                className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${
                                  cActive
                                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                                    : "text-muted-foreground hover:bg-sidebar-accent/50"
                                }`}
                              >
                                <c.icon className="h-3.5 w-3.5" />
                                <span className="truncate">{c.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </SidebarMenuItem>
                  );
                })}

              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-1 pb-1">
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
