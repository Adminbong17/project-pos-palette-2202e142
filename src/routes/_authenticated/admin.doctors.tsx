import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Stethoscope, ClipboardCheck, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { ALL_SECTIONS } from "@/hooks/use-allowed-sections";
import {
  RX_OPTION_KINDS,
  useRxUserOptionSettings,
  type RxOptionKind,
} from "@/hooks/use-rx-option-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/doctors")({
  head: () => ({
    meta: [
      { title: "Doctors & Approvals — QweekPOS" },
      {
        name: "description",
        content:
          "Approve new doctor or staff signups, set their role and choose which sections and prescription option lists they can use.",
      },
      { property: "og:title", content: "Doctors & Approvals — QweekPOS" },
      {
        property: "og:description",
        content: "Doctor directory, signup approvals and per-doctor prescription access control.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDoctorsPage,
});

type RequestRow = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  qualification: string | null;
  requested_role: string;
  status: string;
  created_at: string;
  admin_notes: string | null;
};

type Member = {
  id: string;
  email: string | null;
  name: string;
  roleId: string | null;
  roleName: string | null;
  allowedSections: string[] | null;
  doctorName: string;
  doctorQualification: string;
};

function AdminDoctorsPage() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin, isLoading: roleLoading } = useCurrentRole();
  const businessId = business?.id;
  const qc = useQueryClient();
  const [pendingSearch, setPendingSearch] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");

  const requests = useQuery({
    queryKey: ["access-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_requests")
        .select("id, user_id, email, full_name, phone, qualification, requested_role, status, created_at, admin_notes")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as RequestRow[];
    },
  });

  const members = useQuery({
    queryKey: ["business-members", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: bus } = await supabase
        .from("business_users")
        .select("user_id")
        .eq("business_id", businessId!)
        .eq("is_active", true);
      const userIds = (bus ?? []).map((b) => b.user_id);
      if (!userIds.length) return [] as Member[];
      const [{ data: profiles }, { data: userRoles }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, first_name, last_name, doctor_name, doctor_qualification")
          .in("id", userIds),
        supabase
          .from("user_roles")
          .select("user_id, role_id, allowed_sections")
          .eq("business_id", businessId!)
          .in("user_id", userIds),
        supabase.from("roles").select("id, name").eq("business_id", businessId!),
      ]);
      const roleById = new Map(
        (roles ?? []).map((r) => [r.id, r.name?.startsWith("Admin#") ? "Admin" : r.name] as const),
      );
      const urByUser = new Map((userRoles ?? []).map((ur) => [ur.user_id, ur] as const));
      return (profiles ?? []).map((p) => {
        const ur = urByUser.get(p.id);
        return {
          id: p.id,
          email: p.email,
          name: [p.first_name, p.last_name].filter(Boolean).join(" "),
          roleId: ur?.role_id ?? null,
          roleName: ur?.role_id ? roleById.get(ur.role_id) ?? null : null,
          allowedSections: ((ur as any)?.allowed_sections as string[] | null) ?? null,
          doctorName: ((p as any).doctor_name as string | null) ?? "",
          doctorQualification: ((p as any).doctor_qualification as string | null) ?? "",
        } as Member;
      });
    },
  });

  const approve = useMutation({
    mutationFn: async (args: {
      id: string;
      role: string;
      sections: string[] | null;
      ownBusiness?: boolean;
      businessName?: string;
    }) => {
      if (args.ownBusiness) {
        // Separate POS: the person becomes owner/Admin of a brand-new business,
        // with no link to this business's data.
        const { error } = await supabase.rpc("approve_access_request_new_business", {
          _id: args.id,
          _business_name: args.businessName || undefined,
          _sections: args.sections ?? undefined,
          _notes: undefined,
        });
        if (error) throw error;
        return;
      }
      if (!businessId) throw new Error("No business selected");
      const { error } = await supabase.rpc("approve_access_request", {
        _id: args.id,
        _business_id: businessId,
        _role: args.role,
        _sections: args.sections ?? undefined,
        _notes: undefined,
      });
      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      qc.invalidateQueries({ queryKey: ["business-members", businessId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not approve"),
  });

  const reject = useMutation({
    mutationFn: async (args: { id: string; notes: string | null }) => {
      const { error } = await supabase.rpc("reject_access_request", {
        _id: args.id,
        _notes: args.notes ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rejected");
      qc.invalidateQueries({ queryKey: ["access-requests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not reject"),
  });

  async function saveSections(userId: string, next: string[] | null) {
    if (!businessId) return;
    const { error } = await supabase
      .from("user_roles")
      .update({ allowed_sections: next })
      .eq("user_id", userId)
      .eq("business_id", businessId);
    if (error) toast.error(error.message);
    else {
      qc.invalidateQueries({ queryKey: ["business-members", businessId] });
      qc.invalidateQueries({ queryKey: ["allowed-sections", businessId] });
    }
  }

  async function saveDoctorIdentity(userId: string, name: string, qualification: string) {
    const { error } = await supabase
      .from("profiles")
      .update({
        doctor_name: name.trim() || null,
        doctor_qualification: qualification.trim() || null,
      } as any)
      .eq("id", userId);
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["business-members", businessId] });
      qc.invalidateQueries({ queryKey: ["my-doctor-profile"] });
    }
  }

  if (!roleLoading && !isAdmin) {
    return (
      <div className="p-6">
        <h1 className="font-display text-xl font-semibold">Doctors & Approvals</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only business admins can open this page.
        </p>
      </div>
    );
  }

  const pending = (requests.data ?? []).filter((r) => r.status === "pending");
  const reviewed = (requests.data ?? []).filter((r) => r.status !== "pending").slice(0, 15);
  const doctors = (members.data ?? []).filter((m) => m.roleName === "Doctor");
  const others = (members.data ?? []).filter((m) => m.roleName !== "Doctor");

  const filteredPending = useMemo(() => {
    const q = pendingSearch.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter((r) =>
      [r.full_name, r.email, r.phone, r.qualification, r.requested_role, r.status]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ")
        .includes(q),
    );
  }, [pending, pendingSearch]);

  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter((m) =>
      [m.name, m.email, m.doctorName, m.doctorQualification]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ")
        .includes(q),
    );
  }, [doctors, doctorSearch]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Doctors & Approvals</h1>
        <p className="text-sm text-muted-foreground">
          New signups land here for approval — visible to both the POS admin and the prescription
          (Rx) admin. Approve with a role, then choose which app sections and which shared Rx option
          lists each doctor may use.
        </p>
      </div>

      {/* Pending approvals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Pending approvals
            <span className="text-xs font-normal text-muted-foreground">{pending.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search requests…" value={pendingSearch} onChange={(e) => setPendingSearch(e.target.value)} />
          </div>
          {requests.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : filteredPending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No match</p>
          ) : (
            filteredPending.map((r) => (
              <PendingCard
                key={r.id}
                req={r}
                busy={approve.isPending || reject.isPending}
                canCreateBusiness={isSuperAdmin}
                onApprove={(args) => approve.mutate({ id: r.id, ...args })}
                onReject={(notes) => reject.mutate({ id: r.id, notes })}
              />

            ))
          )}
          {reviewed.length > 0 && (
            <div className="pt-2">
              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                Recently reviewed
              </p>
              <div className="space-y-1">
                {reviewed.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs"
                  >
                    <span className="font-medium">{r.full_name || r.email}</span>
                    <span className="text-muted-foreground">{r.email}</span>
                    <span
                      className={
                        r.status === "approved"
                          ? "rounded bg-primary/10 px-1.5 py-0.5 text-primary"
                          : "rounded bg-destructive/10 px-1.5 py-0.5 text-destructive"
                      }
                    >
                      {r.status}
                    </span>
                    {r.admin_notes && (
                      <span className="text-muted-foreground">“{r.admin_notes}”</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Doctors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="h-4 w-4 text-primary" />
            Doctors
            <span className="text-xs font-normal text-muted-foreground">{doctors.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search doctors…" value={doctorSearch} onChange={(e) => setDoctorSearch(e.target.value)} />
          </div>
          {members.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : doctors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No doctors yet. Approve a signup above or create one from Users &amp; Roles.
            </p>
          ) : filteredDoctors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No match</p>
          ) : (
            filteredDoctors.map((m) => (
              <DoctorCard
                key={m.id}
                member={m}
                businessId={businessId}
                onSaveSections={(next) => saveSections(m.id, next)}
                onSaveIdentity={(n, q) => saveDoctorIdentity(m.id, n, q)}
              />
            ))
          )}
          {others.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {others.length} other member(s) (Admin / Salesman) are managed in Users &amp; Roles.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PendingCard({
  req,
  busy,
  onApprove,
  onReject,
}: {
  req: RequestRow;
  busy: boolean;
  onApprove: (role: string) => void;
  onReject: (notes: string | null) => void;
}) {
  const [role, setRole] = useState(req.requested_role || "Doctor");
  const [notes, setNotes] = useState("");

  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{req.full_name || req.email}</div>
          <div className="text-xs text-muted-foreground">{req.email}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {req.phone && <span>📞 {req.phone}</span>}
            {req.qualification && <span>{req.qualification}</span>}
            <span>Requested: {req.requested_role}</span>
            <span>{new Date(req.created_at).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-9 rounded-lg border border-border bg-input px-2 text-sm"
          >
            <option value="Doctor">Doctor (Prescriptions only)</option>
            <option value="Salesman">Salesman</option>
            <option value="Admin">Admin</option>
          </select>
          <Button size="sm" disabled={busy} onClick={() => onApprove(role)}>
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onReject(notes.trim() || null)}
          >
            <X className="h-4 w-4" /> Reject
          </Button>
        </div>
      </div>
      <Input
        className="mt-2 h-8 text-xs"
        placeholder="Optional note (shown on rejection)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
    </div>
  );
}

function DoctorCard({
  member,
  businessId,
  onSaveSections,
  onSaveIdentity,
}: {
  member: Member;
  businessId: string | undefined;
  onSaveSections: (next: string[] | null) => void;
  onSaveIdentity: (name: string, qualification: string) => void;
}) {
  const rxOpts = useRxUserOptionSettings(businessId, member.id);
  const [n, setN] = useState(member.doctorName);
  const [q, setQ] = useState(member.doctorQualification);
  const dirty = n !== member.doctorName || q !== member.doctorQualification;
  const effective = member.allowedSections ?? ["prescriptions"];

  function toggleSection(key: string, on: boolean) {
    const next = on
      ? Array.from(new Set([...effective, key]))
      : effective.filter((k) => k !== key);
    onSaveSections(next);
  }

  const tri: { value: boolean | null; label: string }[] = [
    { value: null, label: "Default" },
    { value: true, label: "On" },
    { value: false, label: "Off" },
  ];

  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">
            {member.doctorName || member.name || "Unnamed doctor"}
          </div>
          <div className="text-xs text-muted-foreground">{member.email}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input
          className="h-9 text-sm"
          placeholder="Doctor name (on prescription)"
          value={n}
          onChange={(e) => setN(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            className="h-9 text-sm"
            placeholder="Qualification / designation"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {dirty && (
            <Button size="sm" onClick={() => onSaveIdentity(n, q)}>
              Save
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
          App sections this doctor can open
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_SECTIONS.map((s) => {
            const on = effective.includes(s.key);
            return (
              <button
                key={`${s.key}-${s.path}`}
                type="button"
                onClick={() => toggleSection(s.key, !on)}
                className={`rounded-md border px-2 py-1 text-xs ${
                  on
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border/60 text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onSaveSections(["prescriptions"])}
            className="rounded-md border border-dashed border-primary/50 px-2 py-1 text-xs text-primary"
          >
            Prescriptions only
          </button>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
          Shared Rx option lists for this doctor
        </p>
        <div className="space-y-1.5">
          {RX_OPTION_KINDS.map(({ kind, label }) => {
            const current = rxOpts.valueOf(kind as RxOptionKind);
            return (
              <div key={kind} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs">{label}</span>
                <div className="flex overflow-hidden rounded-md border border-border/60">
                  {tri.map((t) => (
                    <button
                      key={String(t.value)}
                      type="button"
                      disabled={rxOpts.isSaving}
                      onClick={() => rxOpts.set(kind as RxOptionKind, t.value)}
                      className={`px-2 py-1 text-[11px] ${
                        current === t.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          “Off” hides the business-wide default list from this doctor — they then see only their own
          items from “My Rx Lists”. “Default” follows the business setting in Manage Rx Options.
        </p>
      </div>
    </div>
  );
}
