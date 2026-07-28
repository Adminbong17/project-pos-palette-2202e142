import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { toast } from "sonner";
import { ShieldCheck, ShoppingCart, UserPlus } from "lucide-react";
import { ALL_SECTIONS } from "@/hooks/use-allowed-sections";
import { createBusinessUser } from "@/lib/admin-users.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/settings/users")({
  head: () => ({ meta: [{ title: "Users & Roles — QweekPOS" }] }),
  component: UsersAndRoles,
});

function UsersAndRoles() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const businessId = business?.id;
  const createUser = useServerFn(createBusinessUser);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "Salesman" as "Admin" | "Salesman",
  });
  const [saving, setSaving] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["business-members", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data: bus } = await supabase
        .from("business_users")
        .select("user_id")
        .eq("business_id", businessId!)
        .eq("is_active", true);
      const userIds = (bus ?? []).map((b) => b.user_id);
      if (!userIds.length) return [];
      const [{ data: profiles }, { data: userRoles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, email, first_name, last_name").in("id", userIds),
        supabase.from("user_roles").select("user_id, role_id, allowed_sections").eq("business_id", businessId!).in("user_id", userIds),
        supabase.from("roles").select("id, name").eq("business_id", businessId!),
      ]);
      const roleById = new Map((roles ?? []).map((r) => [r.id, r.name?.startsWith("Admin#") ? "Admin" : r.name]));
      const urByUser = new Map((userRoles ?? []).map((ur) => [ur.user_id, ur]));
      return (profiles ?? []).map((p) => {
        const ur = urByUser.get(p.id);
        return {
          id: p.id,
          email: p.email,
          name: [p.first_name, p.last_name].filter(Boolean).join(" "),
          roleId: ur?.role_id ?? null,
          roleName: ur?.role_id ? roleById.get(ur.role_id) ?? null : null,
          allowedSections: ((ur as any)?.allowed_sections as string[] | null) ?? null,
        };
      });
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data } = await supabase
        .from("roles")
        .select("id, name, allowed_sections")
        .eq("business_id", businessId!)
        .or("name.eq.Salesman,name.ilike.Admin%");
      return (data ?? []).map((role) => ({
        ...role,
        name: role.name?.startsWith("Admin#") ? "Admin" : role.name,
      }));
    },
  });

  const salesmanRole = roles.find((r) => r.name === "Salesman");
  const salesmanSections: string[] =
    (salesmanRole?.allowed_sections as string[] | null) ?? ["pos", "purchases"];

  async function toggleSalesmanSection(key: string, checked: boolean) {
    if (!salesmanRole) return;
    const next = checked
      ? Array.from(new Set([...salesmanSections, key]))
      : salesmanSections.filter((k) => k !== key);
    const { error } = await supabase
      .from("roles")
      .update({ allowed_sections: next })
      .eq("id", salesmanRole.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Salesman access updated");
      qc.invalidateQueries({ queryKey: ["roles", businessId] });
      qc.invalidateQueries({ queryKey: ["allowed-sections", businessId] });
    }
  }

  async function toggleUserSection(userId: string, key: string, checked: boolean, current: string[] | null) {
    if (!businessId) return;
    let next: string[] | null;
    if (current === null) {
      next = null; // reset to role default
    } else {
      next = checked
        ? Array.from(new Set([...current, key]))
        : current.filter((k) => k !== key);
    }
    const { error } = await supabase
      .from("user_roles")
      .update({ allowed_sections: next })
      .eq("user_id", userId)
      .eq("business_id", businessId);
    if (error) toast.error(error.message);
    else {
      toast.success("Access updated");
      qc.invalidateQueries({ queryKey: ["business-members", businessId] });
      qc.invalidateQueries({ queryKey: ["allowed-sections", businessId] });
    }
  }

  async function setDoctorOnly(userId: string) {
    if (!businessId) return;
    const { error } = await supabase
      .from("user_roles")
      .update({ allowed_sections: ["prescriptions"] })
      .eq("user_id", userId)
      .eq("business_id", businessId);
    if (error) toast.error(error.message);
    else {
      toast.success("Doctor mode enabled — only Prescriptions is visible");
      qc.invalidateQueries({ queryKey: ["business-members", businessId] });
      qc.invalidateQueries({ queryKey: ["allowed-sections", businessId] });
    }
  }



  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    try {
      await createUser({
        data: {
          business_id: businessId,
          email: form.email.trim(),
          password: form.password,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role: form.role,
        },
      });
      toast.success("User created");
      setOpen(false);
      setForm({ email: "", password: "", first_name: "", last_name: "", role: "Salesman" });
      qc.invalidateQueries({ queryKey: ["business-members", businessId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function assignRole(userId: string, roleId: string) {
    if (!businessId) return;
    await supabase.from("user_roles").delete().eq("user_id", userId).eq("business_id", businessId);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role_id: roleId, business_id: businessId });
    if (error) toast.error(error.message);
    else {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["business-members", businessId] });
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-semibold">Users & Roles</h1>
          <p className="text-sm text-muted-foreground">Create users and assign Admin or Salesman role.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" /> Create user
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-primary" /> Admin</div>
          <p className="text-xs text-muted-foreground mt-1">Full access to all sections.</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><ShoppingCart className="h-4 w-4 text-primary" /> Salesman</div>
          <p className="text-xs text-muted-foreground mt-1">Only the sections you enable below are visible.</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><ShoppingCart className="h-4 w-4 text-primary" /> Doctor</div>
          <p className="text-xs text-muted-foreground mt-1">Prescriptions only — no POS, products or stock. Use the “Doctor only” button in the table.</p>
        </div>
      </div>


      <div className="rounded-xl border border-border/60 bg-card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Salesman access</div>
            <p className="text-xs text-muted-foreground">Choose which sections Salesman users can open.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_SECTIONS.map((s) => {
            const checked = salesmanSections.includes(s.key);
            return (
              <label
                key={s.key}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                  checked ? "border-primary/60 bg-primary/5" : "border-border/60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!salesmanRole}
                  onChange={(e) => toggleSalesmanSection(s.key, e.target.checked)}
                />
                <span>{s.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Sections (Salesman only)</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && members.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No users yet.</td></tr>
            )}
            {members.map((m) => {
              const isSalesman = m.roleName === "Salesman";
              const effective = m.allowedSections ?? (isSalesman ? salesmanSections : []);
              return (
                <tr key={m.id} className="border-t border-border/60 align-top">
                  <td className="p-3">{m.name || "—"}</td>
                  <td className="p-3 text-muted-foreground">{m.email}</td>
                  <td className="p-3">
                    <select
                      value={m.roleId ?? ""}
                      onChange={(e) => assignRole(m.id, e.target.value)}
                      className="h-9 rounded-lg border border-border bg-input px-2 text-sm"
                    >
                      <option value="" disabled>Select role…</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    {isSalesman ? (
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {ALL_SECTIONS.map((s) => {
                          const on = effective.includes(s.key);
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => toggleUserSection(m.id, s.key, !on, effective)}
                              className={`text-xs px-2 py-1 rounded-md border ${
                                on ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground"
                              }`}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                        {m.allowedSections && (
                          <button
                            type="button"
                            onClick={() => toggleUserSection(m.id, "", false, null as any)}
                            className="text-xs px-2 py-1 rounded-md border border-dashed border-border/60 text-muted-foreground"
                            title="Reset to Salesman default"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">All access</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new user</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First name</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input
                type="text"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 6 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "Admin" | "Salesman" })}
                className="h-9 w-full rounded-md border border-border bg-input px-2 text-sm"
              >
                <option value="Salesman">Salesman</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
