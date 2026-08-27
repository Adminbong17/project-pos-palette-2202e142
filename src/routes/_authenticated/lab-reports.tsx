import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical, Search, Eraser, Plus, Trash2, UserSearch } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintSizeButton } from "@/components/print-size-select";
import { LAB_TESTS, type LabTest } from "@/lib/lab-tests";
import { printLabReport } from "@/lib/lab-report-print";


export const Route = createFileRoute("/_authenticated/lab-reports")({
  head: () => ({
    meta: [
      { title: "Lab Report Templates — Enter Results & Print" },
      {
        name: "description",
        content:
          "Ready-made laboratory report templates: pick a test, the analyte rows with units, reference ranges and methods are pre-filled — type only the patient result and print in A4, 80mm or 58mm.",
      },
      { property: "og:title", content: "Lab Report Templates — Enter Results & Print" },
      {
        property: "og:description",
        content: "Pick a test, type the results, print a finished lab report in A4, 80mm or 58mm.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LabReportsPage,
});

function nowLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function LabReportsPage() {
  const { data: business } = useCurrentBusiness();

  const [search, setSearch] = useState("");
  const [test, setTest] = useState<LabTest | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  const [patientName, setPatientName] = useState("");
  const [patientCode, setPatientCode] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [sampleNo, setSampleNo] = useState("");
  const [collectedAt, setCollectedAt] = useState(() => nowLocal());
  const [reportedAt, setReportedAt] = useState(() => nowLocal());
  const [comment, setComment] = useState("");
  const [techName, setTechName] = useState("");
  const [techDesignation, setTechDesignation] = useState("");
  const [pathoName, setPathoName] = useState("");
  const [pathoDesignation, setPathoDesignation] = useState("");

  const matches = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = s
      ? LAB_TESTS.filter((t) => t.name.toLowerCase().includes(s) || t.department.toLowerCase().includes(s))
      : LAB_TESTS;
    return list.slice(0, 60);
  }, [search]);

  function pick(t: LabTest) {
    setTest(t);
    setResults({});
  }

  function doPrint(size: "A4" | "80mm" | "58mm") {
    if (!test) return;
    printLabReport(
      {
        clinicName: business?.name ?? null,
        address: business?.address ?? null,
        phone: business?.notify_phone ?? null,
        testName: test.name,
        department: test.department,
        specimen: test.specimen ?? null,
        patientName,
        patientCode,
        age,
        gender,
        phoneNo,
        referredBy,
        sampleNo,
        collectedAt,
        reportedAt,
        comment,
        techName,
        techDesignation,
        pathologistName: pathoName,
        pathologistDesignation: pathoDesignation,
        rows: test.analytes.map((a) => ({
          name: a.name,
          result: results[a.name] ?? "",
          unit: a.unit,
          ref: a.ref,
          method: a.method,
        })),
      },
      size,
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <FlaskConical className="h-5 w-5" /> Lab Reports
        </h1>
        {test && <PrintSizeButton onPrint={(s) => doPrint(s)} label="Print report" defaultSize="A4" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card foldable>
          <CardHeader>
            <CardTitle className="text-base">Select test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search test / department…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              {LAB_TESTS.length.toLocaleString()} tests & services · showing {matches.length}
            </div>
            <div className="max-h-[420px] space-y-1 overflow-auto">
              {matches.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pick(t)}
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-sm transition-colors ${
                    test?.id === t.id ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted"
                  }`}
                >
                  <div className="font-medium">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t.department} · {t.analytes.length} parameter{t.analytes.length > 1 ? "s" : ""}
                    {t.price ? ` · ৳${t.price.toLocaleString()}` : ""}
                  </div>
                </button>
              ))}
              {matches.length === 0 && <div className="p-2 text-sm text-muted-foreground">No test matched.</div>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card foldable>
            <CardHeader>
              <CardTitle className="text-base">Patient & sample</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Input placeholder="Patient name" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
              <Input placeholder="Patient ID" value={patientCode} onChange={(e) => setPatientCode(e.target.value)} />
              <Input placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} />
              <Input placeholder="Sex (Male/Female)" value={gender} onChange={(e) => setGender(e.target.value)} />
              <Input placeholder="Contact no" value={phoneNo} onChange={(e) => setPhoneNo(e.target.value)} />
              <Input placeholder="Referred by (Dr.)" value={referredBy} onChange={(e) => setReferredBy(e.target.value)} />
              <Input placeholder="Sample no" value={sampleNo} onChange={(e) => setSampleNo(e.target.value)} />
              <Input placeholder="Collection date/time" value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} />
              <Input placeholder="Report date/time" value={reportedAt} onChange={(e) => setReportedAt(e.target.value)} />
            </CardContent>
          </Card>

          <Card foldable>
            <CardHeader>
              <CardTitle className="text-base">Signatures (optional)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Lab Technologist name" value={techName} onChange={(e) => setTechName(e.target.value)} />
              <Input placeholder="Technologist designation" value={techDesignation} onChange={(e) => setTechDesignation(e.target.value)} />
              <Input placeholder="Consultant Pathologist name" value={pathoName} onChange={(e) => setPathoName(e.target.value)} />
              <Input placeholder="Pathologist designation" value={pathoDesignation} onChange={(e) => setPathoDesignation(e.target.value)} />
            </CardContent>
          </Card>

          {test ? (
            <Card foldable>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {test.name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {test.department}
                    {test.specimen ? ` · ${test.specimen}` : ""}
                  </span>
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setResults({})}>
                  <Eraser className="mr-1 h-3.5 w-3.5" /> Clear results
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-1.5 pr-2">Test</th>
                        <th className="py-1.5 pr-2 w-[140px]">Result</th>
                        <th className="py-1.5 pr-2">Unit</th>
                        <th className="py-1.5 pr-2">Ref. Range</th>
                        <th className="py-1.5">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {test.analytes.map((a) => (
                        <tr key={a.name} className="border-b border-border/50">
                          <td className="py-1 pr-2 font-medium">{a.name}</td>
                          <td className="py-1 pr-2">
                            <Input
                              className="h-8"
                              value={results[a.name] ?? ""}
                              onChange={(e) => setResults((p) => ({ ...p, [a.name]: e.target.value }))}
                            />
                          </td>
                          <td className="py-1 pr-2 text-muted-foreground">{a.unit || "—"}</td>
                          <td className="py-1 pr-2 text-muted-foreground">{a.ref || "—"}</td>
                          <td className="py-1 text-muted-foreground">{a.method || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Input placeholder="Comment / interpretation (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="flex justify-end">
                  <PrintSizeButton onPrint={(s) => doPrint(s)} label="Print report" defaultSize="A4" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Pick a test on the left — its parameters, units, reference ranges and methods load automatically. Type
                only the patient results and print.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
