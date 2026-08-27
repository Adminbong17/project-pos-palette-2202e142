import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadLabPrefs, saveLabPrefs, EMPTY_LAB_PREFS, type LabPrefs } from "@/lib/lab-prefs";

export const Route = createFileRoute("/_authenticated/lab-reports/signatures")({
  head: () => ({
    meta: [
      { title: "Lab Signatures & Pad Settings" },
      {
        name: "description",
        content:
          "Choose which technologist and pathologist sign your lab reports and whether reports print on your own pad with blank top space.",
      },
      { property: "og:title", content: "Lab Signatures & Pad Settings" },
      {
        property: "og:description",
        content: "Signature defaults and own-pad printing for lab reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LabSignaturesPage,
});

function LabSignaturesPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id ?? null;

  const [prefs, setPrefs] = useState<LabPrefs>(EMPTY_LAB_PREFS);
  useEffect(() => setPrefs(loadLabPrefs()), []);

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

  const techs = (signatories.data ?? []).filter((s) => s.kind === "technologist");
  const pathos = (signatories.data ?? []).filter((s) => s.kind === "pathologist");

  function update(patch: Partial<LabPrefs>) {
    setPrefs((p) => ({ ...p, ...patch }));
  }

  function save() {
    saveLabPrefs(prefs);
    toast.success("Signature settings saved");
  }

  return (
    <Card foldable>
      <CardHeader>
        <CardTitle className="text-base">Signatures & pad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          These choices are used on every report you print from the New Report page. Add people on the Lab Staff page
          first.
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Lab Technologist</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-input px-2 text-sm"
              value={prefs.techName}
              onChange={(e) => {
                const v = e.target.value;
                const f = techs.find((s) => s.name === v);
                update({ techName: v, techDesignation: f?.designation ?? "" });
              }}
            >
              <option value="">— select appointed technologist —</option>
              {techs.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                  {s.designation ? ` — ${s.designation}` : ""}
                </option>
              ))}
            </select>
            <Textarea
              rows={2}
              className="min-h-[44px] resize-none text-sm"
              placeholder="Technologist designation"
              value={prefs.techDesignation}
              onChange={(e) => update({ techDesignation: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Consultant Pathologist</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-input px-2 text-sm"
              value={prefs.pathologistName}
              onChange={(e) => {
                const v = e.target.value;
                const f = pathos.find((s) => s.name === v);
                update({ pathologistName: v, pathologistDesignation: f?.designation ?? "" });
              }}
            >
              <option value="">— select appointed pathologist —</option>
              {pathos.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                  {s.designation ? ` — ${s.designation}` : ""}
                </option>
              ))}
            </select>
            <Textarea
              rows={2}
              className="min-h-[44px] resize-none text-sm"
              placeholder="Pathologist designation"
              value={prefs.pathologistDesignation}
              onChange={(e) => update({ pathologistDesignation: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border/60 p-2">
          <Switch id="lab-own-pad" checked={prefs.ownPad} onCheckedChange={(v) => update({ ownPad: v })} />
          <Label htmlFor="lab-own-pad" className="text-sm">
            Own pad
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {prefs.ownPad ? "1.5 inch blank top space (A4), no clinic header" : "Print clinic header"}
            </span>
          </Label>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={save}>
            Save settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
