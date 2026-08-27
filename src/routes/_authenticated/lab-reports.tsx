import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FlaskConical, FileText, Users, Stamp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lab-reports")({
  head: () => ({
    meta: [
      { title: "Lab — Reports, Staff & Signatures" },
      {
        name: "description",
        content:
          "Laboratory workspace: build and print patient reports, appoint technologists and pathologists, and set signature and pad defaults.",
      },
      { property: "og:title", content: "Lab — Reports, Staff & Signatures" },
      {
        property: "og:description",
        content: "One place for lab report printing, appointed lab staff and signature defaults.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LabLayout,
});

const tabs = [
  { to: "/lab-reports", label: "New Report", icon: FileText, exact: true },
  { to: "/lab-reports/staff", label: "Lab Staff", icon: Users },
  { to: "/lab-reports/history", label: "Report History", icon: Stamp },
];

function LabLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <FlaskConical className="h-5 w-5" /> Lab
        </h1>
        <p className="text-sm text-muted-foreground">
          Reports, appointed lab staff and signature settings — each on its own page.
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
