import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { formatDate } from "@/lib/utils";
import { Users, FileText, CalendarClock, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rx-dashboard")({
  head: () => ({
    meta: [
      { title: "Doctor Dashboard — Prescriptions & Appointments" },
      { name: "description", content: "Doctor dashboard with patient counts, prescription totals and upcoming follow-up appointments by day." },
      { property: "og:title", content: "Doctor Dashboard — Prescriptions & Appointments" },
      { property: "og:description", content: "Track patients, prescriptions and daily follow-up appointments in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RxDashboard,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function RxDashboard() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin } = useCurrentRole();
  const businessId = business?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["rx-dashboard", businessId, isAdmin],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      let q = supabase
        .from("prescriptions")
        .select("id, rx_no, rx_date, patient_name, patient_phone, patient_age, patient_gender, next_visit, doctor_name")
        .eq("business_id", businessId!)
        .order("rx_date", { ascending: false })
        .limit(5000);
      if (!isAdmin && u.user) q = q.eq("created_by", u.user.id);
      const { data: rows, error } = await q;
      if (error) throw error;
      return rows ?? [];
    },
  });

  const rows = data ?? [];
  const patientKeys = new Set(
    rows.map((r: any) => `${(r.patient_name ?? "").trim().toLowerCase()}|${(r.patient_phone ?? "").trim()}`),
  );
  const today = todayISO();
  const upcoming = rows.filter((r: any) => r.next_visit && r.next_visit >= today);

  const byDay = new Map<string, any[]>();
  for (const r of upcoming) {
    const list = byDay.get(r.next_visit) ?? [];
    list.push(r);
    byDay.set(r.next_visit, list);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const todayCount = byDay.get(today)?.length ?? 0;

  const cards = [
    { label: "Total Patients", value: patientKeys.size, icon: Users, color: "bg-primary/15 text-primary" },
    { label: "Prescriptions", value: rows.length, icon: FileText, color: "bg-chart-2/15 text-chart-2" },
    { label: "Appointments today", value: todayCount, icon: Stethoscope, color: "bg-chart-3/15 text-chart-3" },
    { label: "Upcoming appointments", value: upcoming.length, icon: CalendarClock, color: "bg-chart-4/15 text-chart-4" },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Doctor Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "All doctors" : "Your prescriptions"} · {business?.name ?? "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/prescriptions" className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent">New / All Prescriptions</Link>
          <Link to="/rx-lists" className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent">My Rx Lists</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.color}`}>
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 font-display text-3xl font-semibold">{isLoading ? "…" : c.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Appointments by day (next visit)</h2>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : days.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming next-visit dates yet.</p>
        ) : (
          <div className="space-y-4">
            {days.map(([day, list]) => (
              <div key={day} className="rounded-xl border border-border/60">
                <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-2">
                  <span className="text-sm font-semibold">
                    {formatDate(day)} {day === today && <span className="ml-1 text-xs text-primary">(today)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{list.length} appointment{list.length > 1 ? "s" : ""}</span>
                </div>
                <ul className="divide-y divide-border/60">
                  {list.map((r: any) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                      <span className="font-medium">{r.patient_name || "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.patient_age ? `${r.patient_age}y` : ""} {r.patient_gender ?? ""}
                      </span>
                      {r.patient_phone && <span className="text-xs text-muted-foreground">{r.patient_phone}</span>}
                      <span className="ml-auto font-mono text-[11px] text-muted-foreground">{r.rx_no ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
