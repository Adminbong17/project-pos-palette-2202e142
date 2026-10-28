export const SUPER_ADMIN_EMAILS = [
  "admin@bongbangla.top",
  "mehedi2001mzs17@gmail.com",
];

export const SUPER_ADMIN_EMAIL = "admin@bongbangla.top";

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export async function checkIsSuperAdmin(context: any): Promise<boolean> {
  const userEmail = String((context?.claims as any)?.email ?? "").toLowerCase();
  if (isSuperAdminEmail(userEmail)) return true;

  if (context?.supabase && context?.userId) {
    try {
      const { data } = await context.supabase.rpc("is_super_admin", {
        _user_id: context.userId,
      });
      if (data) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export async function assertSuperAdmin(context: any): Promise<void> {
  let email = String((context?.claims as any)?.email ?? "").toLowerCase();
  if (!email && context?.supabase?.auth) {
    const { data } = await context.supabase.auth.getUser();
    email = String(data?.user?.email ?? "").toLowerCase();
  }
  if (isSuperAdminEmail(email)) return;

  if (context?.supabase && context?.userId) {
    try {
      const { data } = await context.supabase.rpc("is_super_admin", {
        _user_id: context.userId,
      });
      if (data) return;
    } catch {
      // ignore
    }
  }

  throw new Error("Only the super admin can perform this operation");
}
