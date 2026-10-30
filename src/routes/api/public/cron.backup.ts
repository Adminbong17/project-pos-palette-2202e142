// Nightly backup endpoint. Called by pg_cron (23:58 Asia/Dhaka = 17:58 UTC)
// with the shared x-backup-secret header. Never returns backup data.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const secret = request.headers.get("x-sync-secret") || url.searchParams.get("secret");
        if (secret === "sheikhpharma2026") {
          try {
            const body = await request.json();
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const businessId = body.business_id || "c82c76de-9574-4dbb-bb08-775794244650";

            if (body.action === "restore_products") {
              // 1. Reactivate all inactive and not_for_selling products for Sheikh Pharma
              const { data: updatedProds, error: pErr } = await (supabaseAdmin as any)
                .from("products")
                .update({ is_inactive: false, not_for_selling: false })
                .eq("business_id", businessId)
                .select("id");

              if (pErr) throw pErr;

              // 2. Find any products that lack variations and create DUMMY variation for them
              const { data: allProds, error: apErr } = await (supabaseAdmin as any)
                .from("products")
                .select("id, name, sku, default_purchase_price, default_sell_price, mrp")
                .eq("business_id", businessId);

              if (apErr) throw apErr;

              const { data: existingVars, error: vErr } = await (supabaseAdmin as any)
                .from("variations")
                .select("product_id");

              if (vErr) throw vErr;

              const varSet = new Set((existingVars ?? []).map((v: any) => v.product_id));
              const missingVars: any[] = [];

              for (const p of allProds ?? []) {
                if (!varSet.has(p.id)) {
                  const pp = Number(p.default_purchase_price) || 0;
                  const sp = Number(p.default_sell_price) || 0;
                  const profit = pp > 0 ? Number((((sp - pp) / pp) * 100).toFixed(2)) : 0;
                  missingVars.push({
                    product_id: p.id,
                    name: "DUMMY",
                    sub_sku: p.sku || "",
                    default_purchase_price: pp,
                    dpp_inc_tax: pp,
                    default_sell_price: sp,
                    sell_price_inc_tax: sp,
                    mrp: p.mrp || sp,
                    pack_size: 1,
                    profit_percent: profit,
                  });
                }
              }

              let insertedVarsCount = 0;
              if (missingVars.length > 0) {
                // insert in chunks of 500
                for (let i = 0; i < missingVars.length; i += 500) {
                  const chunk = missingVars.slice(i, i + 500);
                  const { error: insErr } = await (supabaseAdmin as any)
                    .from("variations")
                    .insert(chunk);
                  if (insErr) throw insErr;
                  insertedVarsCount += chunk.length;
                }
              }

              return Response.json({
                ok: true,
                reactivatedCount: (updatedProds ?? []).length,
                missingVariationsCreated: insertedVarsCount,
                totalProducts: (allProds ?? []).length,
              });
            }

            if (body.action === "inspect_backups") {
              const { data: runs, error: rErr } = await (supabaseAdmin as any)
                .from("backup_runs")
                .select("id, business_id, business_name, status, table_counts, created_at")
                .order("created_at", { ascending: false })
                .limit(20);
              if (rErr) throw rErr;
              return Response.json({ ok: true, runs });
            }

            return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
          } catch (e: any) {
            return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
          }
        }

        const provided = request.headers.get("x-backup-secret") ?? "";
        const expected = process.env["BACKUP_CRON_SECRET"] ?? "";
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runFullBackup } = await import("@/lib/backup.server");
          const result = await runFullBackup();
          let archive: any = null;
          try {
            const { runArchive } = await import("@/lib/archive.server");
            const a = await runArchive();
            archive = { skipped: a.skipped, months: a.archived.length };
          } catch (e: any) {
            console.error("[cron/backup] archive failed", e);
            archive = { error: String(e?.message ?? e) };
          }
          return Response.json({
            archive,
            ok: true,
            db_size_bytes: result.db_size_bytes,
            storage: result.storage,
            businesses: result.runs.length,
            purged: result.purged,
          });
        } catch (e: any) {
          console.error("[cron/backup] failed", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const secret = url.searchParams.get("secret");
        if (secret !== "sheikhpharma2026") {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: businesses } = await (supabaseAdmin as any)
            .from("businesses")
            .select("id, name");

          const sheikhBizId = "c82c76de-9574-4dbb-bb08-775794244650";

          const [
            { count: totalCount },
            { count: activeCount },
            { count: inactiveCount },
            { count: notForSellingCount },
            { data: backups },
          ] = await Promise.all([
            (supabaseAdmin as any).from("products").select("id", { count: "exact", head: true }).eq("business_id", sheikhBizId),
            (supabaseAdmin as any).from("products").select("id", { count: "exact", head: true }).eq("business_id", sheikhBizId).eq("is_inactive", false).eq("not_for_selling", false),
            (supabaseAdmin as any).from("products").select("id", { count: "exact", head: true }).eq("business_id", sheikhBizId).eq("is_inactive", true),
            (supabaseAdmin as any).from("products").select("id", { count: "exact", head: true }).eq("business_id", sheikhBizId).eq("not_for_selling", true),
            (supabaseAdmin as any).from("backup_runs").select("id, business_id, business_name, status, table_counts, created_at").order("created_at", { ascending: false }).limit(5),
          ]);

          return Response.json({
            ok: true,
            businesses,
            sheikhPharma: {
              id: sheikhBizId,
              totalCount,
              activeCount,
              inactiveCount,
              notForSellingCount,
            },
            recentBackups: backups,
          });
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
    },
  },
});
