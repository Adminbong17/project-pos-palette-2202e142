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
  const [ownPad, setOwnPad] = useState(false);

  const businessId = business?.id ?? null;
  const qc = useQueryClient();

  // ---- Patient lookup (by patient ID or name, from printed prescriptions) ----
  const [patientSearch, setPatientSearch] = useState("");
  const patientLookup = useQuery({
    queryKey: ["lab-patient-lookup", businessId, patientSearch.trim()],
    enabled: !!businessId && patientSearch.trim().length >= 2,
    queryFn: async () => {
      const term = patientSearch.trim();
      const { data, error } = await supabase
        .from("prescriptions")
        .select("patient_code, patient_name, patient_phone, patient_age, patient_gender, doctor_name, created_at")
        .eq("business_id", businessId!)
        .or(`patient_code.ilike.%${term}%,patient_name.ilike.%${term}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const seen = new Set<string>();
      const rows: any[] = [];
      for (const r of (data ?? []) as any[]) {
        const key = `${r.patient_code ?? ""}|${r.patient_name ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(r);
        if (rows.length >= 10) break;
      }
      return rows;
    },
  });

  function applyPatient(p: any) {
    setPatientName(p.patient_name ?? "");
    setPatientCode(p.patient_code ?? "");
    setAge(p.patient_age ?? "");
    setGender(p.patient_gender ?? "");
    setPhoneNo(p.patient_phone ?? "");
    if (p.doctor_name) setReferredBy(p.doctor_name);
    setPatientSearch("");
  }

  // ---- Appointed lab signatories ----
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

  const techs = (signatories.data ?? []).filter((s) => s.kind === "technologist");
  const pathos = (signatories.data ?? []).filter((s) => s.kind === "pathologist");

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
        ownPad,
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
            <CardContent className="space-y-2">
              <div className="relative">
                <UserSearch className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search patient by ID or name — select to auto-fill everything"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                />
                {patientSearch.trim().length >= 2 && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
                    {(patientLookup.data ?? []).map((p: any, i: number) => (
                      <button
                        key={`${p.patient_code}-${i}`}
                        type="button"
                        onClick={() => applyPatient(p)}
                        className="block w-full px-2 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-medium">{p.patient_name}</span>
                        <span className="text-muted-foreground">
                          {p.patient_code ? ` · ${p.patient_code}` : ""}
                          {p.patient_age ? ` · ${p.patient_age}` : ""}
                          {p.patient_gender ? ` · ${p.patient_gender}` : ""}
                          {p.patient_phone ? ` · ${p.patient_phone}` : ""}
                        </span>
                      </button>
                    ))}
                    {!patientLookup.isLoading && (patientLookup.data ?? []).length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No patient matched.</div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">

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
              <CardTitle className="text-base">Signatures & pad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Lab Technologist</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-input px-2 text-sm"
                    value={techName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTechName(v);
                      const f = techs.find((s) => s.name === v);
                      setTechDesignation(f?.designation ?? "");
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
                  <Input
                    placeholder="Technologist designation"
                    value={techDesignation}
                    onChange={(e) => setTechDesignation(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Consultant Pathologist</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-input px-2 text-sm"
                    value={pathoName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPathoName(v);
                      const f = pathos.find((s) => s.name === v);
                      setPathoDesignation(f?.designation ?? "");
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
                  <Input
                    placeholder="Pathologist designation"
                    value={pathoDesignation}
                    onChange={(e) => setPathoDesignation(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-md border border-border/60 p-2">
                <Switch id="lab-own-pad" checked={ownPad} onCheckedChange={setOwnPad} />
                <Label htmlFor="lab-own-pad" className="text-sm">
                  Own pad
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {ownPad ? "1.5 inch blank top space (A4), no clinic header" : "Print clinic header"}
                  </span>
                </Label>
              </div>

              <div className="space-y-2 rounded-md border border-border/60 p-2">
                <div className="text-xs font-medium">Appointed lab staff</div>
                <div className="grid gap-2 sm:grid-cols-[130px_1fr_1fr_auto]">
                  <select
                    className="h-9 rounded-md border border-input bg-input px-2 text-sm"
                    value={newSig.kind}
                    onChange={(e) => setNewSig((p) => ({ ...p, kind: e.target.value }))}
                  >
                    <option value="technologist">Technologist</option>
                    <option value="pathologist">Pathologist</option>
                  </select>
                  <Input
                    placeholder="Name"
                    value={newSig.name}
                    onChange={(e) => setNewSig((p) => ({ ...p, name: e.target.value }))}
                  />
                  <Input
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
                        <span className="font-medium">{s.name}</span>
                        {s.designation ? <span className="text-muted-foreground"> · {s.designation}</span> : null}
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
              </div>
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
