import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive, History, Loader2 } from "lucide-react";
import { archiveList, archiveRestore, archiveRunNow } from "@/lib/archive.functions";

const GRP_LABEL: Record<string, string> = {
  sales: "বিক্রি/কেনা",
  prescriptions: "প্রেসক্রিপশন",
  lab_reports: "ল্যাব রিপোর্ট",
  appointments: "সিরিয়াল",
  expenses: "খরচ",
};

function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ArchivePanel() {
  const qc = useQueryClient();
  const list = useServerFn(archiveList);
  const run = useServerFn(archiveRunNow);
  const restore = useServerFn(archiveRestore);

  const chunks = useQuery({ queryKey: ["archive-chunks"], queryFn: () => list() });

  const runMut = useMutation({
    mutationFn: (force: boolean) => run({ data: { force } }),
    onSuccess: (r: any) => {
      if (r.skipped) toast.info("ডাটাবেস এখনো সীমার নিচে — archive দরকার নেই");
      else {
        const errs = r.archived.filter((a: any) => a.error).length;
        toast.success(`${r.archived.length - errs} মাস vault-এ সরানো হয়েছে${errs ? ` · ${errs} ব্যর্থ` : ""}`);
      }
      qc.invalidateQueries({ queryKey: ["archive-chunks"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Archive failed"),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => restore({ data: { id } }),
    onSuccess: () => {
      toast.success("মাসটি ডাটাবেসে ফেরত আনা হয়েছে");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Restore failed"),
  });

  const rows = (chunks.data ?? []) as any[];

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Archive className="h-4 w-4" /> পুরোনো ডাটা archive (vault)
          </h2>
          <p className="text-xs text-muted-foreground">
            ডাটাবেস সীমা পার হলে ৬ মাসের পুরোনো ডাটা প্রতিরাতে vault-এ যায়; খুঁজলে সাথে সাথে দেখা যায়।
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runMut.mutate(false)}
            disabled={runMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
          >
            {runMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            এখনই archive চালাও
          </button>
          <button
            onClick={() => {
              if (confirm("সীমা পার না হলেও ৬ মাসের পুরোনো ডাটা এখনই vault-এ সরাবেন?")) runMut.mutate(true);
            }}
            disabled={runMut.isPending}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            জোর করে archive
          </button>
        </div>
      </div>

      {chunks.isLoading ? (
        <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">এখনো কোনো মাস archive হয়নি।</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">ব্যবসা</th>
                <th>ধরন</th>
                <th>মাস</th>
                <th>রেকর্ড</th>
                <th>সাইজ</th>
                <th>অবস্থা</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-1.5">{r.businesses?.name ?? "—"}</td>
                  <td>{GRP_LABEL[r.grp] ?? r.grp}</td>
                  <td>{String(r.period_month).slice(0, 7)}</td>
                  <td>{r.row_count}</td>
                  <td>{fmtBytes(Number(r.bytes))}</td>
                  <td>{r.status === "archived" ? "vault-এ" : "ফেরত আনা"}</td>
                  <td className="text-right">
                    {r.status === "archived" && (
                      <button
                        onClick={() => {
                          if (confirm("এই মাসের ডাটা ডাটাবেসে ফেরত আনবেন?")) restoreMut.mutate(r.id);
                        }}
                        disabled={restoreMut.isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
                      >
                        <History className="h-3 w-3" /> ফেরত আনো
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
