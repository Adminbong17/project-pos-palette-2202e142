import { createFileRoute } from "@tanstack/react-router";
import { FoldableList } from "@/components/foldable-list";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listAllUsers, setUserPassword, setUserDisabled, deleteUserAccount } from "@/lib/super-admin-users.functions";
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
import { Search, KeyRound, Copy, Eye, EyeOff, Ban, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { FoldTable } from "@/components/fold-table";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "All Users & Logins — Admin" },
      { name: "description", content: "Super admin: every POS and Rx user, their email, username, role and login password." },
      { property: "og:title", content: "All Users & Logins — Admin" },
      { property: "og:description", content: "Search every user account and manage their login password." },
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

  const me = useQuery({
    queryKey: ["me-email"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const isSuper = me.data?.email?.toLowerCase() === "admin@bongbangla.top";

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

  if (me.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!isSuper)
    return <div className="p-8 text-sm text-muted-foreground">Only the super admin can access this page.</div>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">All Users & Logins</h1>
        <p className="text-sm text-muted-foreground">
          Every POS and Rx account. Existing passwords are stored encrypted by Supabase and can never be read back —
          set a new one here and it will be shown to you.
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
          <FoldTable className="w-full min-w-[1000px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Email / Username</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Business</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left">Last sign in</th>
                <th className="p-2 text-left">Password</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const shown = reveal[u.id];
                const isMe = me.data?.id === u.id;
                return (
                  <tr key={u.id} className="border-t border-border align-top">
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{u.email}</span>
                        {u.disabled && (
                          <Badge variant="destructive" className="text-[10px]">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      {u.username && <div className="text-xs text-muted-foreground">@{u.username}</div>}
                    </td>
                    <td className="p-2">
                      <div>{u.doctor_name || u.name}</div>
                      {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
                    </td>
                    <td className="p-2 text-xs align-top"><FoldableList items={u.businesses} collapsedCount={2} /></td>
                    <td className="p-2 text-xs align-top"><FoldableList items={u.roles} collapsedCount={2} /></td>

                    <td className="p-2 text-xs text-muted-foreground">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "never"}
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
                  <td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">
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
    </div>
  );
}
