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
  pendingDoctorsItems: Array<{
    id: string;
    user_id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    qualification: string | null;
    requested_role: string;
    created_at: string;
  }>;
  pendingBusinessItems: Array<{
    id: string;
    user_id: string;
    name: string;
    location_name: string;
    created_at: string;
  }>;
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

    const todayStr = new Date().toISOString().slice(0, 10);

    // Run all dashboard metric queries in parallel for ultra-fast loading (<200ms)
    const [
      { data: bizList },
      { count: usersCount },
      { count: rxCount },
      { count: rxTodayCount },
      { count: labCount },
      { data: creditOrders },
      { data: pendingDoctorsList, count: pendingDoctors },
      { data: pendingBizList, count: pendingBiz },
      { data: bkashRow },
      { data: smsRow },
      { data: backupRuns, count: totalBackups },
    ] = await Promise.all([
      supabaseAdmin.from("businesses").select("id, kind"),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("prescriptions").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("prescriptions").select("id", { count: "exact", head: true }).gte("created_at", todayStr),
      supabaseAdmin.from("lab_reports").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("rx_credit_orders").select("amount, credits, status"),
      supabaseAdmin
        .from("access_requests")
        .select("id, user_id, email, full_name, phone, qualification, requested_role, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("business_requests")
        .select("id, user_id, name, location_name, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("bkash_settings").select("*").limit(1).maybeSingle(),
      supabaseAdmin.from("sms_settings").select("*").limit(1).maybeSingle(),
      supabaseAdmin.from("backup_runs").select("id, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(1),
    ]);

    const bizTypes = { pos: 0, clinic: 0, doctor: 0 };
    (bizList ?? []).forEach((b: any) => {
      const k = String(b.kind || "pos").toLowerCase();
      if (k === "clinic") bizTypes.clinic++;
      else if (k === "doctor") bizTypes.doctor++;
      else bizTypes.pos++;
    });

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
      pendingDoctorsItems: (pendingDoctorsList ?? []) as any[],
      pendingBusinessItems: (pendingBizList ?? []) as any[],
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
