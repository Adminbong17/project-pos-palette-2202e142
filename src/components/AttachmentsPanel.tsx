import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { vaultUpload, vaultDelete } from "@/lib/vault.functions";
import { vaultShareUrl } from "@/lib/vault";
import { Upload, Trash2, FileIcon, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Props = {
  entityType: string;
  entityId?: string | null;
  accept?: string;
  title?: string;
};

export function AttachmentsPanel({ entityType, entityId, accept, title = "Attachments" }: Props) {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const upload = useServerFn(vaultUpload);
  const del = useServerFn(vaultDelete);

  const key = ["attachments", business?.id, entityType, entityId ?? null];

  const { data: rows = [], isLoading } = useQuery({
    enabled: !!business?.id,
    queryKey: key,
    queryFn: async () => {
      let q = supabase
        .from("attachments")
        .select("*")
        .eq("business_id", business!.id)
        .eq("entity_type", entityType)
        .order("created_at", { ascending: false });
      q = entityId ? q.eq("entity_id", entityId) : q.is("entity_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!business) throw new Error("No business");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("business_id", business.id);
      fd.append("entity_type", entityType);
      if (entityId) fd.append("entity_id", entityId);
      return upload({ data: fd });
    },
    onSuccess: () => {
      toast.success("Uploaded");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e.message ?? "Upload failed"),
  });

  const q = search.trim().toLowerCase();
  const filteredRows = q
    ? (rows as any[]).filter((r) =>
        [r.file_name, r.mime, formatBytes(r.size ?? 0)].some((v) => String(v ?? "").toLowerCase().includes(q)),
      )
    : (rows as any[]);

  const deleteMut = useMutation({
    mutationFn: (attachment_id: string) => del({ data: { attachment_id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">{title}</h3>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadMut.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {uploadMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadMut.mutate(f);
            e.target.value = "";
          }}
        />
      </div>

      {rows.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…"
            className="h-9 pl-9"
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No files yet.</p>
      ) : filteredRows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No match.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {filteredRows.map((r: any) => {
            const url = vaultShareUrl(r.share_token);
            const isImg = (r.mime ?? "").startsWith("image/");
            return (
              <li key={r.id} className="flex items-center gap-3 py-2">
                {isImg ? (
                  <img src={url} alt={r.file_name} className="h-10 w-10 rounded object-cover border" />
                ) : (
                  <FileIcon className="h-6 w-6 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm hover:underline"
                  >
                    {r.file_name}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {r.mime} · {formatBytes(r.size ?? 0)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete ${r.file_name}?`)) deleteMut.mutate(r.id);
                  }}
                  className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
