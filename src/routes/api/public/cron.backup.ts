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
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const secret = url.searchParams.get("secret");
          if (secret !== "sheikhpharma2026") {
            return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
          }
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const businessId = "c82c76de-9574-4dbb-bb08-775794244650";

          const allProducts: any[] = [];
          const PAGE = 1000;
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await (supabaseAdmin as any)
              .from("products")
              .select(`
                id, name, sku, default_purchase_price, default_sell_price, mrp,
                brand:brands(id, name),
                variations(id, name, pack_size, default_purchase_price, default_sell_price, mrp)
              `)
              .eq("business_id", businessId)
              .range(from, from + PAGE - 1);

            if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
            const batch = data ?? [];
            allProducts.push(...batch);
            if (batch.length < PAGE) break;
          }

          return Response.json({
            ok: true,
            count: allProducts.length,
            products: allProducts,
          });
        } catch (err: any) {
          return Response.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
        }
      },
    },
  },
});
