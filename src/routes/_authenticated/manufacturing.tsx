import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Factory, Play, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { completeProductionOrder } from "@/lib/manufacturing.functions";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/manufacturing")({
  head: () => ({ meta: [{ title: "Manufacturing — QweekPOS" }] }),
  component: ManufacturingPage,
});

type VariationOpt = {
  id: string;
  name: string;
  product_id: string;
  default_purchase_price: number | null;
  default_sell_price: number | null;
  product: { name: string | null } | null;
};

type Location = { id: string; name: string };

type BomLine = {
  id: string;
  product_id: string;
  variation_id: string;
  quantity: number;
  unit_cost: number;
  variation: { name: string; product: { name: string | null } | null } | null;
};

type Bom = {
  id: string;
  name: string;
  output_qty: number;
  finished_product_id: string;
  finished_variation_id: string;
  is_active: boolean;
  notes: string | null;
  finished_variation: { name: string; product: { name: string | null } | null } | null;
  lines: BomLine[];
};

type Order = {
  id: string;
  ref_no: string | null;
  order_date: string;
  planned_qty: number;
  produced_qty: number;
  wastage_qty: number;
  yield_percent: number;
  total_cost: number;
  unit_cost: number;
  status: "draft" | "in_progress" | "completed" | "cancelled";
  bom_id: string | null;
  finished_product_id: string;
  finished_variation_id: string;
  location_id: string;
  finished_variation: { name: string; product: { name: string | null } | null } | null;
  location: { name: string | null } | null;
  bom: { name: string | null; lines: BomLine[] } | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(n || 0);

function useVariations(businessId?: string) {
  return useQuery({
    queryKey: ["mfg-variations", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("variations")
        .select(
          "id, name, product_id, default_purchase_price, default_sell_price, product:products!inner(name, business_id)"
        )
        .eq("product.business_id", businessId!)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as VariationOpt[];
    },
  });
}

function useLocations(businessId?: string) {
  return useQuery({
    queryKey: ["mfg-locations", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_locations")
        .select("id, name")
        .eq("business_id", businessId!)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as Location[];
    },
  });
}

function ManufacturingPage() {
  const { data: business } = useCurrentBusiness();

  if (!business) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Select or create a business to start manufacturing.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Factory className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-semibold">Manufacturing</h1>
          <p className="text-sm text-muted-foreground">
            Bill of materials, production orders, wastage & cost roll-up.
          </p>
        </div>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Production Orders</TabsTrigger>
          <TabsTrigger value="boms">Bills of Materials</TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="pt-4">
          <OrdersTab businessId={business.id} />
        </TabsContent>
        <TabsContent value="boms" className="pt-4">
          <BomsTab businessId={business.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------- BOMs ---------------------- */

function BomsTab({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: boms = [], isLoading } = useQuery({
    queryKey: ["mfg-boms", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mfg_boms")
        .select(
          "id, name, output_qty, finished_product_id, finished_variation_id, is_active, notes, finished_variation:variations!mfg_boms_finished_variation_id_fkey(name, product:products(name)), lines:mfg_bom_lines(id, product_id, variation_id, quantity, unit_cost, variation:variations(name, product:products(name)))"
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Bom[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mfg_boms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("BOM deleted");
      qc.invalidateQueries({ queryKey: ["mfg-boms", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> New BOM
            </Button>
          </DialogTrigger>
          <BomDialog businessId={businessId} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Finished product</TableHead>
              <TableHead className="text-right">Output</TableHead>
              <TableHead className="text-right">Raw items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Loading…
                </TableCell>
              </TableRow>
            ) : boms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  No BOMs yet.
                </TableCell>
              </TableRow>
            ) : (
              boms.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>
                    {b.finished_variation?.product?.name} · {b.finished_variation?.name}
                  </TableCell>
                  <TableCell className="text-right">{b.output_qty}</TableCell>
                  <TableCell className="text-right">{b.lines?.length ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={b.is_active ? "default" : "secondary"}>
                      {b.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => del.mutate(b.id)}
                      aria-label="Delete BOM"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function BomDialog({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: variations = [] } = useVariations(businessId);

  const [name, setName] = useState("");
  const [outputQty, setOutputQty] = useState(1);
  const [finishedVar, setFinishedVar] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<
    { variation_id: string; quantity: number; unit_cost: number }[]
  >([{ variation_id: "", quantity: 1, unit_cost: 0 }]);

  // Auto-save the in-progress BOM so a power cut does not lose it.
  type BomDraft = {
    name: string; outputQty: number; finishedVar: string; notes: string;
    lines: { variation_id: string; quantity: number; unit_cost: number }[];
  };
  const { clearDraft } = useAutosaveDraft<BomDraft>(
    `mfg-bom-new:${businessId}`,
    { name, outputQty, finishedVar, notes, lines },
    (d) => {
      if (d.name) setName(d.name);
      if (d.outputQty) setOutputQty(d.outputQty);
      if (d.finishedVar) setFinishedVar(d.finishedVar);
      if (d.notes) setNotes(d.notes);
      if (d.lines?.length) setLines(d.lines);
    },
    {
      isEmpty: (d) => !d.name?.trim() && !d.finishedVar && !d.lines?.some((l) => l.variation_id),
      restoreMessage: "Unsaved BOM restored",
    },
  );

  const finished = variations.find((v) => v.id === finishedVar);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      if (!finished) throw new Error("Finished product required");
      const validLines = lines.filter((l) => l.variation_id && l.quantity > 0);
      if (validLines.length === 0) throw new Error("Add at least one raw material");

      const { data: bom, error } = await supabase
        .from("mfg_boms")
        .insert({
          business_id: businessId,
          name,
          finished_product_id: finished.product_id,
          finished_variation_id: finished.id,
          output_qty: outputQty,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const payload = validLines.map((l) => {
        const v = variations.find((x) => x.id === l.variation_id)!;
        return {
          bom_id: bom.id,
          product_id: v.product_id,
          variation_id: v.id,
          quantity: l.quantity,
          unit_cost: l.unit_cost,
        };
      });
      const { error: e2 } = await supabase.from("mfg_bom_lines").insert(payload);
      if (e2) throw e2;
    },
    onSuccess: () => {
      clearDraft();
      toast.success("BOM created");
      qc.invalidateQueries({ queryKey: ["mfg-boms", businessId] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>New Bill of Materials</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Output quantity</Label>
            <Input
              type="number"
              min={0.0001}
              step="any"
              value={outputQty}
              onChange={(e) => setOutputQty(Number(e.target.value))}
            />
          </div>
          <div className="col-span-2">
            <Label>Finished product / variation</Label>
            <Select value={finishedVar} onValueChange={setFinishedVar}>
              <SelectTrigger>
                <SelectValue placeholder="Select finished variation" />
              </SelectTrigger>
              <SelectContent>
                {variations.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.product?.name} · {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Raw materials</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLines([...lines, { variation_id: "", quantity: 1, unit_cost: 0 }])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Add row
            </Button>
          </div>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Raw material</TableHead>
                  <TableHead className="w-32 text-right">Qty</TableHead>
                  <TableHead className="w-32 text-right">Unit cost</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select
                        value={l.variation_id}
                        onValueChange={(v) => {
                          const vr = variations.find((x) => x.id === v);
                          const next = [...lines];
                          next[i] = {
                            ...next[i],
                            variation_id: v,
                            unit_cost:
                              next[i].unit_cost ||
                              Number(vr?.default_purchase_price ?? 0),
                          };
                          setLines(next);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {variations.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.product?.name} · {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        className="text-right"
                        value={l.quantity}
                        onChange={(e) => {
                          const next = [...lines];
                          next[i].quantity = Number(e.target.value);
                          setLines(next);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        className="text-right"
                        value={l.unit_cost}
                        onChange={(e) => {
                          const next = [...lines];
                          next[i].unit_cost = Number(e.target.value);
                          setLines(next);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save BOM"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------------------- Production Orders ---------------------- */

function OrdersTab({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [completing, setCompleting] = useState<Order | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["mfg-orders", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mfg_production_orders")
        .select(
          "id, ref_no, order_date, planned_qty, produced_qty, wastage_qty, yield_percent, total_cost, unit_cost, status, bom_id, finished_product_id, finished_variation_id, location_id, finished_variation:variations!mfg_production_orders_finished_variation_id_fkey(name, product:products(name)), location:business_locations(name), bom:mfg_boms(name, lines:mfg_bom_lines(id, product_id, variation_id, quantity, unit_cost, variation:variations(name, product:products(name))))"
        )
        .eq("business_id", businessId)
        .order("order_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("mfg_production_orders")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order cancelled");
      qc.invalidateQueries({ queryKey: ["mfg-orders", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> New Production Order
            </Button>
          </DialogTrigger>
          <NewOrderDialog businessId={businessId} onDone={() => setOpenNew(false)} />
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Planned</TableHead>
              <TableHead className="text-right">Produced</TableHead>
              <TableHead className="text-right">Yield %</TableHead>
              <TableHead className="text-right">Unit cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-6">
                  Loading…
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-6">
                  No production orders yet.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.ref_no ?? "—"}</TableCell>
                  <TableCell>{new Date(o.order_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {o.finished_variation?.product?.name} · {o.finished_variation?.name}
                  </TableCell>
                  <TableCell>{o.location?.name}</TableCell>
                  <TableCell className="text-right">{o.planned_qty}</TableCell>
                  <TableCell className="text-right">{o.produced_qty}</TableCell>
                  <TableCell className="text-right">
                    {Number(o.yield_percent || 0).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">{fmt(o.unit_cost)}</TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {o.status !== "completed" && o.status !== "cancelled" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCompleting(o)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancel.mutate(o.id)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {completing && (
        <Dialog open onOpenChange={(v) => !v && setCompleting(null)}>
          <CompleteOrderDialog
            businessId={businessId}
            order={completing}
            onDone={() => {
              setCompleting(null);
              qc.invalidateQueries({ queryKey: ["mfg-orders", businessId] });
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Order["status"] }) {
  const map: Record<Order["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Draft", variant: "secondary" },
    in_progress: { label: "In progress", variant: "outline" },
    completed: { label: "Completed", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
  };
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function NewOrderDialog({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: locations = [] } = useLocations(businessId);
  const { data: variations = [] } = useVariations(businessId);

  const { data: boms = [] } = useQuery({
    queryKey: ["mfg-boms-select", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mfg_boms")
        .select("id, name, finished_product_id, finished_variation_id, output_qty")
        .eq("business_id", businessId)
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [refNo, setRefNo] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [bomId, setBomId] = useState<string>("none");
  const [finishedVar, setFinishedVar] = useState<string>("");
  const [plannedQty, setPlannedQty] = useState(1);

  const bom = boms.find((b) => b.id === bomId);
  const finished =
    variations.find((v) => v.id === (bom?.finished_variation_id ?? finishedVar)) || null;

  const save = useMutation({
    mutationFn: async () => {
      if (!locationId) throw new Error("Select a location");
      if (!finished) throw new Error("Select a finished product");
      const { error } = await supabase.from("mfg_production_orders").insert({
        business_id: businessId,
        location_id: locationId,
        bom_id: bom?.id ?? null,
        ref_no: refNo || null,
        finished_product_id: finished.product_id,
        finished_variation_id: finished.id,
        planned_qty: plannedQty,
        status: "in_progress",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Production order created");
      qc.invalidateQueries({ queryKey: ["mfg-orders", businessId] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>New Production Order</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Reference no.</Label>
          <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        </div>
        <div>
          <Label>Planned qty</Label>
          <Input
            type="number"
            step="any"
            value={plannedQty}
            onChange={(e) => setPlannedQty(Number(e.target.value))}
          />
        </div>
        <div className="col-span-2">
          <Label>Location</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Bill of Materials (optional)</Label>
          <Select value={bomId} onValueChange={setBomId}>
            <SelectTrigger>
              <SelectValue placeholder="No BOM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No BOM (ad-hoc)</SelectItem>
              {boms.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!bom && (
          <div className="col-span-2">
            <Label>Finished product / variation</Label>
            <Select value={finishedVar} onValueChange={setFinishedVar}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {variations.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.product?.name} · {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Play className="h-4 w-4 mr-1" />
          {save.isPending ? "Creating…" : "Start production"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CompleteOrderDialog({
  businessId,
  order,
  onDone,
}: {
  businessId: string;
  order: Order;
  onDone: () => void;
}) {
  const complete = useServerFn(completeProductionOrder);
  const { data: variations = [] } = useVariations(businessId);

  const bomLines = order.bom?.lines ?? [];
  const scale = order.planned_qty || 1;

  const [producedQty, setProducedQty] = useState(order.planned_qty || 1);
  const [wastageQty, setWastageQty] = useState(0);
  const [lines, setLines] = useState(() =>
    bomLines.length > 0
      ? bomLines.map((l) => ({
          product_id: l.product_id,
          variation_id: l.variation_id,
          label: `${l.variation?.product?.name ?? ""} · ${l.variation?.name ?? ""}`,
          planned_qty: Number(l.quantity) * scale,
          actual_qty: Number(l.quantity) * scale,
          unit_cost: Number(l.unit_cost),
        }))
      : [
          {
            product_id: "",
            variation_id: "",
            label: "",
            planned_qty: 0,
            actual_qty: 0,
            unit_cost: 0,
          },
        ]
  );

  const submit = useMutation({
    mutationFn: async () => {
      const cleaned = lines
        .filter((l) => l.variation_id && l.actual_qty >= 0)
        .map((l) => ({
          product_id: l.product_id,
          variation_id: l.variation_id,
          planned_qty: l.planned_qty,
          actual_qty: l.actual_qty,
          unit_cost: l.unit_cost,
        }));
      if (cleaned.length === 0) throw new Error("At least one raw material required");
      await complete({
        data: {
          order_id: order.id,
          produced_qty: producedQty,
          wastage_qty: wastageQty,
          lines: cleaned,
        },
      });
    },
    onSuccess: () => {
      toast.success("Production completed & stock updated");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>Complete production — {order.ref_no ?? order.id.slice(0, 8)}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Produced qty</Label>
            <Input
              type="number"
              step="any"
              value={producedQty}
              onChange={(e) => setProducedQty(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Wastage qty</Label>
            <Input
              type="number"
              step="any"
              value={wastageQty}
              onChange={(e) => setWastageQty(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Raw materials consumed</Label>
            {bomLines.length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLines([
                    ...lines,
                    {
                      product_id: "",
                      variation_id: "",
                      label: "",
                      planned_qty: 0,
                      actual_qty: 0,
                      unit_cost: 0,
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Add row
              </Button>
            )}
          </div>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Raw material</TableHead>
                  <TableHead className="w-28 text-right">Planned</TableHead>
                  <TableHead className="w-28 text-right">Actual</TableHead>
                  <TableHead className="w-28 text-right">Unit cost</TableHead>
                  <TableHead className="w-28 text-right">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {l.label ? (
                        l.label
                      ) : (
                        <Select
                          value={l.variation_id}
                          onValueChange={(v) => {
                            const vr = variations.find((x) => x.id === v);
                            const next = [...lines];
                            next[i] = {
                              ...next[i],
                              product_id: vr?.product_id ?? "",
                              variation_id: v,
                              label: `${vr?.product?.name ?? ""} · ${vr?.name ?? ""}`,
                              unit_cost:
                                next[i].unit_cost ||
                                Number(vr?.default_purchase_price ?? 0),
                            };
                            setLines(next);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {variations.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.product?.name} · {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{l.planned_qty}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        className="text-right"
                        value={l.actual_qty}
                        onChange={(e) => {
                          const next = [...lines];
                          next[i].actual_qty = Number(e.target.value);
                          setLines(next);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        className="text-right"
                        value={l.unit_cost}
                        onChange={(e) => {
                          const next = [...lines];
                          next[i].unit_cost = Number(e.target.value);
                          setLines(next);
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {fmt(l.actual_qty * l.unit_cost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-right text-sm text-muted-foreground mt-2">
            Total cost: <strong>{fmt(lines.reduce((s, l) => s + l.actual_qty * l.unit_cost, 0))}</strong>
            {" · "}Unit cost:{" "}
            <strong>
              {fmt(
                producedQty > 0
                  ? lines.reduce((s, l) => s + l.actual_qty * l.unit_cost, 0) / producedQty
                  : 0
              )}
            </strong>
            {" · "}Yield:{" "}
            <strong>
              {producedQty + wastageQty > 0
                ? ((producedQty / (producedQty + wastageQty)) * 100).toFixed(1)
                : 0}
              %
            </strong>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? "Completing…" : "Complete & update stock"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}