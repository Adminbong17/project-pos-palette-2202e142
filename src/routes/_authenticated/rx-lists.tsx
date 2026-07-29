import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useRxPresets, type PresetKind } from "@/hooks/use-rx-presets";

export const Route = createFileRoute("/_authenticated/rx-lists")({
  head: () => ({
    meta: [
      { title: "My Rx Lists — QweekPOS" },
      { name: "description", content: "Doctors can pre-add their own C/C, vitals, investigations, frequencies, advice and medicines." },
      { property: "og:title", content: "My Rx Lists — QweekPOS" },
      { property: "og:description", content: "Manage your personal prescription option lists." },
    ],
  }),
  component: RxListsPage,
});

const KINDS: { kind: PresetKind; title: string; hint: string }[] = [
  { kind: "cc", title: "C/C (Chief Complaints)", hint: "e.g. Fever, Headache" },
  { kind: "vital", title: "Extra Vitals", hint: "e.g. Waist, Head circumference" },
  { kind: "investigation", title: "Investigations", hint: "e.g. CBC, X-ray Chest P/A" },
  { kind: "frequency", title: "Frequencies", hint: "e.g. 1+0+1, 1+1+1 after meal" },
  { kind: "advice", title: "Advice", hint: "e.g. Plenty of water, Rest" },
  { kind: "instruction", title: "Rx Instructions", hint: "e.g. After meal, Before sleep" },
  { kind: "medicine", title: "My Medicines", hint: "Private list — not added to products" },
];

function PresetCard({ kind, title, hint, businessId }: { kind: PresetKind; title: string; hint: string; businessId?: string }) {
  const { items, isLoading, add, remove } = useRxPresets(kind, businessId);
  const [value, setValue] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = value.trim();
    if (!n) return;
    add(n);
    setValue("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={submit} className="flex gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Type and press Add" />
          <Button type="submit" size="sm">
            <Plus className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Add</span>
          </Button>
        </form>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing saved yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs">
                <span className="max-w-[220px] truncate">{p.name}</span>
                <button type="button" onClick={() => remove(p.id)} title="Remove" className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RxListsPage() {
  const { data: business } = useCurrentBusiness();
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">My Rx Lists</h1>
        <p className="text-sm text-muted-foreground">
          Add your own options here beforehand — they appear while writing a prescription. These lists are private to you.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {KINDS.map((k) => (
          <PresetCard key={k.kind} {...k} businessId={business?.id} />
        ))}
      </div>
    </div>
  );
}
