import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRxOptionSettings, type RxOptionKind } from "@/hooks/use-rx-option-settings";

export const Route = createFileRoute("/_authenticated/rx-options")({
  head: () => ({
    meta: [
      { title: "Manage Rx Options — QweekPOS" },
      { name: "description", content: "Manage shared prescription options: C/C, investigations, frequencies, instructions and advices." },
      { property: "og:title", content: "Manage Rx Options — QweekPOS" },
      { property: "og:description", content: "Shared prescription option lists for every doctor in the business." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RxOptionsPage,
});

type SharedTable = "chief_complaints" | "investigations" | "rx_frequencies" | "rx_instructions" | "rx_advices";

const LISTS: { table: SharedTable; kind: RxOptionKind; title: string; hint: string }[] = [
  { table: "chief_complaints", kind: "cc", title: "C/C (Chief Complaints)", hint: "e.g. Fever, Headache" },
  { table: "investigations", kind: "investigation", title: "Investigations", hint: "e.g. CBC, X-ray Chest P/A" },
  { table: "rx_frequencies", kind: "frequency", title: "Frequencies", hint: "e.g. 1+0+1" },
  { table: "rx_instructions", kind: "instruction", title: "Rx Instructions", hint: "e.g. After meal" },
  { table: "rx_advices", kind: "advice", title: "Advices", hint: "e.g. Plenty of water" },
];


function ListCard({
  table,
  kind,
  title,
  hint,
  businessId,
  enabled,
  onToggle,
  toggleDisabled,
}: {
  table: SharedTable;
  kind: RxOptionKind;
  title: string;
  hint: string;
  businessId?: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  toggleDisabled?: boolean;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const key = ["rx-shared-options", table, businessId];

  const list = useQuery({
    queryKey: key,
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("id, name")
        .eq("business_id", businessId!)
        .order("name")
        .limit(3000);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const add = useMutation({
    mutationFn: async (name: string) => {
      const n = name.trim();
      if (!n) throw new Error("Type a value first");
      const { error } = await supabase.from(table).insert({ business_id: businessId!, name: n });
      if (error) throw error;
    },
    onSuccess: () => {
      setValue("");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not add"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  return (
    <Card className={enabled ? undefined : "opacity-90"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {title}
              <span className="ml-2 text-xs font-normal text-muted-foreground">{list.data?.length ?? 0}</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Switch
              id={`toggle-${kind}`}
              checked={enabled}
              disabled={toggleDisabled}
              onCheckedChange={onToggle}
            />
            <Label htmlFor={`toggle-${kind}`} className="text-[10px] uppercase text-muted-foreground">
              {enabled ? "Default on" : "Default off"}
            </Label>
          </div>
        </div>
        {!enabled && (
          <p className="mt-1 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
            Doctors won’t see this shared list — only their own items from “My Rx Lists”.
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(value);
          }}
        >
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Type and press Add" />
          <Button type="submit" size="sm" disabled={add.isPending}>
            <Plus className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Add</span>
          </Button>
        </form>
        {list.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (list.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing added yet.</p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {(list.data ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1 text-sm">
                <span className="truncate">{r.name}</span>
                <button type="button" title="Remove" onClick={() => remove.mutate(r.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RxOptionsPage() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin, isLoading } = useCurrentRole();
  const settings = useRxOptionSettings(business?.id);

  if (!isLoading && !isAdmin) {
    return (
      <div className="p-6">
        <h1 className="font-display text-xl font-semibold">Manage Rx Options</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only business admins can manage the shared lists. Use “My Rx Lists” for your personal options.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Manage Rx Options</h1>
        <p className="text-sm text-muted-foreground">
          Shared lists used by every doctor while writing a prescription — C/C, investigations, frequencies, instructions and advices.
          Turn a list off if doctors should use only their own personal items.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {LISTS.map((l) => (
          <ListCard
            key={l.table}
            {...l}
            businessId={business?.id}
            enabled={settings.isEnabled(l.kind)}
            toggleDisabled={settings.isLoading || settings.isSaving || !business?.id}
            onToggle={(next) => settings.setEnabled(l.kind, next)}
          />
        ))}
      </div>
    </div>
  );
}

