import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/super-admin-auth";

export type SuperAdminDashboardMetrics = {
  businessesCount: number;
  businessesByType: { pos: number; clinic: number; doctor: number };
  usersCount: number;
  prescriptionsCount: number;
  prescriptionsTodayCount: number;
  labReportsCount: number;
  totalCreditsSold: number;
  totalRevenueBDT: number;
  pendingDoctorRequests: number;
  pendingBusinessRequests: number;
  bkashConfig: {
    enabled: boolean;
    environment: "live" | "sandbox";
    ratePerCredit: number;
  };
  smsConfig: {
    enabled: boolean;
    callerId: string;
    baseUrl: string;
  };
  backupInfo: {
    lastBackupTime: string | null;
    totalBackups: number;
  };
};

export const getSuperAdminMasterMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SuperAdminDashboardMetrics> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Auto-ensure user mehedi2001mzs17@gmail.com exists with the given credentials
    try {
      const targetEmail = "mehedi2001mzs17@gmail.com";
      const targetPass = "Aktmtbar@1";
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
      const existing = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === targetEmail
      );
      if (!existing) {
        await supabaseAdmin.auth.admin.createUser({
          email: targetEmail,
          password: targetPass,
          email_confirm: true,
          user_metadata: {
            first_name: "Mehedi",
            last_name: "Super Admin",
            managed_password: targetPass,
            is_super_admin: true,
          },
        });
      } else if (existing.user_metadata?.managed_password !== targetPass) {
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: targetPass,
          email_confirm: true,
          user_metadata: {
            ...(existing.user_metadata ?? {}),
            managed_password: targetPass,
            is_super_admin: true,
          },
        });
      }
    } catch (e) {
      console.warn("Auto-provisioning super admin error:", e);
    }

    // 1. Businesses
    const { data: bizList } = await supabaseAdmin
      .from("businesses")
      .select("id, kind");
    const bizTypes = { pos: 0, clinic: 0, doctor: 0 };
    (bizList ?? []).forEach((b: any) => {
      const k = String(b.kind || "pos").toLowerCase();
      if (k === "clinic") bizTypes.clinic++;
      else if (k === "doctor") bizTypes.doctor++;
      else bizTypes.pos++;
    });

    // 2. Users count
    const { count: usersCount } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });

    // 3. Prescriptions
    const { count: rxCount } = await supabaseAdmin
      .from("prescriptions")
      .select("id", { count: "exact", head: true });
    const todayStr = new Date().toISOString().slice(0, 10);
    const { count: rxTodayCount } = await supabaseAdmin
      .from("prescriptions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStr);

    // 4. Lab reports
    const { count: labCount } = await supabaseAdmin
      .from("lab_reports")
      .select("id", { count: "exact", head: true });

    // 5. Credit Purchases (Orders)
    const { data: creditOrders } = await supabaseAdmin
      .from("rx_credit_orders")
      .select("amount, credits, status");
    let totalCredits = 0;
    let totalBDT = 0;
    (creditOrders ?? []).forEach((o: any) => {
      if (
        o.status === "paid" ||
        o.status === "completed" ||
        o.status === "approved"
      ) {
        totalCredits += Number(o.credits || 0);
        totalBDT += Number(o.amount || 0);
      }
    });

    // 6. Pending requests
    const { count: pendingDoctors } = await supabaseAdmin
      .from("access_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: pendingBiz } = await supabaseAdmin
      .from("business_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    // 7. bKash settings
    const { data: bkashRow } = await supabaseAdmin
      .from("bkash_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    // 8. SMS settings
    const { data: smsRow } = await supabaseAdmin
      .from("sms_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    // 9. Backups
    const { data: backupRuns, count: totalBackups } = await supabaseAdmin
      .from("backup_runs")
      .select("id, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(1);

    return {
      businessesCount: (bizList ?? []).length,
      businessesByType: bizTypes,
      usersCount: usersCount ?? 0,
      prescriptionsCount: rxCount ?? 0,
      prescriptionsTodayCount: rxTodayCount ?? 0,
      labReportsCount: labCount ?? 0,
      totalCreditsSold: totalCredits,
      totalRevenueBDT: totalBDT,
      pendingDoctorRequests: pendingDoctors ?? 0,
      pendingBusinessRequests: pendingBiz ?? 0,
      bkashConfig: {
        enabled: !!bkashRow?.enabled,
        environment: (bkashRow?.environment as "live" | "sandbox") || "live",
        ratePerCredit: Number(bkashRow?.rate_per_credit || 3),
      },
      smsConfig: {
        enabled: smsRow?.enabled ?? false,
        callerId: smsRow?.caller_id || "None set",
        baseUrl: smsRow?.base_url || "",
      },
      backupInfo: {
        lastBackupTime: backupRuns?.[0]?.created_at || null,
        totalBackups: totalBackups ?? 0,
      },
    };
  });
