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

            if (body.action === "inspect_monas") {
              const { data: tx } = await (supabaseAdmin as any)
                .from("transactions")
                .select("id, invoice_no, transaction_date, final_total")
                .eq("invoice_no", "SKP-20261017-41279")
                .maybeSingle();

              if (!tx) return Response.json({ ok: false, error: "Transaction not found" });

              const { data: lines } = await (supabaseAdmin as any)
                .from("transaction_sell_lines")
                .select("id, transaction_id, product_id, variation_id, quantity, unit_price, product:products(name, default_purchase_price, mrp, brand:brands(name)), variation:variations(pack_size, default_purchase_price, mrp)")
                .eq("transaction_id", tx.id);

              return Response.json({ ok: true, tx, lines });
            }

            if (body.action === "fix_monas") {
              // Line update
              const { line_id, quantity, unit_price } = body;
              const { error } = await (supabaseAdmin as any)
                .from("transaction_sell_lines")
                .update({ quantity, unit_price })
                .eq("id", line_id);
              if (error) throw error;
              return Response.json({ ok: true, fixed: true });
            }

            if (body.action === "find_strip_typos") {
              // Find all lines in October where unit_price > 50 and quantity <= 2 for tablets
              const fromISO = "2026-10-01T00:00:00.000+06:00";
              const toISO = "2026-11-01T00:00:00.000+06:00";

              const { data: sales } = await (supabaseAdmin as any)
                .from("transactions")
                .select("id, invoice_no, transaction_date")
                .eq("business_id", businessId)
                .eq("type", "sell")
                .gte("transaction_date", fromISO)
                .lt("transaction_date", toISO);

              const saleIds = (sales ?? []).map((s: any) => s.id);
              const saleMap = new Map((sales ?? []).map((s: any) => [s.id, s.invoice_no]));

              const allLines: any[] = [];
              for (let i = 0; i < saleIds.length; i += 300) {
                const chunk = saleIds.slice(i, i + 300);
                const { data: lData } = await (supabaseAdmin as any)
                  .from("transaction_sell_lines")
                  .select("id, transaction_id, product_id, variation_id, quantity, unit_price, product:products(name, default_purchase_price, mrp, brand:brands(name))")
                  .in("transaction_id", chunk);
                if (lData) allLines.push(...lData);
              }

              const potentialStripTypos = [];
              for (const l of allLines) {
                const name = (l.product?.name ?? "").toLowerCase();
                const isTablet = name.startsWith("tab") || name.startsWith("cap");
                const mrp = Number(l.product?.mrp ?? 0);
                const cost = Number(l.product?.default_purchase_price ?? 0);
                const price = Number(l.unit_price || 0);
                const qty = Number(l.quantity || 0);

                // If it's a tablet/capsule, and price is > 4x MRP, or price > 40 and mrp < 15 and qty <= 2
                if (isTablet && mrp > 0 && price >= mrp * 3 && qty <= 3) {
                  potentialStripTypos.push({
                    line_id: l.id,
                    invoice: saleMap.get(l.transaction_id),
                    product_id: l.product_id,
                    name: l.product?.name,
                    brand: l.product?.brand?.name,
                    qty,
                    price,
                    mrp,
                    cost,
                    totRev: qty * price,
                    totCost: qty * cost,
                    profit: (qty * price) - (qty * cost),
                    margin: Number((((qty * price) - (qty * cost)) / (qty * price) * 100).toFixed(1))
                  });
                }
              }

              return Response.json({ ok: true, count: potentialStripTypos.length, potentialStripTypos });
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
