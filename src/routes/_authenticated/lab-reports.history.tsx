import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintSizeButton } from "@/components/print-size-select";
import { printLabReport, type LabReportRow } from "@/lib/lab-report-print";

export const Route = createFileRoute("/_authenticated/lab-reports/history")({
  head: () => ({
    meta: [
      { title: "Lab Report History — Saved Patient Reports" },
      {
        name: "description",
        content:
          "Every lab report you made is saved here — search by patient name, patient ID or test and reprint it in A4, 80mm or 58mm.",
      },
      { property: "og:title", content: "Lab Report History — Saved Patient Reports" },
      {
        property: "og:description",
        content: "Search saved lab reports by patient or test and reprint any of them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LabHistoryPage,
});

function LabHistoryPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id ?? null;
  const qc = useQueryClient();
  const [term, setTerm] = useState("");

  const reports = useQuery({
    queryKey: ["lab-reports-history", businessId, term.trim()],
    enabled: !!businessId,
    queryFn: async () => {
      let q = supabase
        .from("lab_reports")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false })
        .limit(200);
      const t = term.trim();
      if (t) q = q.or(`patient_name.ilike.%${t}%,patient_code.ilike.%${t}%,test_name.ilike.%${t}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lab_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-reports-history"] });
      toast.success("Report deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete"),
  });

  function reprint(r: any, size: "A4" | "80mm" | "58mm") {
    printLabReport(
      {
        clinicName: business?.name ?? null,
        address: business?.address ?? null,
        phone: business?.notify_phone ?? null,
        testName: r.test_name,
        department: r.department,
        specimen: r.specimen,
        patientName: r.patient_name,
        patientCode: r.patient_code,
        age: r.age,
        gender: r.gender,
        phoneNo: r.phone_no,
        referredBy: r.referred_by,
        sampleNo: r.sample_no,
        collectedAt: r.collected_at_text,
        reportedAt: r.reported_at_text,
        comment: r.comment,
        techName: r.tech_name,
        techDesignation: r.tech_designation,
        pathologistName: r.pathologist_name,
        pathologistDesignation: r.pathologist_designation,
        ownPad: !!r.own_pad,
        rows: (r.rows ?? []) as LabReportRow[],
      },
      size,
    );
  }

  const rows = reports.data ?? [];

  return (
    <Card foldable>
      <CardHeader>
        <CardTitle className="text-base">Saved reports</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search patient name / ID / test…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-2 py-1.5 text-sm"
            >
              <div className="min-w-[200px]">
                <div className="font-medium">
                  {r.patient_name || "—"}
                  {r.patient_code ? <span className="text-muted-foreground"> · {r.patient_code}</span> : null}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {r.test_name}
                  {r.reported_at_text ? ` · ${r.reported_at_text}` : ""}
                  {r.sample_no ? ` · Sample ${r.sample_no}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <PrintSizeButton onPrint={(s) => reprint(r, s)} label="Reprint" defaultSize="A4" />
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {!reports.isLoading && rows.length === 0 && (
            <div className="text-xs text-muted-foreground">No saved reports yet — print a report to save it here.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
