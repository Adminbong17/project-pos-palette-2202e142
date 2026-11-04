import { createFileRoute } from "@tanstack/react-router";
import { fmtDateTime } from "@/lib/format-date";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";
import { isSuperAdminEmail } from "@/lib/super-admin-auth";
import { FoldableList } from "@/components/foldable-list";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllUsers,
  setUserPassword,
  setUserDisabled,
  deleteUserAccount,
  listAllSimpleBusinesses,
  updateSuperAdminUser,
  type SuperAdminUser,
  type UserBizMembership,
} from "@/lib/super-admin-users.functions";
import { setMemberSections } from "@/lib/admin-businesses.functions";
import { ALL_SECTIONS, expandSections, PRESETS } from "@/hooks/use-allowed-sections";
import { splitDoctorQualification, combineDoctorQualification } from "@/lib/doctor-format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  KeyRound,
  Copy,
  Eye,
  EyeOff,
  Ban,
  Trash2,
  AlertTriangle,
  SlidersHorizontal,
  ShieldCheck,
  Save,
  Check,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { FoldTable } from "@/components/fold-table";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "All Users & Logins — Admin" },
      { name: "description", content: "Super admin: every POS and Rx user, their email, username, role and login password." },
      { property: "og:title", content: "All Users & Logins — Admin" },
      { property: "og:description", content: "Search every user account and manage their login password and module permissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function Page() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listAllUsers);
  const savePassword = useServerFn(setUserPassword);
  const toggleDisabled = useServerFn(setUserDisabled);
  const removeUser = useServerFn(deleteUserAccount);
  const [search, setSearch] = useState("");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<{ id: string; disabled: boolean } | null>(null);
  const [manageModulesUser, setManageModulesUser] = useState<SuperAdminUser | null>(null);

  const { isSuperAdmin, isLoading: superLoading } = useIsSuperAdmin();
  const me = useQuery({
    queryKey: ["me-email"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const isSuper = isSuperAdmin || isSuperAdminEmail(me.data?.email);

  const users = useQuery({
    queryKey: ["super-admin-users"],
    enabled: !!isSuper,
    queryFn: () => fetchUsers({ data: undefined as any }),
  });

  const setPass = useMutation({
    mutationFn: (v: { user_id: string; password: string }) => savePassword({ data: v }),
    onSuccess: (_r, v) => {
      toast.success("Password updated");
      setReveal((s) => ({ ...s, [v.user_id]: true }));
      qc.invalidateQueries({ queryKey: ["super-admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const disableUser = useMutation({
    mutationFn: (v: { user_id: string; disabled: boolean }) => toggleDisabled({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.disabled ? "User disabled" : "User enabled");
      setConfirmDisable(null);
      qc.invalidateQueries({ queryKey: ["super-admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: (v: { user_id: string }) => removeUser({ data: v }),
    onSuccess: () => {
      toast.success("User deleted");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["super-admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editUser = useServerFn(updateSuperAdminUser);
  const fetchBusinesses = useServerFn(listAllSimpleBusinesses);

  const [editingUser, setEditingUser] = useState<SuperAdminUser | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: "",
    username: "",
    name: "",
    doctor_degree: "",
    doctor_designation: "",
    phone: "",
    business_id: "",
    role: "Admin",
  });

  const businessesQuery = useQuery({
    queryKey: ["super-admin-simple-businesses"],
    enabled: !!isSuper,
    queryFn: () => fetchBusinesses({ data: undefined as any }),
  });
  const allBusinesses = businessesQuery.data ?? [];

  function openEditUser(u: SuperAdminUser) {
    setEditingUser(u);
    const matchedBiz = allBusinesses.find((b) => u.businesses.includes(b.name));
    const { degree, designation } = splitDoctorQualification(u.doctor_qualification ?? "");
    setUserFormData({
      email: u.email !== "—" ? u.email : "",
      username: u.username ?? "",
      name: (u.doctor_name || u.name) !== "—" ? (u.doctor_name || u.name) : "",
      doctor_degree: degree,
      doctor_designation: designation,
      phone: u.phone ?? "",
      business_id: u.primary_business_id || matchedBiz?.id || allBusinesses[0]?.id || "",
      role: u.primary_role || u.roles[0] || "Admin",
    });
  }

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const combinedQual = combineDoctorQualification(
        userFormData.doctor_degree,
        userFormData.doctor_designation
      );
      return await editUser({
        data: {
          user_id: editingUser.id,
          email: userFormData.email,
          username: userFormData.username,
          name: userFormData.name,
          doctor_qualification: combinedQual,
          phone: userFormData.phone,
          business_id: userFormData.business_id,
          role: userFormData.role,
        },
      });
    },
    onSuccess: () => {
      toast.success("ব্যবহারকারীর তথ্য সফলভাবে আপডেট হয়েছে!");
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ["super-admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-all-subscriptions"] });
    },
    onError: (e: any) => toast.error(e?.message || "ব্যবহারকারী আপডেট ব্যর্থ হয়েছে"),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = users.data ?? [];
    if (!q) return list;
    return list.filter((u) =>
      [u.email, u.username, u.name, u.doctor_name, u.phone, ...u.businesses, ...u.roles]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [users.data, search]);

  if (superLoading || (me.isLoading && !isSuper)) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!isSuper)
    return <div className="p-8 text-sm text-muted-foreground">Only the super admin can access this page.</div>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">All Users &amp; Logins</h1>
        <p className="text-sm text-muted-foreground">
          Every POS and Rx account. Manage passwords and tick/untick module permissions strictly for each user.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email, username, name, business, role…"
          className="pl-9"
        />
      </div>

      {users.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading users…</div>
      ) : users.error ? (
        <div className="text-sm text-destructive">{(users.error as any).message}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <FoldTable className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Email / Username</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Business</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left">Modules / Permissions</th>
                <th className="p-2 text-left">Last sign in</th>
                <th className="p-2 text-left">Password</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const shown = reveal[u.id];
                const isMe = me.data?.id === u.id;
                const memberships = u.business_memberships ?? [];
                return (
                  <tr key={u.id} className="border-t border-border align-top">
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-1.5 group">
                        <span className="font-medium">{u.email}</span>
                        {u.disabled && (
                          <Badge variant="destructive" className="text-[10px]">
                            Disabled
                          </Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditUser(u)}
                          className="opacity-40 hover:opacity-100 hover:text-primary transition-opacity p-0.5 rounded cursor-pointer"
                          title="ইমেইল / ইউজারনেম এডিট করুন"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </button>
                      </div>
                      {u.username && <div className="text-xs text-muted-foreground">@{u.username}</div>}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1.5 group">
                        <span className="font-medium">{u.doctor_name || u.name}</span>
                        <button
                          type="button"
                          onClick={() => openEditUser(u)}
                          className="opacity-40 hover:opacity-100 hover:text-primary transition-opacity p-0.5 rounded cursor-pointer"
                          title="নাম ও পদবি/যোগ্যতা এডিট করুন"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </button>
                      </div>
                      {u.doctor_qualification && (() => {
                        const { degree, designation } = splitDoctorQualification(u.doctor_qualification);
                        return (
                          <div className="space-y-0.5 max-w-[240px]">
                            {degree && (
                              <div className="text-[11px] text-sky-700 dark:text-sky-400 font-medium truncate" title={degree}>
                                🎓 {degree}
                              </div>
                            )}
                            {designation && (
                              <div className="text-[11px] text-teal-700 dark:text-teal-400 font-medium truncate" title={designation}>
                                💼 {designation}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
                    </td>
                    <td className="p-2 text-xs align-top">
                      <div className="flex items-center gap-1.5 group">
                        <FoldableList items={u.businesses.length ? u.businesses : ["—"]} collapsedCount={2} />
                        <button
                          type="button"
                          onClick={() => openEditUser(u)}
                          className="opacity-40 hover:opacity-100 hover:text-primary transition-opacity p-0.5 rounded cursor-pointer"
                          title="প্রতিষ্ঠান পরিবর্তন / এডিট করুন"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </button>
                      </div>
                    </td>
                    <td className="p-2 text-xs align-top">
                      <div className="flex items-center gap-1.5 group">
                        <FoldableList items={u.roles.length ? u.roles : ["—"]} collapsedCount={2} />
                        <button
                          type="button"
                          onClick={() => openEditUser(u)}
                          className="opacity-40 hover:opacity-100 hover:text-primary transition-opacity p-0.5 rounded cursor-pointer"
                          title="ভূমিকা (Role) পরিবর্তন / এডিট করুন"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                        </button>
                      </div>
                    </td>

                    <td className="p-2 text-xs">
                      {memberships.length === 0 ? (
                        <span className="text-muted-foreground italic">No business link</span>
                      ) : (
                        <div className="space-y-1">
                          {memberships.map((m) => {
                            const isFull = m.sections === null;
                            const count = Array.isArray(m.sections) ? expandSections(m.sections)?.length ?? 0 : null;
                            return (
                              <div key={m.business_id} className="flex items-center gap-1.5 flex-wrap">
                                {isFull ? (
                                  <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                                    Full Access
                                  </Badge>
                                ) : count === 0 ? (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Locked (0)
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                                    {count} of {ALL_SECTIONS.length} Modules
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2 mt-1"
                            onClick={() => setManageModulesUser(u)}
                          >
                            <SlidersHorizontal className="mr-1 h-3 w-3 text-primary" />
                            Manage Modules
                          </Button>
                        </div>
                      )}
                    </td>

                    <td className="p-2 text-xs text-muted-foreground">
                      {u.last_sign_in_at ? fmtDateTime(u.last_sign_in_at) : "never"}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {u.managed_password ? (
                          <>
                            <code className="rounded bg-muted px-2 py-1 text-xs">
                              {shown ? u.managed_password : "••••••••"}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setReveal((s) => ({ ...s, [u.id]: !shown }))}
                            >
                              {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard?.writeText(u.managed_password!);
                                toast.success("Copied");
                              }}
                            >
                              <Copy className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">not set here</span>
                        )}
                        <Input
                          value={draft[u.id] ?? ""}
                          onChange={(e) => setDraft((s) => ({ ...s, [u.id]: e.target.value }))}
                          placeholder="new password"
                          className="h-8 w-36 text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={setPass.isPending}
                          onClick={() => {
                            const pass = (draft[u.id] ?? "").trim() || randomPassword();
                            setDraft((s) => ({ ...s, [u.id]: pass }));
                            setPass.mutate({ user_id: u.id, password: pass });
                          }}
                        >
                          <KeyRound className="mr-1 size-3.5" />
                          Set
                        </Button>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditUser(u)}
                          className="h-8 px-2 text-xs font-bold border-primary/40 text-primary hover:bg-primary/10 cursor-pointer gap-1 shadow-2xs"
                          title="এই ব্যবহারকারীর সকল তথ্য (ইমেইল, নাম, প্রতিষ্ঠান, রোল) এডিট করুন"
                        >
                          <Pencil className="size-3.5" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant={u.disabled ? "outline" : "secondary"}
                          className={u.disabled ? "text-green-700" : "text-amber-700"}
                          disabled={isMe || disableUser.isPending}
                          onClick={() => setConfirmDisable({ id: u.id, disabled: !u.disabled })}
                        >
                          <Ban className="mr-1 size-3.5" />
                          {u.disabled ? "Enable" : "Disable"}
                        </Button>
                        <AlertDialog open={confirmDelete === u.id} onOpenChange={(open) => !open && setConfirmDelete(null)}>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isMe || deleteUser.isPending}
                              onClick={() => setConfirmDelete(u.id)}
                            >
                              <Trash2 className="mr-1 size-3.5" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="size-5 text-destructive" />
                                Delete account?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove <strong>{u.email}</strong> and all their roles,
                                business links and memberships. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setConfirmDelete(null)}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteUser.mutate({ user_id: u.id })}
                                disabled={deleteUser.isPending}
                              >
                                {deleteUser.isPending ? "Deleting…" : "Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-sm text-muted-foreground">
                    No user matches “{search}”.
                  </td>
                </tr>
              )}
            </tbody>
          </FoldTable>
          <AlertDialog
            open={!!confirmDisable}
            onOpenChange={(open) => !open && setConfirmDisable(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirmDisable?.disabled ? "Disable account?" : "Enable account?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmDisable?.disabled
                    ? "The user will be banned from signing in and their business memberships will be marked inactive."
                    : "The user will be allowed to sign in again and their business memberships will be reactivated."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmDisable(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    confirmDisable &&
                    disableUser.mutate({ user_id: confirmDisable.id, disabled: confirmDisable.disabled })
                  }
                  disabled={disableUser.isPending}
                >
                  {disableUser.isPending ? "Saving…" : confirmDisable?.disabled ? "Disable" : "Enable"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Edit User Dialog (Email, Username, Name, Phone, Business, Role) */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Pencil className="size-5 text-primary" />
              ব্যবহারকারীর তথ্য এডিট করুন (User Details)
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateUserMutation.mutate();
            }}
            className="space-y-4 py-2"
          >
            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                ইমেইল (Email) <span className="text-destructive">*</span>
              </label>
              <Input
                type="email"
                required
                value={userFormData.email}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="user@example.com"
                className="h-9 text-sm"
              />
            </div>

            {/* Username */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                ইউজারনেম (Username)
              </label>
              <Input
                type="text"
                value={userFormData.username}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="username"
                className="h-9 text-sm"
              />
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                নাম (Full Name / Doctor Name)
              </label>
              <Input
                type="text"
                value={userFormData.name}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="পূর্ণ নাম"
                className="h-9 text-sm"
              />
            </div>

            {/* Doctor Degrees */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                শিক্ষাগত যোগ্যতা / ডিগ্রি (Degrees / Qualification)
              </label>
              <Input
                type="text"
                value={userFormData.doctor_degree}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, doctor_degree: e.target.value }))}
                placeholder="e.g. MBBS, FCPS, MD, BCS (Health)"
                className="h-9 text-sm"
              />
            </div>

            {/* Doctor Designation */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                পদবি ও বিশেষজ্ঞ বিবরণ (Doctor Designation / Specialty)
              </label>
              <Input
                type="text"
                value={userFormData.doctor_designation}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, doctor_designation: e.target.value }))}
                placeholder="e.g. সহকারী অধ্যাপক / কনসালট্যান্ট, মেডিসিন বিশেষজ্ঞ"
                className="h-9 text-sm"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                ফোন নম্বর (Phone)
              </label>
              <Input
                type="tel"
                value={userFormData.phone}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="01XXXXXXXXX"
                className="h-9 text-sm"
              />
            </div>

            {/* Business Assignment */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                প্রতিষ্ঠান (Business / Organization)
              </label>
              <select
                value={userFormData.business_id}
                onChange={(e) => setUserFormData((prev) => ({ ...prev, business_id: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- কোনো প্রতিষ্ঠান নেই (None) --</option>
                {allBusinesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Role */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                রোল / পদবি (Role)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={
                    ["Admin", "Manager", "Salesman", "Cashier", "Doctor", "Staff"].includes(userFormData.role)
                      ? userFormData.role
                      : "Custom"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== "Custom") {
                      setUserFormData((prev) => ({ ...prev, role: val }));
                    }
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Salesman">Salesman</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Doctor">Doctor</option>
                  <option value="Staff">Staff</option>
                  <option value="Custom">Custom Role (নিজে লিখুন)</option>
                </select>
                <Input
                  type="text"
                  value={userFormData.role}
                  onChange={(e) => setUserFormData((prev) => ({ ...prev, role: e.target.value }))}
                  placeholder="রোল লিখুন (e.g. Admin)"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(null)}
                disabled={updateUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateUserMutation.isPending}
                className="gap-1.5 font-semibold"
              >
                {updateUserMutation.isPending ? (
                  "সংরক্ষণ হচ্ছে..."
                ) : (
                  <>
                    <Save className="size-4" />
                    সংরক্ষণ করুন (Save Changes)
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {manageModulesUser && (
        <UserModulesModal
          user={manageModulesUser}
          onClose={() => setManageModulesUser(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["super-admin-users"] })}
        />
      )}
    </div>
  );
}

function UserModulesModal({
  user,
  onClose,
  onSaved,
}: {
  user: SuperAdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const saveMember = useServerFn(setMemberSections);
  const memberships = user.business_memberships ?? [];
  const [selectedBizId, setSelectedBizId] = useState<string>(
    memberships[0]?.business_id ?? "",
  );

  const activeMembership = useMemo(
    () => memberships.find((m) => m.business_id === selectedBizId) ?? memberships[0],
    [memberships, selectedBizId],
  );

  const isFullInitial = activeMembership?.sections === null;
  const [picked, setPicked] = useState<string[]>(
    isFullInitial ? ALL_SECTIONS.map((s) => s.key) : (expandSections(activeMembership?.sections) ?? []),
  );

  useEffect(() => {
    if (activeMembership) {
      if (activeMembership.sections === null) {
        setPicked(ALL_SECTIONS.map((s) => s.key));
      } else {
        setPicked(expandSections(activeMembership.sections) ?? []);
      }
    }
  }, [activeMembership]);

  const saveMut = useMutation({
    mutationFn: (sections: string[] | null) =>
      saveMember({
        data: {
          business_id: activeMembership.business_id,
          user_id: user.id,
          sections,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowed-sections"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["current-role"] });
      toast.success("Permissions strictly saved for this user");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save modules"),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            Manage Modules &amp; Access — {user.name || user.email}
          </DialogTitle>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 pt-1">
            <span>Email: <span className="font-mono text-foreground">{user.email}</span></span>
            {memberships.length > 1 ? (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="font-medium text-foreground">Select Business:</span>
                <select
                  value={selectedBizId}
                  onChange={(e) => setSelectedBizId(e.target.value)}
                  className="rounded border border-input bg-background px-2 py-1 text-xs"
                >
                  {memberships.map((m) => (
                    <option key={m.business_id} value={m.business_id}>
                      {m.business_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : activeMembership ? (
              <span className="ml-auto font-medium text-foreground">
                Business: <Badge variant="outline">{activeMembership.business_name}</Badge>
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Presets Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-2.5 border border-border/50">
            <span className="text-xs font-semibold text-foreground">
              {picked.length} of {ALL_SECTIONS.length} modules selected
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2"
                onClick={() => setPicked(ALL_SECTIONS.map((s) => s.key))}
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2"
                onClick={() => setPicked([])}
              >
                Clear All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2"
                onClick={() => setPicked(PRESETS.POS_STANDARD)}
              >
                POS Standard
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2"
                onClick={() => setPicked(PRESETS.DOCTOR_CLINIC)}
              >
                Doctor / Clinic
              </Button>
            </div>
          </div>

          {/* 32 Module Checkboxes */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 rounded-lg border border-border/70 p-3 bg-card">
            {ALL_SECTIONS.map((s) => (
              <label
                key={s.key}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs cursor-pointer select-none transition-colors ${
                  picked.includes(s.key)
                    ? "bg-primary/10 font-medium text-foreground"
                    : "hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-input text-primary focus:ring-1 focus:ring-primary"
                  checked={picked.includes(s.key)}
                  onChange={(e) =>
                    setPicked((prev) =>
                      e.target.checked
                        ? Array.from(new Set([...prev, s.key]))
                        : prev.filter((k) => k !== s.key),
                    )
                  }
                />
                <span className="truncate">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs text-green-700 dark:text-green-400 hover:bg-green-500/10"
              disabled={saveMut.isPending}
              onClick={() => {
                setPicked(ALL_SECTIONS.map((s) => s.key));
                saveMut.mutate(null);
              }}
            >
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Full Access (All)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs text-destructive hover:bg-destructive/10"
              disabled={saveMut.isPending}
              onClick={() => {
                setPicked([]);
                saveMut.mutate([]);
              }}
            >
              Lock (0 modules)
            </Button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saveMut.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs font-semibold"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate(picked)}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save Marked Modules ({picked.length})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
