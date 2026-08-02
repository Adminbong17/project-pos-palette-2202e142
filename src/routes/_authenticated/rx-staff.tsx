import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Trash2, KeyRound, Users, MapPin } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { staffUsernameToEmail, type RxStaff } from "@/lib/rx-staff";
import { createRxStaff, setRxStaffPassword, removeRxStaff } from "@/lib/rx-staff.functions";
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

  const chambers = useChambers(businessId);
  const chamberList = chambers.data ?? [];

  const [form, setForm] = useState({
    name: "",
    username: "",
    phone: "",
    password: "",
    chamber_id: "",
  });
  const [newChamber, setNewChamber] = useState({ name: "", address: "" });
  const [pwEdit, setPwEdit] = useState<Record<string, string>>({});

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
        .select("id, business_id, doctor_id, user_id, name, phone, username, is_active, chamber_id, created_at")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RxStaff[];
    },
  });

  const addStaff = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business");
      return create({
        data: {
          business_id: businessId,
          name: form.name,
          username: form.username,
          password: form.password,
          phone: form.phone,
          chamber_id: form.chamber_id || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Staff account created");
      setForm({ name: "", username: "", phone: "", password: "", chamber_id: "" });
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

  const setChamber = useMutation({
    mutationFn: async (v: { id: string; chamber_id: string | null }) => {
      const { error } = await supabase
        .from("rx_staff")
        .update({ chamber_id: v.chamber_id })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Location updated");
      qc.invalidateQueries({ queryKey: ["rx-staff"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update location"),
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
          <div>
            <Label className="mb-1.5 block text-xs">Assigned location</Label>
            <select
              value={form.chamber_id}
              onChange={(e) => setForm((s) => ({ ...s, chamber_id: e.target.value }))}
              className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm"
            >
              <option value="">— No location —</option>
              {chamberList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
        {staff.isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No staff yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
                <div className="min-w-40">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.username} · {staffUsernameToEmail(s.username)}
                  </div>
                </div>
                {s.phone && <span className="text-xs text-muted-foreground">{s.phone}</span>}
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <select
                    value={s.chamber_id ?? ""}
                    onChange={(e) => setChamber.mutate({ id: s.id, chamber_id: e.target.value || null })}
                    className="h-8 rounded-lg border border-border bg-input px-2 text-xs"
                  >
                    <option value="">— No location —</option>
                    {chamberList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
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
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
