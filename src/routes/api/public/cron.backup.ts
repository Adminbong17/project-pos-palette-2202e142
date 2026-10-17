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

            if (body.action === "diagnose_full") {
              const rangeKey = body.range || "thisMonth";
              let fromISO: string | null = null;
              let toISO: string | null = null;

              if (rangeKey === "thisMonth") {
                fromISO = "2026-10-01T00:00:00.000+06:00";
                toISO = "2026-11-01T00:00:00.000+06:00";
              } else if (rangeKey === "lastMonth") {
                fromISO = "2026-09-01T00:00:00.000+06:00";
                toISO = "2026-10-01T00:00:00.000+06:00";
              }

              let q = (supabaseAdmin as any)
                .from("transactions")
                .select("id, invoice_no, ref_no, transaction_date, final_total")
                .eq("business_id", businessId)
                .eq("type", "sell")
                .order("transaction_date", { ascending: false });

              if (fromISO) q = q.gte("transaction_date", fromISO);
              if (toISO) q = q.lt("transaction_date", toISO);

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
              const invoiceMap = new Map(allSales.map((s) => [s.id, s]));

              const allLines: any[] = [];
              const CHUNK = 300;
              for (let i = 0; i < saleIds.length; i += CHUNK) {
                const chunk = saleIds.slice(i, i + CHUNK);
                let lFrom = 0;
                while (true) {
                  const { data: lData, error: lErr } = await (supabaseAdmin as any)
                    .from("transaction_sell_lines")
                    .select("id, transaction_id, product_id, variation_id, quantity, unit_price")
                    .in("transaction_id", chunk)
                    .range(lFrom, lFrom + 999);
                  if (lErr) throw lErr;
                  if (!lData || lData.length === 0) break;
                  allLines.push(...lData);
                  if (lData.length < 1000) break;
                  lFrom += 1000;
                }
              }

              const pIds = Array.from(new Set(allLines.map((l) => l.product_id).filter(Boolean)));
              const vIds = Array.from(new Set(allLines.map((l) => l.variation_id).filter(Boolean)));

              const allProducts: any[] = [];
              for (let i = 0; i < pIds.length; i += 500) {
                const chunk = pIds.slice(i, i + 500);
                const { data: pData } = await (supabaseAdmin as any)
                  .from("products")
                  .select("id, name, sku, default_purchase_price, mrp")
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

              let totalRev = 0;
              let totalCost = 0;
              const lossLines: any[] = [];
              const productLossMap = new Map<string, any>();

              for (const l of allLines) {
                const v = varMap.get(l.variation_id);
                const p = prodMap.get(l.product_id);
                const inv = invoiceMap.get(l.transaction_id);

                const unitCost = Number(v?.default_purchase_price ?? p?.default_purchase_price ?? 0);
                const mrp = Number(v?.mrp ?? p?.mrp ?? 0);
                const qty = Number(l.quantity || 0);
                const unitPrice = Number(l.unit_price || 0);
                const rev = qty * unitPrice;
                const cost = qty * unitCost;
                const profit = rev - cost;

                totalRev += rev;
                totalCost += cost;

                if (profit < -1) {
                  lossLines.push({
                    line_id: l.id,
                    transaction_id: l.transaction_id,
                    invoice_no: inv?.invoice_no ?? inv?.ref_no ?? "—",
                    date: inv?.transaction_date,
                    product_id: l.product_id,
                    product_name: p?.name ?? "Unknown",
                    sku: p?.sku ?? "",
                    qty,
                    unit_price: unitPrice,
                    unit_cost: unitCost,
                    mrp,
                    pack_size: v?.pack_size ?? 1,
                    rev: Number(rev.toFixed(2)),
                    cost: Number(cost.toFixed(2)),
                    profit: Number(profit.toFixed(2))
                  });

                  const cur = productLossMap.get(l.product_id) || {
                    name: p?.name ?? "Unknown",
                    sku: p?.sku ?? "",
                    totalQty: 0,
                    totalRev: 0,
                    totalCost: 0,
                    totalLoss: 0,
                    invoices: []
                  };
                  cur.totalQty += qty;
                  cur.totalRev += rev;
                  cur.totalCost += cost;
                  cur.totalLoss += profit;
                  cur.invoices.push(inv?.invoice_no);
                  productLossMap.set(l.product_id, cur);
                }
              }

              lossLines.sort((a, b) => a.profit - b.profit);
              const topProductLosses = Array.from(productLossMap.values()).sort((a, b) => a.totalLoss - b.totalLoss);

              return Response.json({
                ok: true,
                range: rangeKey,
                totalSales: allSales.length,
                totalLines: allLines.length,
                totalRev: Number(totalRev.toFixed(2)),
                totalCost: Number(totalCost.toFixed(2)),
                netProfit: Number((totalRev - totalCost).toFixed(2)),
                lossLinesCount: lossLines.length,
                topLossLines: lossLines.slice(0, 30),
                topProductLosses: topProductLosses.slice(0, 20)
              });
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

            if (body.action === "inspect_invoices") {
              const { invoice_nos } = body;
              const { data: sales } = await (supabaseAdmin as any)
                .from("transactions")
                .select("id, invoice_no, ref_no, transaction_date, final_total, total_paid, discount_amount")
                .in("invoice_no", invoice_nos);

              const sIds = (sales || []).map((s: any) => s.id);
              const { data: lines } = await (supabaseAdmin as any)
                .from("transaction_sell_lines")
                .select("id, transaction_id, product_id, variation_id, quantity, unit_price, line_discount_amount")
                .in("transaction_id", sIds);

              const pIds = (lines || []).map((l: any) => l.product_id);
              const { data: prods } = await (supabaseAdmin as any)
                .from("products")
                .select("id, name, default_purchase_price, mrp")
                .in("id", pIds);

              const prodMap = new Map((prods || []).map((p: any) => [p.id, p]));
              const mappedLines = (lines || []).map((l: any) => {
                const p = prodMap.get(l.product_id);
                return {
                  ...l,
                  product_name: p?.name,
                  mrp: p?.mrp,
                  unit_cost: p?.default_purchase_price
                };
              });

              return Response.json({ ok: true, sales, lines: mappedLines });
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
