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
          const businessId = "c82c76de-9574-4dbb-bb08-775794244650"; // Sheikh pharma

          const allProducts: any[] = [];
          const PAGE = 1000;
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await (supabaseAdmin as any)
              .from("products")
              .select(`
                id, name, default_purchase_price, mrp,
                brand:brands(id, name),
                category:categories!products_category_id_fkey(id, name)
              `)
              .eq("business_id", businessId)
              .range(from, from + PAGE - 1);

            if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
            const batch = data ?? [];
            allProducts.push(...batch);
            if (batch.length < PAGE) break;
          }

          interface StatGroup {
            count: number;
            totalPct: number;
            minPct: number;
            maxPct: number;
            percentages: number[];
            samples: { name: string; mrp: number; purchase: number; pct_less: number }[];
          }

          const brandGroups: Record<string, StatGroup> = {};
          const catGroups: Record<string, StatGroup> = {};
          const overallPcts: number[] = [];

          const buckets: Record<string, number> = {
            "negative (purchase > mrp)": 0,
            "0% (purchase == mrp)": 0,
            "0% - 10%": 0,
            "10% - 13%": 0,
            "13% - 15%": 0,
            "15% - 17%": 0,
            "17% - 20%": 0,
            "20% - 30%": 0,
            "30%+": 0,
          };

          for (const p of allProducts) {
            const mrp = Number(p.mrp || 0);
            const purchase = Number(p.default_purchase_price || 0);
            if (mrp <= 0 || purchase <= 0) continue;

            const pctLess = ((mrp - purchase) / mrp) * 100;
            overallPcts.push(pctLess);

            // Buckets
            if (pctLess < 0) buckets["negative (purchase > mrp)"]++;
            else if (pctLess === 0) buckets["0% (purchase == mrp)"]++;
            else if (pctLess < 10) buckets["0% - 10%"]++;
            else if (pctLess < 13) buckets["10% - 13%"]++;
            else if (pctLess < 15) buckets["13% - 15%"]++;
            else if (pctLess < 17) buckets["15% - 17%"]++;
            else if (pctLess < 20) buckets["17% - 20%"]++;
            else if (pctLess < 30) buckets["20% - 30%"]++;
            else buckets["30%+"]++;

            // Brand group
            const bName = p.brand?.name?.trim() || "No Brand";
            if (!brandGroups[bName]) {
              brandGroups[bName] = { count: 0, totalPct: 0, minPct: 9999, maxPct: -9999, percentages: [], samples: [] };
            }
            const bg = brandGroups[bName];
            bg.count++;
            bg.totalPct += pctLess;
            if (pctLess < bg.minPct) bg.minPct = pctLess;
            if (pctLess > bg.maxPct) bg.maxPct = pctLess;
            bg.percentages.push(pctLess);
            if (bg.samples.length < 3) {
              bg.samples.push({ name: p.name, mrp, purchase, pct_less: Number(pctLess.toFixed(2)) });
            }

            // Category group
            const cName = p.category?.name?.trim() || "No Category";
            if (!catGroups[cName]) {
              catGroups[cName] = { count: 0, totalPct: 0, minPct: 9999, maxPct: -9999, percentages: [], samples: [] };
            }
            const cg = catGroups[cName];
            cg.count++;
            cg.totalPct += pctLess;
            if (pctLess < cg.minPct) cg.minPct = pctLess;
            if (pctLess > cg.maxPct) cg.maxPct = pctLess;
            cg.percentages.push(pctLess);
            if (cg.samples.length < 3) {
              cg.samples.push({ name: p.name, mrp, purchase, pct_less: Number(pctLess.toFixed(2)) });
            }
          }

          const formatGroupList = (groups: Record<string, StatGroup>) => {
            return Object.entries(groups)
              .map(([name, g]) => {
                const sorted = [...g.percentages].sort((a, b) => a - b);
                const median = sorted.length % 2 === 0
                  ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                  : sorted[Math.floor(sorted.length / 2)];
                return {
                  name,
                  count: g.count,
                  avg_pct_less: Number((g.totalPct / g.count).toFixed(2)),
                  median_pct_less: Number(median.toFixed(2)),
                  min_pct_less: Number(g.minPct.toFixed(2)),
                  max_pct_less: Number(g.maxPct.toFixed(2)),
                  samples: g.samples,
                };
              })
              .sort((a, b) => b.count - a.count);
          };

          const brandStats = formatGroupList(brandGroups);
          const categoryStats = formatGroupList(catGroups);

          overallPcts.sort((a, b) => a - b);
          const overallMedian = overallPcts.length % 2 === 0
            ? (overallPcts[overallPcts.length / 2 - 1] + overallPcts[overallPcts.length / 2]) / 2
            : overallPcts[Math.floor(overallPcts.length / 2)];
          const overallMean = overallPcts.reduce((a, b) => a + b, 0) / (overallPcts.length || 1);

          return Response.json({
            ok: true,
            totalProductsAnalyzed: overallPcts.length,
            overallAverageDiscountPct: Number(overallMean.toFixed(2)),
            overallMedianDiscountPct: Number(overallMedian.toFixed(2)),
            distributionBuckets: buckets,
            brandCount: brandStats.length,
            topBrands: brandStats.slice(0, 50),
            categoryCount: categoryStats.length,
            topCategories: categoryStats.slice(0, 30),
          });
        } catch (err: any) {
          return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
        }
      },
    },
  },
});
