// Nightly backup endpoint. Called by pg_cron (23:58 Asia/Dhaka = 17:58 UTC)
// with the shared x-backup-secret header. Never returns backup data.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // 1. Fetch businesses
          const { data: businesses, error: bizErr } = await (supabaseAdmin as any)
            .from("businesses")
            .select("id, name");

          if (bizErr) return Response.json({ ok: false, error: bizErr.message }, { status: 500 });

          // Also get product count per business
          const { data: productSummary } = await (supabaseAdmin as any)
            .from("products")
            .select("business_id, id, default_purchase_price, mrp");

          const bizMap: Record<string, { total: number; valid: number; missingPurchase: number; missingMrp: number }> = {};
          for (const p of productSummary ?? []) {
            const bid = p.business_id || "unknown";
            if (!bizMap[bid]) bizMap[bid] = { total: 0, valid: 0, missingPurchase: 0, missingMrp: 0 };
            bizMap[bid].total++;
            const hasP = Number(p.default_purchase_price || 0) > 0;
            const hasM = Number(p.mrp || 0) > 0;
            if (hasP && hasM) bizMap[bid].valid++;
            if (!hasP) bizMap[bid].missingPurchase++;
            if (!hasM) bizMap[bid].missingMrp++;
          }

          const allBizStats = (businesses ?? []).map((b: any) => ({
            id: b.id,
            name: b.name,
            stats: bizMap[b.id] ?? { total: 0, valid: 0, missingPurchase: 0, missingMrp: 0 },
          }));

          // Pick the business that has products, or matches pharma/sheikh
          const bizWithProducts = [...allBizStats].sort((a, b) => b.stats.total - a.stats.total)[0];
          const targetBiz = (bizWithProducts && bizWithProducts.stats.total > 0)
            ? businesses?.find((b: any) => b.id === bizWithProducts.id)
            : (businesses?.find((b: any) => b.name?.toLowerCase().includes("pharma")) ||
               businesses?.find((b: any) => b.name?.toLowerCase().includes("sheikh")) ||
               businesses?.[0]);

          // 2. Fetch all products (with pagination past 1000) for targetBiz
          const allProducts: any[] = [];
          const PAGE = 1000;
          if (targetBiz?.id) {
            for (let from = 0; ; from += PAGE) {
              const { data, error: pErr } = await (supabaseAdmin as any)
                .from("products")
                .select(`
                  id, name, sku, barcode, default_purchase_price, default_sell_price, mrp,
                  variations:variations!variations_product_id_fkey(
                    id, name, default_purchase_price, default_sell_price, mrp
                  )
                `)
                .eq("business_id", targetBiz.id)
                .range(from, from + PAGE - 1);

              if (pErr) return Response.json({ ok: false, error: pErr.message }, { status: 500 });
              const batch = data ?? [];
              allProducts.push(...batch);
              if (batch.length < PAGE) break;
            }
          }

          const totalProducts = allProducts.length;
          let missingPurchasePrice = 0;
          let missingMrp = 0;
          let missingBoth = 0;
          let allValid = 0;

          const missingSamples: any[] = [];

          for (const p of allProducts) {
            const pPrice = Number(p.default_purchase_price || 0);
            const pMrp = Number(p.mrp || 0);

            const vPrices = (p.variations ?? []).map((v: any) => Number(v.default_purchase_price || 0));
            const vMrps = (p.variations ?? []).map((v: any) => Number(v.mrp || 0));

            const maxVPrice = vPrices.length ? Math.max(0, ...vPrices) : 0;
            const maxVMrp = vMrps.length ? Math.max(0, ...vMrps) : 0;

            const effectivePurchasePrice = pPrice > 0 ? pPrice : maxVPrice;
            const effectiveMrp = pMrp > 0 ? pMrp : maxVMrp;

            const hasPurchase = effectivePurchasePrice > 0;
            const hasMrp = effectiveMrp > 0;

            if (!hasPurchase && !hasMrp) {
              missingBoth++;
              if (missingSamples.length < 30) {
                missingSamples.push({
                  name: p.name,
                  sku: p.sku,
                  purchase_price: effectivePurchasePrice,
                  mrp: effectiveMrp,
                  issue: "Missing both Purchase Price & MRP",
                });
              }
            } else if (!hasPurchase) {
              missingPurchasePrice++;
              if (missingSamples.length < 30) {
                missingSamples.push({
                  name: p.name,
                  sku: p.sku,
                  purchase_price: effectivePurchasePrice,
                  mrp: effectiveMrp,
                  issue: "Missing Purchase Price",
                });
              }
            } else if (!hasMrp) {
              missingMrp++;
              if (missingSamples.length < 30) {
                missingSamples.push({
                  name: p.name,
                  sku: p.sku,
                  purchase_price: effectivePurchasePrice,
                  mrp: effectiveMrp,
                  issue: "Missing MRP",
                });
              }
            } else {
              allValid++;
            }
          }

          return Response.json({
            ok: true,
            allBusinesses: allBizStats,
            targetBusiness: targetBiz,
            totalProducts,
            allValid,
            missingPurchasePrice,
            missingMrp,
            missingBoth,
            totalWithIssues: missingBoth + missingPurchasePrice + missingMrp,
            percentageComplete:
              totalProducts > 0
                ? ((allValid / totalProducts) * 100).toFixed(1) + "%"
                : "0%",
            missingSamples,
          });
        } catch (err: any) {
          return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
        }
      },
    },
  },
});
