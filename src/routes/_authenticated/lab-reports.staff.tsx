import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/lab-reports/staff")({
  head: () => ({
    meta: [
      { title: "Appointed Lab Staff — Technologists & Pathologists" },
      {
        name: "description",
        content:
          "Appoint your lab technologists and consultant pathologists once, then simply select them when printing a lab report.",
      },
      { property: "og:title", content: "Appointed Lab Staff — Technologists & Pathologists" },
      {
        property: "og:description",
        content: "Manage the lab technologists and pathologists who sign your reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LabStaffPage,
});

function LabStaffPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id ?? null;
  const qc = useQueryClient();

  const signatories = useQuery({
    queryKey: ["lab-signatories", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_signatories")
        .select("id, kind, name, designation, is_active")
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; kind: string; name: string; designation: string | null }[];
    },
  });

  const [newSig, setNewSig] = useState({ kind: "technologist", name: "", designation: "" });

  const addSig = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business selected");
      if (!newSig.name.trim()) throw new Error("Name is required");
      const { error } = await supabase.from("lab_signatories").insert({
        business_id: businessId,
        kind: newSig.kind,
        name: newSig.name.trim(),
        designation: newSig.designation.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewSig({ kind: newSig.kind, name: "", designation: "" });
      qc.invalidateQueries({ queryKey: ["lab-signatories"] });
      toast.success("Signatory added");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not add"),
  });

  const removeSig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lab_signatories").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-signatories"] });
      toast.success("Removed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove"),
  });

  return (
    <Card foldable>
      <CardHeader>
        <CardTitle className="text-base">Appointed lab staff — add Technologist / Pathologist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          Add your lab technologists and consultant pathologists once here. They then appear on the Signatures & Pad
          page and only need to be selected before printing a report. Names and designations can be 2–4 lines.
        </div>
        <div className="grid gap-2 sm:grid-cols-[140px_1fr_1fr_auto]">
          <select
            className="h-9 rounded-md border border-input bg-input px-2 text-sm"
            value={newSig.kind}
            onChange={(e) => setNewSig((p) => ({ ...p, kind: e.target.value }))}
          >
            <option value="technologist">Technologist</option>
            <option value="pathologist">Pathologist</option>
          </select>
          <Textarea
            rows={2}
            className="min-h-[44px] resize-none text-sm"
            placeholder="Name"
            value={newSig.name}
            onChange={(e) => setNewSig((p) => ({ ...p, name: e.target.value }))}
          />
          <Textarea
            rows={2}
            className="min-h-[44px] resize-none text-sm"
            placeholder="Designation (e.g. MBBS, BCS)"
            value={newSig.designation}
            onChange={(e) => setNewSig((p) => ({ ...p, designation: e.target.value }))}
          />
          <Button size="sm" onClick={() => addSig.mutate()} disabled={addSig.isPending}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <div className="space-y-1">
          {(signatories.data ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded border border-border/50 px-2 py-1 text-sm"
            >
              <span>
                <span className="font-medium whitespace-pre-wrap">{s.name}</span>
                {s.designation ? (
                  <span className="text-muted-foreground whitespace-pre-wrap"> · {s.designation}</span>
                ) : null}
                <span className="ml-2 text-[11px] uppercase text-muted-foreground">{s.kind}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => removeSig.mutate(s.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {(signatories.data ?? []).length === 0 && (
            <div className="text-xs text-muted-foreground">
              No lab staff appointed yet — add technologists and pathologists above.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
