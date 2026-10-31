import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Trash2, KeyRound, Users, MapPin, Search, Check, Edit2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { staffUsernameToEmail, type RxStaff } from "@/lib/rx-staff";
import {
  createRxStaff,
  setRxStaffPassword,
  removeRxStaff,
  updateRxStaffLocations,
} from "@/lib/rx-staff.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useChambers } from "@/components/appointment-queue";

export const Route = createFileRoute("/_authenticated/rx-staff")({
  head: () => ({
    meta: [
      { title: "My Staff — Doctor Assistants" },
      {
        name: "description",
        content:
          "Doctors create assistant accounts with a username and password so staff can list patients in the daily serial queue.",
      },
      { property: "og:title", content: "My Staff — Doctor Assistants" },
      {
        property: "og:description",
        content: "Create and manage assistant logins for the patient queue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffPage,
});

function StaffPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const qc = useQueryClient();

  const create = useServerFn(createRxStaff);
  const setPassword = useServerFn(setRxStaffPassword);
  const remove = useServerFn(removeRxStaff);
  const updateLocations = useServerFn(updateRxStaffLocations);

  const chambers = useChambers(businessId);
  const chamberList = chambers.data ?? [];

  const [form, setForm] = useState({
    name: "",
    username: "",
    phone: "",
    password: "",
    chamber_id: "",
    chamber_ids: [] as string[],
    is_all_locations: true,
  });
  const [editingStaffLocations, setEditingStaffLocations] = useState<{
    id: string;
    name: string;
    chamber_ids: string[];
    is_all_locations: boolean;
  } | null>(null);
  const [newChamber, setNewChamber] = useState({ name: "", address: "" });
  const [pwEdit, setPwEdit] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const addChamber = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business");
      if (!newChamber.name.trim()) throw new Error("Location name is required");
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("rx_chambers")
        .insert({
          business_id: businessId,
          name: newChamber.name.trim(),
          address: newChamber.address.trim() || null,
          created_by: auth.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Location added");
      setNewChamber({ name: "", address: "" });
      setForm((s) => ({ ...s, chamber_id: id }));
      qc.invalidateQueries({ queryKey: ["rx-chambers"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not add location"),
  });

  const delChamber = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rx_chambers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Location removed");
      qc.invalidateQueries({ queryKey: ["rx-chambers"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove location"),
  });


  const staff = useQuery({
    queryKey: ["rx-staff", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rx_staff")
        .select("id, business_id, doctor_id, user_id, name, phone, username, is_active, chamber_id, allowed_sections, created_at")
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (RxStaff & { allowed_sections?: string[] | null })[];
    },
  });

  function getStaffChamberIds(s: any): string[] {
    const rawSections = ((s as any).allowed_sections ?? []) as string[];
    const fromSec = rawSections
      .filter((sec: string) => typeof sec === "string" && sec.startsWith("chamber:"))
      .map((sec: string) => sec.replace("chamber:", ""));
    return Array.from(new Set([...fromSec, ...(s.chamber_id ? [s.chamber_id] : [])]));
  }

  const addStaff = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business");
      const selectedChambers = form.is_all_locations ? [] : form.chamber_ids;
      return create({
        data: {
          business_id: businessId,
          name: form.name,
          username: form.username,
          password: form.password,
          phone: form.phone,
          chamber_id: selectedChambers[0] || null,
          chamber_ids: selectedChambers,
        },
      });
    },
    onSuccess: () => {
      toast.success("Staff account created");
      setForm({
        name: "",
        username: "",
        phone: "",
        password: "",
        chamber_id: "",
        chamber_ids: [],
        is_all_locations: true,
      });
      qc.invalidateQueries({ queryKey: ["rx-staff"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create staff"),
  });

  const resetPw = useMutation({
    mutationFn: async (id: string) => {
      const pw = pwEdit[id] ?? "";
      return setPassword({ data: { staff_id: id, password: pw } });
    },
    onSuccess: (_d, id) => {
      toast.success("Password updated");
      setPwEdit((s) => ({ ...s, [id]: "" }));
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update password"),
  });

  const setStaffLocations = useMutation({
    mutationFn: async (v: { id: string; chamber_ids: string[]; primary_id?: string | null }) => {
      return updateLocations({
        data: {
          staff_id: v.id,
          chamber_ids: v.chamber_ids,
          primary_chamber_id: v.primary_id,
        },
      });
    },
    onSuccess: () => {
      toast.success("Locations updated");
      setEditingStaffLocations(null);
      qc.invalidateQueries({ queryKey: ["rx-staff"] });
      qc.invalidateQueries({ queryKey: ["my-staff-chamber"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update locations"),
  });

  const delStaff = useMutation({
    mutationFn: async (id: string) => remove({ data: { staff_id: id } }),
    onSuccess: () => {
      toast.success("Staff removed");
      qc.invalidateQueries({ queryKey: ["rx-staff"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove staff"),
  });

  const rows = staff.data ?? [];

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((s) => {
      const chamber = chamberList.find((c) => c.id === s.chamber_id)?.name;
      return [s.name, s.username, staffUsernameToEmail(s.username), s.phone, chamber, s.is_active ? "active" : "inactive"]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ")
        .includes(q);
    });
  }, [rows, search, chamberList]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">My Staff</h1>
        <p className="text-sm text-muted-foreground">
          Create assistant logins (username + password). Assistants can only manage the patient queue.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">My locations (chambers)</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="Location name"
            value={newChamber.name}
            onChange={(e) => setNewChamber((s) => ({ ...s, name: e.target.value }))}
          />
          <Input
            placeholder="Address (optional)"
            value={newChamber.address}
            onChange={(e) => setNewChamber((s) => ({ ...s, address: e.target.value }))}
          />
          <Button onClick={() => addChamber.mutate()} disabled={addChamber.isPending}>
            <MapPin className="mr-1 h-4 w-4" /> {addChamber.isPending ? "Adding…" : "Add location"}
          </Button>
        </div>
        {chamberList.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {chamberList.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs"
              >
                <span>{c.name}</span>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => { if (confirm(`Remove ${c.name}?`)) delChamber.mutate(c.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Add a location first — then assign it to each staff member below.
          </p>
        )}
      </div>


      <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Add staff</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="mb-1.5 block text-xs">Staff name *</Label>
            <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Assistant name" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Username *</Label>
            <Input
              value={form.username}
              onChange={(e) => setForm((s) => ({ ...s, username: e.target.value.toLowerCase() }))}
              placeholder="e.g. rafi.assistant"
              autoComplete="off"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="Phone" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Password *</Label>
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              placeholder="min 6 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4 rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" /> চেম্বার / লোকেশন অ্যাক্সেস
              </Label>
              <button
                type="button"
                onClick={() =>
                  setForm((s) => ({
                    ...s,
                    is_all_locations: !s.is_all_locations,
                    chamber_ids: [],
                  }))
                }
                className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                  form.is_all_locations
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {form.is_all_locations ? "✓ সব লোকেশন (All Locations)" : "নির্দিষ্ট লোকেশন নির্বাচন করুন"}
              </button>
            </div>
            {!form.is_all_locations && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] text-muted-foreground">
                  এই স্টাফকে কোন কোন চেম্বারে কাজ করার অনুমতি দিতে চান নির্বাচন করুন (এক বা একাধিক):
                </p>
                <div className="flex flex-wrap gap-2">
                  {chamberList.map((c) => {
                    const isChecked = form.chamber_ids.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setForm((s) => {
                            const next = isChecked
                              ? s.chamber_ids.filter((id) => id !== c.id)
                              : [...s.chamber_ids, c.id];
                            return { ...s, chamber_ids: next };
                          });
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${
                          isChecked
                            ? "bg-primary/10 border-primary text-primary font-semibold shadow-2xs"
                            : "bg-background border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isChecked ? "bg-primary" : "bg-muted-foreground/40"
                          }`}
                        />
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={() => addStaff.mutate()} disabled={addStaff.isPending}>
            <UserPlus className="mr-1 h-4 w-4" />
            {addStaff.isPending ? "Creating…" : "Create staff account"}
          </Button>
          {form.username.trim() && (
            <span className="text-xs text-muted-foreground">
              Staff will sign in with username <b>{form.username.trim().toLowerCase()}</b>
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Staff accounts</h2>
          <span className="ml-auto text-xs text-muted-foreground">{rows.length}</span>
        </div>
        {rows.length > 0 && (
          <div className="relative m-4 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search staff…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}
        {staff.isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No staff yet.</p>
        ) : filteredRows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No match</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {filteredRows.map((s) => {
              const cIds = getStaffChamberIds(s);
              const isAll = cIds.length === 0 && !s.chamber_id;
              const assignedChamberObjs = chamberList.filter((c) => cIds.includes(c.id));

              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
                  <div className="min-w-40">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.username} · {staffUsernameToEmail(s.username)}
                    </div>
                  </div>
                  {s.phone && <span className="text-xs text-muted-foreground">{s.phone}</span>}

                  {/* Multi-Location Badge & Editor Trigger */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingStaffLocations({
                          id: s.id,
                          name: s.name,
                          chamber_ids: cIds,
                          is_all_locations: isAll,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/80 hover:bg-muted px-2.5 py-1 text-xs text-foreground transition-all cursor-pointer"
                      title="লোকেশন পরিবর্তন বা একাধিক লোকেশন যোগ করুন"
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      {isAll ? (
                        <span className="font-medium text-primary">সব লোকেশন</span>
                      ) : assignedChamberObjs.length === 0 ? (
                        <span className="text-muted-foreground">— লোকেশন নেই —</span>
                      ) : assignedChamberObjs.length === 1 ? (
                        <span>{assignedChamberObjs[0].name}</span>
                      ) : (
                        <span>
                          {assignedChamberObjs[0].name}{" "}
                          <span className="rounded bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold">
                            +{assignedChamberObjs.length - 1}টি
                          </span>
                        </span>
                      )}
                      <Edit2 className="h-3 w-3 text-muted-foreground ml-1 shrink-0" />
                    </button>
                  </div>
                <Badge variant="outline" className="text-[10px]">
                  {s.is_active ? "Active" : "Inactive"}
                </Badge>
                <div className="ml-auto flex items-center gap-1.5">
                  <Input
                    className="h-8 w-40 text-xs"
                    placeholder="New password"
                    value={pwEdit[s.id] ?? ""}
                    onChange={(e) => setPwEdit((p) => ({ ...p, [s.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={resetPw.isPending || !(pwEdit[s.id] ?? "").trim()}
                    onClick={() => resetPw.mutate(s.id)}
                  >
                    <KeyRound className="mr-1 h-3.5 w-3.5" /> Set
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => { if (confirm(`Remove ${s.name}?`)) delStaff.mutate(s.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
          </ul>
        )}
      </div>

      {/* Multi-Location Assignment Modal */}
      {editingStaffLocations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" /> লোকেশন ও চেম্বার পারমিশন
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  স্টাফ কর্মী: <b className="text-foreground">{editingStaffLocations.name}</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaffLocations(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 p-3">
                <div>
                  <div className="text-xs font-semibold text-foreground">সব চেম্বারে অ্যাক্সেস (All Locations)</div>
                  <div className="text-[11px] text-muted-foreground">যেকোনো চেম্বারের রোগীর সিরিয়াল এন্ট্রি নিতে পারবে</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingStaffLocations((s) =>
                      s
                        ? {
                            ...s,
                            is_all_locations: !s.is_all_locations,
                            chamber_ids: s.is_all_locations ? (chamberList[0] ? [chamberList[0].id] : []) : [],
                          }
                        : null
                    )
                  }
                  className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                    editingStaffLocations.is_all_locations
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {editingStaffLocations.is_all_locations ? "✓ সব লোকেশন চালু" : "নির্দিষ্ট চেম্বার"}
                </button>
              </div>

              {!editingStaffLocations.is_all_locations && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">
                    নির্দিষ্ট চেম্বার নির্বাচন করুন (এক বা একাধিক):
                  </Label>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {chamberList.map((c) => {
                      const isChecked = editingStaffLocations.chamber_ids.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setEditingStaffLocations((s) => {
                              if (!s) return null;
                              const next = isChecked
                                ? s.chamber_ids.filter((id) => id !== c.id)
                                : [...s.chamber_ids, c.id];
                              return { ...s, chamber_ids: next };
                            });
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                            isChecked
                              ? "bg-primary/10 border-primary text-foreground font-semibold"
                              : "bg-background border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                isChecked
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/40 bg-background"
                              }`}
                            >
                              {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                            </span>
                            <span>{c.name}</span>
                          </div>
                          {c.address && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                              {c.address}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingStaffLocations(null)}
              >
                বাতিল
              </Button>
              <Button
                size="sm"
                disabled={setStaffLocations.isPending}
                onClick={() => {
                  const finalChambers = editingStaffLocations.is_all_locations
                    ? []
                    : editingStaffLocations.chamber_ids;
                  setStaffLocations.mutate({
                    id: editingStaffLocations.id,
                    chamber_ids: finalChambers,
                    primary_id: finalChambers[0] || null,
                  });
                }}
              >
                {setStaffLocations.isPending ? "সেভ হচ্ছে…" : "লোকেশন সেভ করুন"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
