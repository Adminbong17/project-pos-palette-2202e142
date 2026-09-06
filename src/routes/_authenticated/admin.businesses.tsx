import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Search, Save, ArrowRightLeft, Users, Trash2 } from "lucide-react";

import { ALL_SECTIONS, expandSections } from "@/hooks/use-allowed-sections";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";
import {
  listBusinessesWithMembers,
  setMemberSections,
  setBusinessSections,
  moveDoctorToOwnBusiness,
  deleteBusiness,
  type BizRow,
  type BizMember,
} from "@/lib/admin-businesses.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/businesses")({
  head: () => ({
    meta: [
      { title: "Businesses & Modules — QweekPOS" },
      {
        name: "description",
        content:
          "Super admin view of every business on the platform: see members and switch modules like POS, Prescriptions, HRM or CRM on and off at any time.",
      },
      { property: "og:title", content: "Businesses & Modules — QweekPOS" },
      {
        property: "og:description",
        content: "Manage every business, its members and the modules each member can use.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminBusinessesPage,
});

const KIND_LABEL: Record<string, string> = {
  pos: "POS / Shop",
  doctor: "Doctor",
  clinic: "Clinic",
};

function AdminBusinessesPage() {
  const { isSuperAdmin, isLoading: superLoading } = useIsSuperAdmin();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const list = useServerFn(listBusinessesWithMembers);
  const saveMember = useServerFn(setMemberSections);
  const saveBusiness = useServerFn(setBusinessSections);
  const moveDoctor = useServerFn(moveDoctorToOwnBusiness);
  const removeBiz = useServerFn(deleteBusiness);

  const q = useQuery({
    queryKey: ["admin-businesses"],
    enabled: isSuperAdmin,
    queryFn: async () => (await list({})) as BizRow[],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-businesses"] });

  const memberMut = useMutation({
    mutationFn: (v: { business_id: string; user_id: string; sections: string[] | null }) =>
      saveMember({ data: v }),
    onSuccess: () => {
      toast.success("Modules saved");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const bizMut = useMutation({
    mutationFn: (v: { business_id: string; sections: string[] | null }) => saveBusiness({ data: v }),
    onSuccess: () => {
      toast.success("Modules applied to every member");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const moveMut = useMutation({
    mutationFn: (v: { user_id: string; business_name?: string }) => moveDoctor({ data: v }),
    onSuccess: () => {
      toast.success("Doctor moved to their own business");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not move the doctor"),
  });

  const deleteMut = useMutation({
    mutationFn: (v: { business_id: string }) => removeBiz({ data: v }),
    onSuccess: () => {
      toast.success("Business deleted");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete this business"),
  });

  const rows = useMemo(() => {
    const all = q.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((b) =>
      [b.name, b.kind, b.owner_email, ...b.members.map((m) => `${m.name} ${m.email} ${m.role}`)]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ")
        .includes(needle),
    );
  }, [q.data, search]);

  if (!superLoading && !isSuperAdmin) {
    return (
      <div className="p-6">
        <h1 className="font-display text-xl font-semibold">Businesses &amp; Modules</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only the platform super admin can open this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Businesses &amp; Modules</h1>
        <p className="text-sm text-muted-foreground">
          Every business on the platform. Tick or untick modules for each member at any time — this
          is where you add a module after approval.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search business, owner or member…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">
          {(q.error as any)?.message ?? "Could not load businesses"}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No businesses match.</p>

      ) : (
        rows.map((b) => (
          <BusinessCard
            key={b.id}
            biz={b}
            busy={memberMut.isPending || bizMut.isPending || moveMut.isPending || deleteMut.isPending}
            onSaveMember={(user_id, sections) =>
              memberMut.mutate({ business_id: b.id, user_id, sections })
            }
            onSaveAll={(sections) => bizMut.mutate({ business_id: b.id, sections })}
            onMoveDoctor={(user_id) => moveMut.mutate({ user_id })}
            onDelete={() => {
              if (
                window.confirm(
                  `Delete "${b.name}" permanently? Its members, roles, billing and credit records will be removed. This cannot be undone.`,
                )
              )
                deleteMut.mutate({ business_id: b.id });
            }}
          />
        ))
      )}
    </div>
  );
}

function useSectionOptions() {
  return useMemo(() => {
    const seen = new Set<string>();
    return ALL_SECTIONS.filter((s) => !seen.has(s.key) && seen.add(s.key));
  }, []);
}

function BusinessCard({
  biz,
  busy,
  onSaveMember,
  onSaveAll,
  onMoveDoctor,
  onDelete,
}: {
  biz: BizRow;
  busy: boolean;
  onSaveMember: (userId: string, sections: string[] | null) => void;
  onSaveAll: (sections: string[] | null) => void;
  onMoveDoctor: (userId: string) => void;
  onDelete: () => void;
}) {
  const options = useSectionOptions();
  const [bulk, setBulk] = useState<string[]>([]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Building2 className="h-4 w-4 text-primary" />
          {biz.name}
          <Badge variant="outline" className="text-[10px]">
            {KIND_LABEL[biz.kind] ?? biz.kind}
          </Badge>
          <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {biz.members.length}
          </span>
          {biz.owner_email && (
            <span className="text-xs font-normal text-muted-foreground">
              owner: {biz.owner_email}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="ml-auto text-destructive hover:bg-destructive/10"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-dashed border-border/60 p-2">
          <p className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
            Give these modules to every member
          </p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
            {options.map((s) => (
              <label key={s.key} className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  className="size-3.5"
                  checked={bulk.includes(s.key)}
                  onChange={(e) =>
                    setBulk((prev) =>
                      e.target.checked
                        ? Array.from(new Set([...prev, s.key]))
                        : prev.filter((k) => k !== s.key),
                    )
                  }
                />
                {s.label}
              </label>
            ))}
          </div>
          <Button
            size="sm"
            className="mt-2 h-8 text-xs"
            disabled={busy || bulk.length === 0}
            onClick={() => onSaveAll(bulk)}
          >
            <Save className="mr-1 h-3.5 w-3.5" /> Apply to all members
          </Button>
        </div>

        {biz.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          biz.members.map((m) => (
            <MemberRow
              key={m.user_id}
              member={m}
              busy={busy}
              options={options}
              onSave={(sections) => onSaveMember(m.user_id, sections)}
              onMove={() => onMoveDoctor(m.user_id)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MemberRow({
  member,
  busy,
  options,
  onSave,
  onMove,
}: {
  member: BizMember;
  busy: boolean;
  options: { key: string; label: string }[];
  onSave: (sections: string[] | null) => void;
  onMove: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(expandSections(member.sections) ?? []);
  const full = member.sections === null;
  const dirty = JSON.stringify(picked) !== JSON.stringify(expandSections(member.sections) ?? []);

  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{member.name}</span>
        <span className="text-xs text-muted-foreground">{member.email}</span>
        {member.role && (
          <Badge variant="outline" className="text-[10px]">
            {member.role}
          </Badge>
        )}
        {!member.is_active && (
          <Badge variant="destructive" className="text-[10px]">
            Inactive
          </Badge>
        )}
        {full && <span className="text-[11px] text-muted-foreground">full access (no limit)</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {dirty && (
            <Button size="sm" className="h-8 text-xs" disabled={busy} onClick={() => onSave(picked)}>
              <Save className="mr-1 h-3.5 w-3.5" /> Save
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={busy}
            onClick={() => onSave(null)}
          >
            Full access
          </Button>
          {member.role === "Doctor" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    `Move ${member.name} (and their assistants) into their own separate business?`,
                  )
                )
                  onMove();
              }}
            >
              <ArrowRightLeft className="mr-1 h-3.5 w-3.5" /> Own business
            </Button>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
        {options.map((s) => (
          <label key={s.key} className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              className="size-3.5"
              checked={picked.includes(s.key)}
              onChange={(e) =>
                setPicked((prev) =>
                  e.target.checked
                    ? Array.from(new Set([...prev, s.key]))
                    : prev.filter((k) => k !== s.key),
                )
              }
            />
            {s.label}
          </label>
        ))}
      </div>
    </div>
  );
}
