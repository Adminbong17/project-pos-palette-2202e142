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
            const businessId = "c82c76de-9574-4dbb-bb08-775794244650";

            // ACTION: sync_brands
            if (body.action === "sync_brands") {
              const { brands } = body;
              const { data: existingBrands, error: bErr } = await (supabaseAdmin as any)
                .from("brands")
                .select("id, name")
                .eq("business_id", businessId);
              if (bErr) throw bErr;

              const brandMap: Record<string, string> = {};
              for (const b of existingBrands ?? []) {
                if (b.name) brandMap[b.name.trim().toLowerCase()] = b.id;
              }

              const toInsert: any[] = [];
              for (const bName of brands ?? []) {
                if (!bName) continue;
                const k = bName.trim().toLowerCase();
                if (!brandMap[k]) {
                  toInsert.push({
                    business_id: businessId,
                    name: bName.trim(),
                    use_for_repair: false,
                  });
                  brandMap[k] = "PENDING";
                }
              }

              if (toInsert.length > 0) {
                const { data: newlyInserted, error: insErr } = await (supabaseAdmin as any)
                  .from("brands")
                  .insert(toInsert)
                  .select("id, name");
                if (insErr) throw insErr;
                for (const b of newlyInserted ?? []) {
                  brandMap[b.name.trim().toLowerCase()] = b.id;
                }
              }

              return Response.json({ ok: true, brandMap, totalBrands: Object.keys(brandMap).length });
            }

            // ACTION: batch_insert
            if (body.action === "batch_insert") {
              const { items } = body;
              if (!Array.isArray(items) || items.length === 0) {
                return Response.json({ ok: false, error: "items array required" }, { status: 400 });
              }

              const productRows = items.map((it: any) => ({
                business_id: businessId,
                name: it.name,
                sku: it.sku,
                type: "single",
                brand_id: it.brand_id || null,
                alert_quantity: 10,
                enable_stock: true,
                not_for_selling: false,
                is_inactive: false,
                barcode_type: "C128",
                tax_type: "exclusive",
                default_purchase_price: it.default_purchase_price,
                default_sell_price: it.default_sell_price,
                mrp: it.mrp,
              }));

              const { data: insertedProducts, error: pErr } = await (supabaseAdmin as any)
                .from("products")
                .insert(productRows)
                .select("id, sku");

              if (pErr) {
                return Response.json({ ok: false, error: pErr.message }, { status: 500 });
              }

              const pMap = new Map((insertedProducts as any[]).map((p: any) => [p.sku, p.id]));
              const variationRows = items.map((it: any) => {
                const pid = pMap.get(it.sku);
                const pp = Number(it.default_purchase_price) || 0;
                const sp = Number(it.default_sell_price) || 0;
                const profit = pp > 0 ? Number((((sp - pp) / pp) * 100).toFixed(2)) : 0;
                return {
                  product_id: pid,
                  name: "DUMMY",
                  sub_sku: it.sku,
                  default_purchase_price: pp,
                  dpp_inc_tax: pp,
                  default_sell_price: sp,
                  sell_price_inc_tax: sp,
                  mrp: it.mrp,
                  pack_size: Math.max(1, Math.floor(Number(it.pack_size) || 1)),
                  profit_percent: profit,
                };
              });

              const { error: vErr } = await (supabaseAdmin as any)
                .from("variations")
                .insert(variationRows);

              if (vErr) {
                return Response.json({ ok: false, error: vErr.message }, { status: 500 });
              }

              return Response.json({
                ok: true,
                insertedProducts: insertedProducts.length,
                insertedVariations: variationRows.length,
              });
            }

            // ACTION: count
            if (body.action === "count") {
              const { count: pCount } = await (supabaseAdmin as any)
                .from("products")
                .select("id", { count: "exact", head: true })
                .eq("business_id", businessId);
              return Response.json({ ok: true, count: pCount });
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
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const businessId = "c82c76de-9574-4dbb-bb08-775794244650";

        const { count: pCount } = await (supabaseAdmin as any)
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId);

        return Response.json({ ok: true, productCount: pCount });
      },
    },
  },
});
