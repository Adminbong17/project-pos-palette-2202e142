import { useMemo, useState } from "react";
import { fmtDateTime } from "@/lib/format-date";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Stethoscope, ClipboardCheck, Search, Users, MapPin, ArrowRightLeft } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { moveDoctorToOwnBusiness } from "@/lib/admin-businesses.functions";
import {
  listAllRequests,
  approveAccessRequestServer,
  rejectAccessRequestServer,
} from "@/lib/admin-requests.functions";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { ALL_SECTIONS, expandSections } from "@/hooks/use-allowed-sections";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";

import {
  RX_OPTION_KINDS,
  useRxUserOptionSettings,
  type RxOptionKind,
} from "@/hooks/use-rx-option-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

type AssistantRow = {
  id: string;
  doctor_id: string;
  name: string;
  username: string;
  phone: string | null;
  chamber: string | null;
};

type ApproveMode = "existing" | "own" | "clinic";

function AdminDoctorsPage() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin, isLoading: roleLoading } = useCurrentRole();
  const { isSuperAdmin } = useIsSuperAdmin();

  const businessId = business?.id;
  const qc = useQueryClient();
  const [pendingSearch, setPendingSearch] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");

  const fetchAllReqs = useServerFn(listAllRequests);
  const approveReqFn = useServerFn(approveAccessRequestServer);
  const rejectReqFn = useServerFn(rejectAccessRequestServer);

  const requests = useQuery({
    queryKey: ["access-requests"],
    queryFn: async () => {
      try {
        const res = await fetchAllReqs();
        return (res?.accessRequests ?? []) as RequestRow[];
      } catch (e: any) {
        console.warn("Falling back to client query:", e);
        const { data, error } = await supabase
          .from("access_requests")
          .select("id, user_id, email, full_name, phone, qualification, requested_role, status, created_at, admin_notes")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        return (data ?? []) as RequestRow[];
      }
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

  const assistants = useQuery({
    queryKey: ["business-assistants", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const [{ data: staff }, { data: chambers }] = await Promise.all([
        supabase
          .from("rx_staff")
          .select("id, doctor_id, name, username, phone, chamber_id, is_active")
          .eq("business_id", businessId!)
          .eq("is_active", true)
          .order("name"),
        supabase.from("rx_chambers").select("id, name").eq("business_id", businessId!),
      ]);
      const chamberById = new Map((chambers ?? []).map((c: any) => [c.id, c.name] as const));
      return (staff ?? []).map((a: any) => ({
        id: a.id,
        doctor_id: a.doctor_id as string,
        name: a.name as string,
        username: a.username as string,
        phone: (a.phone as string | null) ?? null,
        chamber: a.chamber_id ? (chamberById.get(a.chamber_id) ?? null) : null,
      })) as AssistantRow[];
    },
  });

  const approve = useMutation({
    mutationFn: async (args: {
      id: string;
      role: string;
      sections: string[] | null;
      mode?: ApproveMode;
      businessName?: string;
      clinicType?: "general" | "dental";
    }) => {
      try {
        await approveReqFn({
          data: {
            id: args.id,
            role: args.role,
            sections: args.sections,
            mode: args.mode ?? "existing",
            businessName: args.businessName,
            clinicType: args.clinicType ?? "general",
            businessId: businessId,
          },
        });
      } catch (err: any) {
        console.warn("Server approve failed, trying RPC fallback:", err);
        if (args.mode === "clinic") {
          const { error } = await supabase.rpc("approve_access_request_clinic", {
            _id: args.id,
            _clinic_name: args.businessName || undefined,
            _sections: args.sections ?? undefined,
            _notes: undefined,
            _clinic_type: args.clinicType ?? "general",
          } as any);
          if (error) throw error;
          return;
        }
        if (args.mode === "own") {
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
      }
    },

    onSuccess: () => {
      toast.success("Approved successfully!");
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      qc.invalidateQueries({ queryKey: ["business-members", businessId] });
      qc.invalidateQueries({ queryKey: ["super-admin-master-metrics"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not approve"),
  });

  const reject = useMutation({
    mutationFn: async (args: { id: string; notes: string | null }) => {
      try {
        await rejectReqFn({
          data: {
            id: args.id,
            notes: args.notes || undefined,
          },
        });
      } catch (err: any) {
        console.warn("Server reject failed, trying RPC fallback:", err);
        const { error } = await supabase.rpc("reject_access_request", {
          _id: args.id,
          _notes: args.notes ?? undefined,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Rejected");
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      qc.invalidateQueries({ queryKey: ["super-admin-master-metrics"] });
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

  const moveDoctor = useServerFn(moveDoctorToOwnBusiness);

  const moveOut = useMutation({
    mutationFn: async (args: { user_id: string; business_name?: string }) =>
      await moveDoctor({ data: args }),
    onSuccess: () => {
      toast.success("Doctor moved to their own business");
      qc.invalidateQueries({ queryKey: ["business-members", businessId] });
      qc.invalidateQueries({ queryKey: ["business-assistants", businessId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not move this doctor"),
  });

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
                assistants={(assistants.data ?? []).filter((a) => a.doctor_id === m.id)}
                canMove={isSuperAdmin}
                moving={moveOut.isPending}
                onMoveOut={(name) => moveOut.mutate({ user_id: m.id, business_name: name })}
                onSaveSections={(next) => saveSections(m.id, next)}
                onSaveIdentity={(n, q) => saveDoctorIdentity(m.id, n, q)}
              />
            ))
          )}
          {(() => {
            const doctorIds = new Set(doctors.map((d) => d.id));
            const orphans = (assistants.data ?? []).filter((a) => !doctorIds.has(a.doctor_id));
            if (!orphans.length) return null;
            return (
              <div className="rounded-lg border border-dashed border-border/60 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Unassigned assistants ({orphans.length})
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {orphans.map((a) => (
                    <span key={a.id} className="rounded bg-muted/40 px-2 py-1">
                      {a.name} · {a.username}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
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

type ApproveArgs = {
  role: string;
  sections: string[] | null;
  mode?: ApproveMode;
  businessName?: string;
  clinicType?: "general" | "dental";
};

// Modules a brand-new clinic gets: it manages doctors + the serial queue only.
const CLINIC_DEFAULT_SECTIONS = ["clinic", "rx-queue"];

// Default modules a brand-new shop (POS) owner gets — no prescription access
// unless the super admin ticks it.
const POS_DEFAULT_SECTIONS = [
  "dashboard",
  "pos",
  "sales",
  "purchases",
  "products",
  "quick-box",
  "files",
  "contacts",
  "stock-transfers",
  "expenses",
  "accounts",
  "reports",
  "settings",
];

function PendingCard({
  req,
  busy,
  canCreateBusiness,
  onApprove,
  onReject,
}: {
  req: RequestRow;
  busy: boolean;
  canCreateBusiness: boolean;
  onApprove: (args: ApproveArgs) => void;
  onReject: (notes: string | null) => void;
}) {
  const requested = req.requested_role || "Doctor";
  const wantsClinic = requested === "Clinic";
  const wantsPos = requested !== "Doctor" && !wantsClinic;
  const [role, setRole] = useState(wantsClinic ? "Doctor" : requested);
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<ApproveMode>(
    !canCreateBusiness ? "existing" : wantsClinic ? "clinic" : wantsPos ? "own" : "existing",
  );
  const [businessName, setBusinessName] = useState(
    wantsClinic ? req.qualification || req.full_name || "" : req.full_name || "",
  );
  const [clinicType, setClinicType] = useState<"general" | "dental">("general");
  const [sections, setSections] = useState<string[]>(
    expandSections(wantsClinic ? CLINIC_DEFAULT_SECTIONS : wantsPos ? POS_DEFAULT_SECTIONS : ["prescriptions"])!,
  );
  const ownBusiness = mode === "own";
  const clinic = mode === "clinic";

  const sectionOptions = useMemo(() => {
    const seen = new Set<string>();
    return ALL_SECTIONS.filter((s) => !seen.has(s.key) && seen.add(s.key));
  }, []);

  function toggle(key: string, on: boolean) {
    setSections((prev) => (on ? Array.from(new Set([...prev, key])) : prev.filter((k) => k !== key)));
  }

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
            <span>{fmtDateTime(req.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "existing" && (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-9 rounded-lg border border-border bg-input px-2 text-sm"
            >
              <option value="Doctor">Doctor (Prescriptions only)</option>
              <option value="Salesman">Salesman</option>
              <option value="Admin">Admin</option>
            </select>
          )}
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              onApprove(
                clinic
                  ? {
                      role: "Clinic Admin",
                      sections: sections.length ? sections : CLINIC_DEFAULT_SECTIONS,
                      mode: "clinic",
                      businessName: businessName.trim(),
                      clinicType,
                    }
                  : ownBusiness
                    ? {
                        role: "Admin",
                        sections: sections.length ? sections : POS_DEFAULT_SECTIONS,
                        mode: "own",
                        businessName: businessName.trim(),
                      }
                    : {
                        role,
                        sections:
                          role === "Doctor" ? ["prescriptions"] : sections.length ? sections : null,
                        mode: "existing",
                      },
              )
            }
          >
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

      {canCreateBusiness && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
          {(
            [
              ["existing", "Join this business"],
              ["own", "Own separate POS / business"],
              ["clinic", "New Clinic (doctors + serial)"],
            ] as [ApproveMode, string][]
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                className="size-3.5"
                checked={mode === value}
                onChange={() => {
                  setMode(value);
                  if (value === "clinic") setSections(CLINIC_DEFAULT_SECTIONS);
                  else if (value === "own") setSections(POS_DEFAULT_SECTIONS);
                }}
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {clinic && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium">
          <span className="text-muted-foreground">Clinic mode:</span>
          {(
            [
              ["general", "General mode"],
              ["dental", "Dental mode"],
            ] as ["general" | "dental", string][]
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                className="size-3.5"
                checked={clinicType === value}
                onChange={() => setClinicType(value)}
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {(ownBusiness || clinic) && (
        <Input
          className="mt-2 h-8 text-xs"
          placeholder={clinic ? "Clinic name" : "Shop / business name"}
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />
      )}

      {(ownBusiness || clinic || role !== "Doctor") && (
        <div className="mt-2 rounded-md border border-border/60 p-2">
          <p className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
            Sections &amp; modules
          </p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
            {sectionOptions.map((s) => (
              <label key={s.key} className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  className="size-3.5"
                  checked={sections.includes(s.key)}
                  onChange={(e) => toggle(s.key, e.target.checked)}
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}

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
  assistants,
  canMove,
  moving,
  onMoveOut,
  onSaveSections,
  onSaveIdentity,
}: {
  member: Member;
  businessId: string | undefined;
  assistants: AssistantRow[];
  canMove: boolean;
  moving: boolean;
  onMoveOut: (businessName?: string) => void;
  onSaveSections: (next: string[] | null) => void;
  onSaveIdentity: (name: string, qualification: string) => void;
}) {
  const rxOpts = useRxUserOptionSettings(businessId, member.id);
  const [n, setN] = useState(member.doctorName);
  const [q, setQ] = useState(member.doctorQualification);
  const dirty = n !== member.doctorName || q !== member.doctorQualification;
  const effective = expandSections(member.allowedSections) ?? expandSections(["prescriptions"])!;

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
          <div className="text-sm font-semibold whitespace-pre-wrap">
            {member.doctorName || member.name || "Unnamed doctor"}
          </div>
          <div className="text-xs text-muted-foreground">{member.email}</div>
        </div>
        {canMove && (
          <Button
            size="sm"
            variant="outline"
            disabled={moving}
            onClick={() => {
              if (
                !window.confirm(
                  `Move ${member.doctorName || member.name} (and their assistants) into their own separate business?`,
                )
              )
                return;
              onMoveOut(member.doctorName || member.name || undefined);
            }}
          >
            <ArrowRightLeft className="h-4 w-4" /> Move to own business
          </Button>
        )}
      </div>

      <div className="mt-3 rounded-md border border-border/60 p-2">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Assistants under this doctor ({assistants.length})
        </p>
        {assistants.length === 0 ? (
          <p className="text-xs text-muted-foreground">No assistant yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2 text-xs">
            {assistants.map((a) => (
              <span
                key={a.id}
                className="flex items-center gap-1.5 rounded bg-muted/40 px-2 py-1"
              >
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">{a.username}</span>
                {a.phone && <span className="text-muted-foreground">📞 {a.phone}</span>}
                {a.chamber && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {a.chamber}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Textarea
          className="min-h-[44px] resize-none text-sm"
          rows={2}
          placeholder="Doctor name (on prescription)"
          value={n}
          onChange={(e) => setN(e.target.value)}
        />
        <div className="flex gap-2">
          <Textarea
            className="min-h-[44px] resize-none text-sm"
            rows={2}
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
            onClick={() => onSaveSections(expandSections(["prescriptions"])!)}
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
