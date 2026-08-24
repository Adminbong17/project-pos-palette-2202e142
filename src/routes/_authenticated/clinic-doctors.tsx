import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Stethoscope, UserPlus, KeyRound, Users, Search, MapPin } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { createClinicDoctor, setClinicDoctorPassword } from "@/lib/clinic.functions";
import { createRxStaff, setRxStaffPassword, removeRxStaff } from "@/lib/rx-staff.functions";
import { staffUsernameToEmail } from "@/lib/rx-staff";
import { useChambers } from "@/components/appointment-queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/clinic-doctors")({
  head: () => ({
    meta: [
      { title: "Clinic Doctors & Assistants — QweekRx" },
      {
        name: "description",
        content:
          "Clinic admins create doctor logins and add assistants under each doctor so reception can take patient serials.",
      },
      { property: "og:title", content: "Clinic Doctors & Assistants — QweekRx" },
      {
        property: "og:description",
        content: "Add doctors to your clinic and manage the assistants working under each of them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClinicDoctorsPage,
});

type ClinicDoctor = {
  user_id: string;
  name: string;
  email: string;
  qualification: string;
};

type Assistant = {
  id: string;
  doctor_id: string;
  name: string;
  username: string;
  phone: string | null;
  chamber_id: string | null;
  is_active: boolean;
  staff_kind?: string | null;
  role_label?: string | null;
  allowed_sections?: string[] | null;
};

/** Clinic-level staff roles: each one only unlocks the screens it needs. */
const CLINIC_STAFF_ROLES: { value: string; label: string; sections: string[] }[] = [
  { value: "Reception", label: "Reception — patient serial only", sections: ["rx-queue"] },
  { value: "Billing", label: "Billing — clinic sales only", sections: ["clinic-sales"] },
  {
    value: "Reception + Billing",
    label: "Reception + Billing — serial & sales",
    sections: ["rx-queue", "clinic-sales"],
  },
  {
    value: "Store",
    label: "Store — products & services list",
    sections: ["clinic-services"],
  },
];

function ClinicDoctorsPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const qc = useQueryClient();

  const addDoctor = useServerFn(createClinicDoctor);
  const setDoctorPw = useServerFn(setClinicDoctorPassword);

  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    login: "",
    phone: "",
    qualification: "",
    password: "",
  });

  const doctors = useQuery({
    queryKey: ["clinic-doctors", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: bus } = await supabase
        .from("business_users")
        .select("user_id")
        .eq("business_id", businessId!)
        .eq("is_active", true);
      const ids = (bus ?? []).map((b) => b.user_id);
      if (!ids.length) return [] as ClinicDoctor[];
      const [{ data: roles }, { data: userRoles }, { data: profiles }] = await Promise.all([
        supabase.from("roles").select("id, name").eq("business_id", businessId!),
        supabase
          .from("user_roles")
          .select("user_id, role_id")
          .eq("business_id", businessId!)
          .in("user_id", ids),
        supabase
          .from("profiles")
          .select("id, email, first_name, last_name, doctor_name, doctor_qualification")
          .in("id", ids),
      ]);
      const roleById = new Map((roles ?? []).map((r) => [r.id, String(r.name ?? "")] as const));
      const doctorIds = new Set(
        (userRoles ?? [])
          .filter((ur) => ur.role_id && (roleById.get(ur.role_id) ?? "").startsWith("Doctor"))
          .map((ur) => ur.user_id),
      );
      return (profiles ?? [])
        .filter((p) => doctorIds.has(p.id))
        .map((p: any) => ({
          user_id: p.id,
          name:
            p.doctor_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "—",
          email: p.email ?? "—",
          qualification: p.doctor_qualification ?? "",
        })) as ClinicDoctor[];
    },
  });

  const assistants = useQuery({
    queryKey: ["clinic-assistants", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rx_staff")
        .select(
          "id, doctor_id, name, username, phone, chamber_id, is_active, staff_kind, role_label, allowed_sections",
        )
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Assistant[];
    },
  });

  const chambers = useChambers(businessId);

  const create = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No clinic selected");
      return await addDoctor({
        data: {
          business_id: businessId,
          name: form.name,
          login: form.login,
          password: form.password,
          phone: form.phone,
          qualification: form.qualification,
        },
      });
    },
    onSuccess: () => {
      toast.success("Doctor account created");
      setForm({ name: "", login: "", phone: "", qualification: "", password: "" });
      qc.invalidateQueries({ queryKey: ["clinic-doctors", businessId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create the doctor"),
  });

  const filtered = useMemo(() => {
    const list = doctors.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((d) =>
      [d.name, d.email, d.qualification].join(" ").toLowerCase().includes(q),
    );
  }, [doctors.data, search]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Clinic Doctors &amp; Assistants</h1>
        <p className="text-sm text-muted-foreground">
          Create doctor logins for your clinic, then add assistants under each doctor. Assistants take
          patient serials in the queue; the clinic itself does not write prescriptions.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-primary" /> Add a doctor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!create.isPending) create.mutate();
            }}
          >
            <div>
              <Label className="text-xs">Doctor name</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Dr. Rahim Uddin"
              />
            </div>
            <div>
              <Label className="text-xs">Login (email or username)</Label>
              <Input
                required
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
                placeholder="rahim or dr@clinic.com"
                autoCapitalize="none"
                spellCheck={false}
              />
              {form.login.trim() && !form.login.includes("@") && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Signs in as {staffUsernameToEmail(form.login)}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Password</Label>
              <Input
                required
                minLength={6}
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })
                }
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <Label className="text-xs">Phone (optional)</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                inputMode="tel"
              />
            </div>
            <div>
              <Label className="text-xs">Qualification (optional)</Label>
              <Input
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                placeholder="MBBS, FCPS"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
                <UserPlus className="h-4 w-4" /> {create.isPending ? "Creating…" : "Create doctor"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="h-4 w-4 text-primary" /> Doctors
            <span className="text-xs font-normal text-muted-foreground">
              {(doctors.data ?? []).length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search doctors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {doctors.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No doctors yet — add one with the form above.
            </p>
          ) : (
            filtered.map((d) => (
              <DoctorBlock
                key={d.user_id}
                doctor={d}
                businessId={businessId}
                assistants={(assistants.data ?? []).filter(
                  (a) => a.doctor_id === d.user_id && a.staff_kind !== "clinic_staff",
                )}
                chambers={chambers.data ?? []}
                onSetPassword={async (password) => {
                  if (!businessId) return;
                  try {
                    await setDoctorPw({ data: { business_id: businessId, user_id: d.user_id, password } });
                    toast.success("Password updated");
                  } catch (e: any) {
                    toast.error(e?.message ?? "Could not change the password");
                  }
                }}
                onChanged={() => {
                  qc.invalidateQueries({ queryKey: ["clinic-assistants", businessId] });
                }}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DoctorBlock({
  doctor,
  businessId,
  assistants,
  chambers,
  onSetPassword,
  onChanged,
}: {
  doctor: ClinicDoctor;
  businessId: string | undefined;
  assistants: Assistant[];
  chambers: { id: string; name: string; address?: string | null }[];
  onSetPassword: (password: string) => void | Promise<void>;
  onChanged: () => void;
}) {
  const addStaff = useServerFn(createRxStaff);
  const setStaffPw = useServerFn(setRxStaffPassword);
  const dropStaff = useServerFn(removeRxStaff);

  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [staffForm, setStaffForm] = useState({
    name: "",
    username: "",
    phone: "",
    password: "",
    chamber_id: "",
  });

  async function createAssistant(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId || busy) return;
    setBusy(true);
    try {
      await addStaff({
        data: {
          business_id: businessId,
          name: staffForm.name,
          username: staffForm.username,
          password: staffForm.password,
          phone: staffForm.phone,
          chamber_id: staffForm.chamber_id || null,
          doctor_id: doctor.user_id,
        },
      });
      toast.success("Assistant created");
      setStaffForm({ name: "", username: "", phone: "", password: "", chamber_id: "" });
      onChanged();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create the assistant");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{doctor.name}</div>
          <div className="text-xs text-muted-foreground">{doctor.email}</div>
          {doctor.qualification && (
            <div className="text-xs text-muted-foreground">{doctor.qualification}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="h-9 w-40 text-xs"
            placeholder="New password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pw.length < 6}
            onClick={async () => {
              await onSetPassword(pw);
              setPw("");
            }}
          >
            <KeyRound className="h-4 w-4" /> Set
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-border/60 p-2">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Assistants under this doctor ({assistants.length})
        </p>

        {assistants.length === 0 ? (
          <p className="text-xs text-muted-foreground">No assistant yet.</p>
        ) : (
          <div className="space-y-1">
            {assistants.map((a) => {
              const chamber = chambers.find((c) => c.id === a.chamber_id);
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 px-2 py-1 text-xs"
                >
                  <span className="font-medium">{a.name}</span>
                  <Badge variant="secondary">{a.username}</Badge>
                  {a.phone && <span className="text-muted-foreground">📞 {a.phone}</span>}
                  {chamber && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {chamber.name}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px]"
                      onClick={async () => {
                        const next = window.prompt(`New password for ${a.name}`);
                        if (!next || next.length < 6) return;
                        try {
                          await setStaffPw({ data: { staff_id: a.id, password: next } });
                          toast.success("Password updated");
                        } catch (err: any) {
                          toast.error(err?.message ?? "Could not change the password");
                        }
                      }}
                    >
                      Password
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-destructive"
                      onClick={async () => {
                        if (!window.confirm(`Remove ${a.name}?`)) return;
                        try {
                          await dropStaff({ data: { staff_id: a.id } });
                          toast.success("Removed");
                          onChanged();
                        } catch (err: any) {
                          toast.error(err?.message ?? "Could not remove");
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-5" onSubmit={createAssistant}>
          <Input
            required
            className="h-9 text-xs"
            placeholder="Assistant name"
            value={staffForm.name}
            onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
          />
          <Input
            required
            className="h-9 text-xs"
            placeholder="Username"
            autoCapitalize="none"
            spellCheck={false}
            value={staffForm.username}
            onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
          />
          <Input
            className="h-9 text-xs"
            placeholder="Phone"
            inputMode="tel"
            value={staffForm.phone}
            onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
          />
          <Input
            required
            minLength={6}
            className="h-9 text-xs"
            placeholder="Password"
            value={staffForm.password}
            onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
          />
          <div className="flex gap-2">
            <select
              value={staffForm.chamber_id}
              onChange={(e) => setStaffForm({ ...staffForm, chamber_id: e.target.value })}
              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-input px-2 text-xs"
            >
              <option value="">Location…</option>
              {chambers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" disabled={busy}>
              Add
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
