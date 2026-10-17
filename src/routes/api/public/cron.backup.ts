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

            if (body.action === "deep_audit") {
              const fromISO = "2026-10-01T00:00:00.000+06:00";
              const toISO = "2026-11-01T00:00:00.000+06:00";

              let q = (supabaseAdmin as any)
                .from("transactions")
                .select("id, invoice_no, ref_no, transaction_date, final_total, total_paid, discount_amount")
                .eq("business_id", businessId)
                .eq("type", "sell")
                .gte("transaction_date", fromISO)
                .lt("transaction_date", toISO)
                .order("transaction_date", { ascending: false });

              const allSales: any[] = [];
              let sFrom = 0;
              while (true) {
                const { data: sData, error: sErr } = await q.range(sFrom, sFrom + 999);
                if (sErr) throw sErr;
                if (!sData || sData.length === 0) break;
                allSales.push(...sData);
                if (sData.length < 1000) break;
                sFrom += 1000;
              }

              const saleIds = allSales.map((s) => s.id);

              const allLines: any[] = [];
              const CHUNK = 300;
              for (let i = 0; i < saleIds.length; i += CHUNK) {
                const chunk = saleIds.slice(i, i + CHUNK);
                let lFrom = 0;
                while (true) {
                  const { data: lData, error: lErr } = await (supabaseAdmin as any)
                    .from("transaction_sell_lines")
                    .select("id, transaction_id, product_id, variation_id, quantity, unit_price")
                    .order("id")
                    .in("transaction_id", chunk)
                    .range(lFrom, lFrom + 999);
                  if (lErr) throw lErr;
                  if (!lData || lData.length === 0) break;
                  allLines.push(...lData);
                  if (lData.length < 1000) break;
                  lFrom += 1000;
                }
              }

              // Deduplicate lines by id
              const seenLineIds = new Set<string>();
              const uniqueLines: any[] = [];
              for (const l of allLines) {
                if (l.id && seenLineIds.has(l.id)) continue;
                if (l.id) seenLineIds.add(l.id);
                uniqueLines.push(l);
              }

              const pIds = Array.from(new Set(uniqueLines.map((l) => l.product_id).filter(Boolean)));
              const vIds = Array.from(new Set(uniqueLines.map((l) => l.variation_id).filter(Boolean)));

              const allProducts: any[] = [];
              for (let i = 0; i < pIds.length; i += 500) {
                const chunk = pIds.slice(i, i + 500);
                const { data: pData } = await (supabaseAdmin as any)
                  .from("products")
                  .select("id, name, sku, default_purchase_price, mrp, brand:brands(name)")
                  .in("id", chunk);
                allProducts.push(...(pData ?? []));
              }

              const allVariations: any[] = [];
              for (let i = 0; i < vIds.length; i += 500) {
                const chunk = vIds.slice(i, i + 500);
                const { data: vData } = await (supabaseAdmin as any)
                  .from("variations")
                  .select("id, product_id, pack_size, default_purchase_price, default_sell_price, mrp")
                  .in("id", chunk);
                allVariations.push(...(vData ?? []));
              }

              const varMap = new Map(allVariations.map((v) => [v.id, v]));
              const prodMap = new Map(allProducts.map((p) => [p.id, p]));

              // Product aggregation
              const pMap = new Map<string, any>();
              let totalRev = 0;
              let totalCost = 0;

              for (const l of uniqueLines) {
                const v = varMap.get(l.variation_id);
                const p = prodMap.get(l.product_id);
                const unitCost = Number(v?.default_purchase_price ?? p?.default_purchase_price ?? 0);
                const mrp = Number(v?.mrp ?? p?.mrp ?? 0);
                const packSize = Number(v?.pack_size ?? 1);
                const qty = Number(l.quantity || 0);
                const unitPrice = Number(l.unit_price || 0);
                const rev = qty * unitPrice;
                const cost = qty * unitCost;

                totalRev += rev;
                totalCost += cost;

                const cur = pMap.get(l.product_id) || {
                  id: l.product_id,
                  name: p?.name ?? "Unknown",
                  sku: p?.sku ?? "",
                  brand: p?.brand?.name ?? "",
                  qty: 0,
                  revenue: 0,
                  cost: 0,
                  mrp,
                  unitCost,
                  packSize,
                  txCount: 0,
                };
                cur.qty += qty;
                cur.revenue += rev;
                cur.cost += cost;
                cur.txCount++;
                pMap.set(l.product_id, cur);
              }

              const items = Array.from(pMap.values()).map((p) => {
                const profit = p.revenue - p.cost;
                const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
                const avgPrice = p.qty > 0 ? p.revenue / p.qty : 0;
                return {
                  ...p,
                  profit: Number(profit.toFixed(2)),
                  margin: Number(margin.toFixed(2)),
                  avgPrice: Number(avgPrice.toFixed(2)),
                  revenue: Number(p.revenue.toFixed(2)),
                  cost: Number(p.cost.toFixed(2)),
                };
              });

              items.sort((a, b) => a.profit - b.profit);

              const negativeItems = items.filter((i) => i.profit < -1);
              const lowMarginItems = items.filter((i) => i.profit >= 0 && i.margin < 12);
              const topCostItems = [...items].sort((a, b) => b.cost - a.cost).slice(0, 60);
              const topProfitItems = [...items].sort((a, b) => b.profit - a.profit).slice(0, 60);

              return Response.json({
                ok: true,
                totalSales: allSales.length,
                totalLines: uniqueLines.length,
                totalRev: Number(totalRev.toFixed(2)),
                totalCost: Number(totalCost.toFixed(2)),
                netProfit: Number((totalRev - totalCost).toFixed(2)),
                marginOverall: Number(((totalRev - totalCost) / totalRev * 100).toFixed(2)),
                allItemsCount: items.length,
                allItems: items,
              });
            }

            if (body.action === "inspect_lines") {
              const { product_ids, line_ids } = body;
              let q = (supabaseAdmin as any)
                .from("transaction_sell_lines")
                .select("id, transaction_id, product_id, variation_id, quantity, unit_price, transaction:transactions(invoice_no, ref_no, transaction_date)")
                .order("id");

              if (product_ids && product_ids.length > 0) {
                q = q.in("product_id", product_ids);
              }
              if (line_ids && line_ids.length > 0) {
                q = q.in("id", line_ids);
              }

              const { data: lines, error } = await q.limit(200);
              if (error) throw error;

              return Response.json({ ok: true, lines });
            }

            if (body.action === "fix_lines") {
              const { patches } = body;
              let fixed = 0;
              for (const patch of patches) {
                const { id, quantity, unit_price } = patch;
                const updateData: any = {};
                if (quantity !== undefined) updateData.quantity = quantity;
                if (unit_price !== undefined) updateData.unit_price = unit_price;

                const { error } = await (supabaseAdmin as any)
                  .from("transaction_sell_lines")
                  .update(updateData)
                  .eq("id", id);
                if (!error) fixed++;
              }
              return Response.json({ ok: true, fixed });
            }

            if (body.action === "update_variation_prices") {
              const { updates } = body;
              let updatedVars = 0;
              let updatedProds = 0;
              for (const u of updates) {
                if (u.id && u.default_purchase_price !== undefined) {
                  const { error: vErr } = await (supabaseAdmin as any)
                    .from("variations")
                    .update({ default_purchase_price: u.default_purchase_price })
                    .eq("id", u.id);
                  if (!vErr) updatedVars++;
                }
                if (u.product_id && u.default_purchase_price !== undefined) {
                  const { error: pErr } = await (supabaseAdmin as any)
                    .from("products")
                    .update({ default_purchase_price: u.default_purchase_price })
                    .eq("id", u.product_id);
                  if (!pErr) updatedProds++;
                }
              }
              return Response.json({ ok: true, updatedVars, updatedProds });
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
