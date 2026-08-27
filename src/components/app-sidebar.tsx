import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck, BarChart3,
  Receipt, Wallet, Settings, Factory, UtensilsCrossed, Wrench, HeartHandshake,
  Building2, Stethoscope, ClipboardList, BookOpen, UserCog, FolderArchive, Boxes, PackagePlus, FileText, ListChecks, CalendarClock, MessageSquare, History,
} from "lucide-react";
import { useAllowedSections } from "@/hooks/use-allowed-sections";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";

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
    ],
  },
  {
    label: "Clinic & Rx",
    items: [
      { to: "/clinic-dashboard", label: "Clinic Dashboard", icon: Building2, enabled: true, key: "clinic" },
      { to: "/clinic-doctors", label: "Clinic Doctors", icon: Stethoscope, enabled: true, key: "clinic" },
      { to: "/clinic-services", label: "Products & Services", icon: Package, enabled: true, key: "clinic" },
      { to: "/clinic-sales", label: "Clinic Sales", icon: ShoppingCart, enabled: true, key: "clinic" },
      { to: "/clinic-plans", label: "Treatment Plans (EMI)", icon: CalendarClock, enabled: true, key: "clinic" },
      { to: "/lab-reports", label: "Lab", icon: FlaskConical, enabled: true, key: "clinic", children: LAB_CHILDREN },
      { to: "/lab-reports", label: "Lab", icon: FlaskConical, enabled: true, key: "prescriptions", anyMode: true, children: LAB_CHILDREN },
      { to: "/lab-reports", label: "Lab", icon: FlaskConical, enabled: true, key: "clinic-sales", children: LAB_CHILDREN },

      { to: "/clinic-plans", label: "Treatment Plans (EMI)", icon: CalendarClock, enabled: true, key: "clinic-plans" },
      { to: "/clinic-services", label: "Products & Services", icon: Package, enabled: true, key: "clinic-services" },
      { to: "/clinic-sales", label: "Clinic Sales", icon: ShoppingCart, enabled: true, key: "clinic-sales" },
      { to: "/clinic-dashboard", label: "Clinic Dashboard", icon: Building2, enabled: true, key: "prescriptions" },
      { to: "/rx-dashboard", label: "Doctor Dashboard", icon: LayoutDashboard, enabled: true, key: "prescriptions" },
      { to: "/prescriptions", label: "Prescriptions", icon: FileText, enabled: true, key: "prescriptions" },

      { to: "/rx-appointments", label: "Patient Queue", icon: CalendarClock, enabled: true, key: "rx-queue" },
      { to: "/rx-staff", label: "My Staff", icon: Users, enabled: true, key: "prescriptions" },
      { to: "/rx-lists", label: "My Rx Lists", icon: BookOpen, enabled: true, key: "prescriptions" },
      // Independent doctors (and their staff) manage their own service list and
      // treatment plans, so these are not gated behind clinic mode.
      { to: "/clinic-services", label: "Services & Fees", icon: Package, enabled: true, key: "prescriptions", anyMode: true },
      { to: "/clinic-plans", label: "Treatment Plans (EMI)", icon: CalendarClock, enabled: true, key: "prescriptions", anyMode: true },
      { to: "/clinic-services", label: "Services & Fees", icon: Package, enabled: true, key: "rx-queue", anyMode: true },
      { to: "/clinic-plans", label: "Treatment Plans (EMI)", icon: CalendarClock, enabled: true, key: "rx-queue", anyMode: true },
      { to: "/rx-billing", label: "Bill Page", icon: Wallet, enabled: true, key: "prescriptions" },
      { to: "/rx-credit-history", label: "Credit & Payment History", icon: History, enabled: true, key: "prescriptions" },
      { to: "/rx-billing", label: "Bill Page", icon: Wallet, enabled: true, key: "clinic" },
      { to: "/rx-credit-history", label: "Credit & Payment History", icon: History, enabled: true, key: "clinic" },
    ],
  },
  {
    label: "Super Admin Tools",
    items: [
      { to: "/rx-options", label: "Manage Rx Options", icon: ListChecks, enabled: true, key: "__admin" },
      { to: "/admin/prescriptions", superOnly: true, label: "Admin Prescription", icon: ClipboardList, enabled: true, key: "__admin" },
      { to: "/admin/doctors", superOnly: true, label: "Doctors & Approvals", icon: UserCog, enabled: true, key: "__admin" },
      { to: "/admin/rx-billing", superOnly: true, label: "Bill Page (Admin)", icon: Wallet, enabled: true, key: "__admin" },
      { to: "/admin/businesses", superOnly: true, label: "Businesses & Modules", icon: Building2, enabled: true, key: "__admin" },
      { to: "/admin/users", superOnly: true, label: "All Users & Logins", icon: UserCog, enabled: true, key: "__admin" },
      { to: "/admin/backups", superOnly: true, label: "Backups & Restore", icon: FolderArchive, enabled: true, key: "__admin" },
      { to: "/admin/sms", superOnly: true, label: "SMS Gateway", icon: MessageSquare, enabled: true, key: "__admin" },
      { to: "/admin/rx-credit-links", superOnly: true, label: "Credit Links", icon: Wallet, enabled: true, key: "__admin" },
      { to: "/admin/credit-purchases", superOnly: true, label: "Credit Purchases", icon: Wallet, enabled: true, key: "__admin" },
      { to: "/admin/bkash", superOnly: true, label: "bKash Gateway", icon: Wallet, enabled: true, key: "__admin" },
      { to: "/admin", superOnly: true, label: "Admin Hub", icon: Settings, enabled: true, key: "__admin" },
    ],
  },

  {
    label: "Configure",
    items: [
      { to: "/settings/locations", label: "Locations", icon: Building2, enabled: true, key: "settings" },
      { to: "/settings/users", label: "Users & Roles", icon: UserCog, enabled: true, key: "settings" },
      { to: "/settings/business", label: "Settings", icon: Settings, enabled: true, key: "settings" },
      // Clinic users need Settings too (clinic name, address, SMS number).
      { to: "/settings/business", label: "Settings", icon: Settings, enabled: true, key: "clinic" },
      { to: "/settings/business", label: "Settings", icon: Settings, enabled: true, key: "prescriptions" },
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
            items: sec.items.filter((it: any) => allowed.includes(it.key)),
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
                  const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
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
