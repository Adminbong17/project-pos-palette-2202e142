import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/super-admin-auth";
import { z } from "zod";

export type AdminAccessRequest = {
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

export type AdminBusinessRequest = {
  id: string;
  user_id: string;
  user_email: string | null;
  name: string;
  currency_id: number;
  sku_prefix: string | null;
  location_name: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

/** List all access requests & business requests using service_role to bypass RLS. */
export const listAllRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ accessRequests: AdminAccessRequest[]; businessRequests: AdminBusinessRequest[] }> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: accessList }, { data: bizList }] = await Promise.all([
      supabaseAdmin
        .from("access_requests")
        .select("id, user_id, email, full_name, phone, qualification, requested_role, status, created_at, admin_notes")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("business_requests")
        .select("id, user_id, name, currency_id, sku_prefix, location_name, status, admin_notes, created_at, reviewed_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    // Gather emails for business request user_ids
    const userIds = Array.from(new Set((bizList ?? []).map((b) => b.user_id).filter(Boolean)));
    const emailByUserId = new Map<string, string>();
    if (userIds.length > 0) {
      try {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
        (profiles ?? []).forEach((p: any) => {
          if (p.email) emailByUserId.set(p.id, p.email);
        });
      } catch {
        // ignore
      }
    }

    const businessRequests: AdminBusinessRequest[] = (bizList ?? []).map((b: any) => ({
      id: b.id,
      user_id: b.user_id,
      user_email: emailByUserId.get(b.user_id) ?? null,
      name: b.name,
      currency_id: Number(b.currency_id || 1),
      sku_prefix: b.sku_prefix,
      location_name: b.location_name || "Main Location",
      status: b.status,
      admin_notes: b.admin_notes,
      created_at: b.created_at,
      reviewed_at: b.reviewed_at,
    }));

    return {
      accessRequests: (accessList ?? []) as AdminAccessRequest[],
      businessRequests,
    };
  });

/** Approve a doctor / user access request */
export const approveAccessRequestServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string(),
        role: z.string().default("Doctor"),
        sections: z.array(z.string()).nullable().optional(),
        businessId: z.string().optional(),
        mode: z.enum(["existing", "own", "clinic"]).default("existing"),
        businessName: z.string().optional(),
        clinicType: z.enum(["general", "dental"]).default("general"),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch the access request
    const { data: req, error: reqErr } = await supabaseAdmin
      .from("access_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (reqErr || !req) throw new Error("Request not found");

    let targetBizId = data.businessId;

    if (data.mode === "clinic") {
      // Create new clinic business
      const bizName = data.businessName || `${req.full_name || req.email}'s Clinic`;
      const { data: newBiz, error: bErr } = await supabaseAdmin
        .from("businesses")
        .insert({
          name: bizName,
          currency_id: 1,
          owner_id: req.user_id,
          clinic_mode: true,
          clinic_type: data.clinicType,
          biz_kind: "clinic",
        } as any)
        .select("id")
        .single();
      if (bErr) throw bErr;
      targetBizId = newBiz.id;

      await supabaseAdmin.from("business_locations").insert({
        business_id: targetBizId,
        name: "Main Chamber",
        location_id: "CH0001",
      });
    } else if (data.mode === "own") {
      // Create separate POS business
      const bizName = data.businessName || `${req.full_name || req.email}'s Shop`;
      const { data: newBiz, error: bErr } = await supabaseAdmin
        .from("businesses")
        .insert({
          name: bizName,
          currency_id: 1,
          owner_id: req.user_id,
          biz_kind: "pos",
        } as any)
        .select("id")
        .single();
      if (bErr) throw bErr;
      targetBizId = newBiz.id;

      await supabaseAdmin.from("business_locations").insert({
        business_id: targetBizId,
        name: "Main Store",
        location_id: "ST0001",
      });
    } else if (!targetBizId) {
      // Default to first business (e.g. Sheikh Pharma)
      const { data: firstBiz } = await supabaseAdmin.from("businesses").select("id").limit(1).maybeSingle();
      targetBizId = firstBiz?.id;
    }

    if (targetBizId && req.user_id) {
      // Add to business_users
      const { data: existingBu } = await supabaseAdmin
        .from("business_users")
        .select("id")
        .eq("business_id", targetBizId)
        .eq("user_id", req.user_id)
        .maybeSingle();

      if (!existingBu) {
        await supabaseAdmin.from("business_users").insert({
          business_id: targetBizId,
          user_id: req.user_id,
          is_active: true,
        });
      }

      // Find or create role
      const roleName = data.mode === "clinic" ? "Clinic Admin" : data.role || "Doctor";
      let roleId: string | null = null;
      const { data: existingRole } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("business_id", targetBizId)
        .eq("name", roleName)
        .maybeSingle();

      if (existingRole) {
        roleId = existingRole.id;
      } else {
        const { data: newRole } = await supabaseAdmin
          .from("roles")
          .insert({
            business_id: targetBizId,
            name: roleName,
          })
          .select("id")
          .single();
        roleId = newRole?.id ?? null;
      }

      // Upsert user_roles
      const { data: existingUr } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("business_id", targetBizId)
        .eq("user_id", req.user_id)
        .maybeSingle();

      if (existingUr) {
        await supabaseAdmin
          .from("user_roles")
          .update({
            role_id: roleId,
            allowed_sections: data.sections ?? null,
          })
          .eq("id", existingUr.id);
      } else {
        await supabaseAdmin.from("user_roles").insert({
          business_id: targetBizId,
          user_id: req.user_id,
          role_id: roleId,
          allowed_sections: data.sections ?? null,
        });
      }
    }

    // Mark access request approved
    await supabaseAdmin
      .from("access_requests")
      .update({
        status: "approved",
        business_id: targetBizId || null,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", data.id);

    return { success: true, businessId: targetBizId };
  });

/** Reject an access request */
export const rejectAccessRequestServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string(),
        notes: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("access_requests")
      .update({
        status: "rejected",
        admin_notes: data.notes || "Rejected by Super Admin",
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", data.id);

    return { success: true };
  });

/** Approve a business request */
export const approveBusinessRequestServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string(),
        notes: z.string().optional(),
        sections: z.array(z.string()).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("business_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (reqErr || !req) throw new Error("Business request not found");

    // 1. Create business
    const { data: newBiz, error: bErr } = await supabaseAdmin
      .from("businesses")
      .insert({
        name: req.name,
        currency_id: req.currency_id,
        sku_prefix: req.sku_prefix,
        owner_id: req.user_id,
        biz_kind: "pos",
      } as any)
      .select("id")
      .single();
    if (bErr) throw bErr;

    // 2. Create location
    await supabaseAdmin.from("business_locations").insert({
      business_id: newBiz.id,
      name: req.location_name || "Main Location",
      location_id: "BL0001",
    });

    // 3. Add to business_users
    await supabaseAdmin.from("business_users").insert({
      business_id: newBiz.id,
      user_id: req.user_id,
      is_active: true,
    });

    // 4. Role & sections
    const { data: adminRole } = await supabaseAdmin
      .from("roles")
      .insert({
        business_id: newBiz.id,
        name: "Admin",
      })
      .select("id")
      .single();

    await supabaseAdmin.from("user_roles").insert({
      business_id: newBiz.id,
      user_id: req.user_id,
      role_id: adminRole?.id ?? null,
      allowed_sections: data.sections && data.sections.length ? data.sections : null,
    });

    // 5. Update request status
    await supabaseAdmin
      .from("business_requests")
      .update({
        status: "approved",
        admin_notes: data.notes || null,
        business_id: newBiz.id,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", data.id);

    return { success: true, businessId: newBiz.id };
  });

/** Reject a business request */
export const rejectBusinessRequestServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string(),
        notes: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("business_requests")
      .update({
        status: "rejected",
        admin_notes: data.notes || "Rejected by Super Admin",
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", data.id);

    return { success: true };
  });

/** Clean or auto-resolve all pending requests (e.g. stale or orphaned requests) */
export const purgeOrResolvePendingRequestsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        action: z.enum(["approve_all", "reject_all"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const newStatus = data.action === "approve_all" ? "approved" : "rejected";
    const notes = data.action === "approve_all" ? "Auto-approved by Super Admin" : "Dismissed by Super Admin";

    await Promise.all([
      supabaseAdmin
        .from("access_requests")
        .update({ status: newStatus, admin_notes: notes, reviewed_at: new Date().toISOString() } as any)
        .eq("status", "pending"),
      supabaseAdmin
        .from("business_requests")
        .update({ status: newStatus, admin_notes: notes, reviewed_at: new Date().toISOString() } as any)
        .eq("status", "pending"),
    ]);

    return { success: true };
  });
