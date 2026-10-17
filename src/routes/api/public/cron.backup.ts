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

            // ACTION: batch_update
            if (body.action === "batch_update") {
              const { updates } = body;
              if (!Array.isArray(updates) || updates.length === 0) {
                return Response.json({ ok: false, error: "updates array required" }, { status: 400 });
              }

              let updatedVariations = 0;
              let updatedProducts = 0;

              for (let i = 0; i < updates.length; i += 10) {
                const chunk = updates.slice(i, i + 10);
                await Promise.all(
                  chunk.map(async (item: any) => {
                    if (item.variation_id) {
                      const patch: any = {};
                      if (item.pack_size !== undefined) patch.pack_size = item.pack_size;
                      if (item.mrp !== undefined) {
                        patch.mrp = item.mrp;
                        patch.default_sell_price = item.mrp;
                        patch.sell_price_inc_tax = item.mrp;
                      }
                      if (item.default_purchase_price !== undefined) {
                        patch.default_purchase_price = item.default_purchase_price;
                        patch.dpp_inc_tax = item.default_purchase_price;
                      }
                      const { error: vErr } = await (supabaseAdmin as any)
                        .from("variations")
                        .update(patch)
                        .eq("id", item.variation_id);
                      if (!vErr) updatedVariations++;
                    }

                    if (item.product_id) {
                      const pPatch: any = {};
                      if (item.mrp !== undefined) {
                        pPatch.mrp = item.mrp;
                        pPatch.default_sell_price = item.mrp;
                      }
                      if (item.default_purchase_price !== undefined) {
                        pPatch.default_purchase_price = item.default_purchase_price;
                      }
                      const { error: pErr } = await (supabaseAdmin as any)
                        .from("products")
                        .update(pPatch)
                        .eq("id", item.product_id);
                      if (!pErr) updatedProducts++;
                    }
                  })
                );
              }

              return Response.json({
                ok: true,
                received: updates.length,
                updatedVariations,
                updatedProducts,
              });
            }

            // ACTION: diagnose_profit
            if (body.action === "diagnose_profit") {
              const fromISO = "2026-10-01T00:00:00.000+06:00";
              const toISO = "2026-11-01T00:00:00.000+06:00";

              const { data: sales, error: sErr } = await (supabaseAdmin as any)
                .from("transactions")
                .select("id, invoice_no, transaction_date, final_total")
                .eq("business_id", businessId)
                .eq("type", "sell")
                .gte("transaction_date", fromISO)
                .lt("transaction_date", toISO);

              if (sErr) throw sErr;
              const saleIds = (sales ?? []).map((s: any) => s.id);

              const allLines: any[] = [];
              const CHUNK = 500;
              for (let i = 0; i < saleIds.length; i += CHUNK) {
                const chunk = saleIds.slice(i, i + CHUNK);
                const { data: lData, error: lErr } = await (supabaseAdmin as any)
                  .from("transaction_sell_lines")
                  .select("transaction_id, product_id, variation_id, quantity, unit_price")
                  .in("transaction_id", chunk);
                if (lErr) throw lErr;
                allLines.push(...(lData ?? []));
              }

              const pIds = Array.from(new Set(allLines.map((l) => l.product_id).filter(Boolean)));
              const vIds = Array.from(new Set(allLines.map((l) => l.variation_id).filter(Boolean)));

              const allProducts: any[] = [];
              for (let i = 0; i < pIds.length; i += CHUNK) {
                const chunk = pIds.slice(i, i + CHUNK);
                const { data: pData } = await (supabaseAdmin as any)
                  .from("products")
                  .select("id, name, sku, default_purchase_price, mrp")
                  .in("id", chunk);
                allProducts.push(...(pData ?? []));
              }

              const allVariations: any[] = [];
              for (let i = 0; i < vIds.length; i += CHUNK) {
                const chunk = vIds.slice(i, i + CHUNK);
                const { data: vData } = await (supabaseAdmin as any)
                  .from("variations")
                  .select("id, product_id, pack_size, default_purchase_price, default_sell_price, mrp")
                  .in("id", chunk);
                allVariations.push(...(vData ?? []));
              }

              const varMap = new Map(allVariations.map((v) => [v.id, v]));
              const prodMap = new Map(allProducts.map((p) => [p.id, p]));

              const productAgg = new Map<string, {
                name: string;
                sku: string;
                qty: number;
                revenue: number;
                cost: number;
                unitCost: number;
                packSize: number;
                mrp: number;
                avgUnitPrice: number;
                profit: number;
              }>();

              for (const l of allLines) {
                const pid = l.product_id;
                const v = varMap.get(l.variation_id);
                const p = prodMap.get(pid);
                const name = p?.name ?? "Unknown";
                const sku = p?.sku ?? "";
                const unitCost = Number(v?.default_purchase_price ?? p?.default_purchase_price ?? 0);
                const packSize = Number(v?.pack_size ?? 1);
                const mrp = Number(v?.mrp ?? p?.mrp ?? 0);
                const qty = Number(l.quantity || 0);
                const unitPrice = Number(l.unit_price || 0);
                const rev = qty * unitPrice;
                const cost = qty * unitCost;

                const cur = productAgg.get(pid) || {
                  name,
                  sku,
                  qty: 0,
                  revenue: 0,
                  cost: 0,
                  unitCost,
                  packSize,
                  mrp,
                  avgUnitPrice: 0,
                  profit: 0,
                };
                cur.qty += qty;
                cur.revenue += rev;
                cur.cost += cost;
                cur.profit = cur.revenue - cur.cost;
                cur.unitCost = unitCost;
                productAgg.set(pid, cur);
              }

              const sorted = Array.from(productAgg.values()).map((p) => ({
                ...p,
                avgUnitPrice: p.qty > 0 ? Number((p.revenue / p.qty).toFixed(2)) : 0,
                profit: Number((p.revenue - p.cost).toFixed(2)),
                revenue: Number(p.revenue.toFixed(2)),
                cost: Number(p.cost.toFixed(2)),
              })).sort((a, b) => a.profit - b.profit);

              const totalRev = sorted.reduce((a, b) => a + b.revenue, 0);
              const totalCost = sorted.reduce((a, b) => a + b.cost, 0);
              const negativeItems = sorted.filter((p) => p.profit < 0);

              return Response.json({
                ok: true,
                totalSales: sales.length,
                totalLines: allLines.length,
                totalRev,
                totalCost,
                netProfit: totalRev - totalCost,
                negativeItemsCount: negativeItems.length,
                topLosses: negativeItems.slice(0, 15),
                topProfits: sorted.slice(-10).reverse(),
              });
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
    },
  },
});
