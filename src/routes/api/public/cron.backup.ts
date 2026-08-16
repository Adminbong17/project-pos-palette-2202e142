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
          return Response.json({
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
