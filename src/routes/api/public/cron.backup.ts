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

            if (body.action === "batch_update_purchase_prices") {
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
                    if (item.variation_id && item.default_purchase_price !== undefined) {
                      const { error: vErr } = await (supabaseAdmin as any)
                        .from("variations")
                        .update({
                          default_purchase_price: item.default_purchase_price,
                          dpp_inc_tax: item.default_purchase_price,
                        })
                        .eq("id", item.variation_id);
                      if (!vErr) updatedVariations++;
                    }

                    if (item.product_id && item.default_purchase_price !== undefined) {
                      const { error: pErr } = await (supabaseAdmin as any)
                        .from("products")
                        .update({
                          default_purchase_price: item.default_purchase_price,
                        })
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
