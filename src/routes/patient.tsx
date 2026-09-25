import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, FileText, FlaskConical, LogOut, Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-date";
import {
  getPatientDashboard,
  requestPatientCode,
  verifyPatientCode,
} from "@/lib/patient-portal.functions";

const KEY = "patient-portal-token";

export const Route = createFileRoute("/patient")({
  head: () => ({
    meta: [
      { title: "Patient Dashboard — My Prescriptions & Reports" },
      { name: "description", content: "Log in with your mobile number to see your prescriptions, lab reports, appointments and bills." },
      { property: "og:title", content: "Patient Dashboard" },
      { property: "og:description", content: "Your prescriptions, lab reports, appointments and bills in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PatientPage,
});

function PatientPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setToken(localStorage.getItem(KEY));
    setReady(true);
  }, []);
  if (!ready) return null;
  return (
    <div className="min-h-screen bg-background">
      {token ? (
        <Dashboard token={token} onLogout={() => { localStorage.removeItem(KEY); setToken(null); }} />
      ) : (
        <Login onLogin={(t) => { localStorage.setItem(KEY, t); setToken(t); }} />
      )}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (t: string) => void }) {
  const request = useServerFn(requestPatientCode);
  const verify = useServerFn(verifyPatientCode);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await request({ data: { phone } });
      setStep("code");
      toast.success("আপনার মোবাইলে কোড পাঠানো হয়েছে");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const check = async () => {
    setBusy(true);
    try {
      const r = await verify({ data: { phone, code } });
      onLogin(r.token);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>রোগী লগইন</CardTitle>
          <p className="text-sm text-muted-foreground">
            ডাক্তারের কাছে যে মোবাইল নম্বর দিয়েছেন সেটি দিন।
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            inputMode="tel" placeholder="01XXXXXXXXX" value={phone} disabled={step === "code"}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && step === "phone" && send()}
          />
          {step === "code" && (
            <Input
              inputMode="numeric" placeholder="৬ ডিজিটের কোড" value={code} autoFocus maxLength={6}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && check()}
            />
          )}
          <Button className="w-full" disabled={busy} onClick={step === "phone" ? send : check}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {step === "phone" ? "কোড পাঠান" : "লগইন"}
          </Button>
          {step === "code" && (
            <button className="w-full text-sm text-muted-foreground underline" onClick={() => { setStep("phone"); setCode(""); }}>
              নম্বর বদলান
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const tk = (n: unknown) => `৳${Number(n ?? 0).toLocaleString("en-IN")}`;

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const fetchData = useServerFn(getPatientDashboard);
  const q = useQuery({
    queryKey: ["patient-dashboard", token],
    queryFn: () => fetchData({ data: { token } }),
    retry: false,
  });

  useEffect(() => {
    if (q.error && /log in/i.test(String((q.error as Error).message))) onLogout();
  }, [q.error, onLogout]);

  if (q.isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (q.error || !q.data) return <div className="p-6 text-center text-destructive">{String((q.error as Error)?.message ?? "Error")}</div>;
  const d = q.data;
  const due = d.bills.reduce((s: number, b: any) => s + Math.max(0, Number(b.total) - Number(b.paid)), 0);
  const upcoming = d.appointments.filter((a: any) => a.appt_date >= new Date().toISOString().slice(0, 10));

  const stats = [
    { label: "প্রেসক্রিপশন", value: d.prescriptions.length, icon: FileText },
    { label: "ল্যাব রিপোর্ট", value: d.labReports.length, icon: FlaskConical },
    { label: "আসন্ন সিরিয়াল", value: upcoming.length, icon: CalendarDays },
    { label: "বকেয়া", value: tk(due), icon: Receipt },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{d.name || "আমার ড্যাশবোর্ড"}</h1>
          <p className="text-sm text-muted-foreground">{d.phone}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}><LogOut className="mr-1 h-4 w-4" />লগআউট</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}><CardContent className="p-4">
            <s.icon className="mb-2 h-5 w-5 text-primary" />
            <div className="text-lg font-semibold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="rx">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rx">প্রেসক্রিপশন</TabsTrigger>
          <TabsTrigger value="lab">রিপোর্ট</TabsTrigger>
          <TabsTrigger value="appt">সিরিয়াল</TabsTrigger>
          <TabsTrigger value="bill">বিল</TabsTrigger>
        </TabsList>

        <TabsContent value="rx" className="space-y-3">
          {d.prescriptions.length === 0 && <Empty />}
          {d.prescriptions.map((r: any) => (
            <Card key={r.id}><CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <div className="font-medium">{r.doctor_name}</div>
                  <div className="text-xs text-muted-foreground">{r.doctor_qualification} · {r.clinic}</div>
                </div>
                <div className="text-right text-sm">
                  <div>{formatDate(r.rx_date)}</div>
                  <div className="text-xs text-muted-foreground">{r.rx_no}</div>
                </div>
              </div>
              {r.diagnosis && <p className="text-sm"><b>Dx:</b> {r.diagnosis}</p>}
              {r.lines.length > 0 && (
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {r.lines.map((l: any, i: number) => (
                    <li key={i}>
                      <span className="font-medium">{l.medicine_name}</span>
                      <span className="text-muted-foreground"> — {[l.dose || l.frequency, l.duration, l.instructions].filter(Boolean).join(" · ")}</span>
                    </li>
                  ))}
                </ol>
              )}
              {r.advice && <p className="whitespace-pre-line text-sm"><b>Advice:</b> {r.advice}</p>}
              {r.next_visit && <Badge variant="secondary">পরবর্তী ভিজিট: {r.next_visit}</Badge>}
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="lab" className="space-y-3">
          {d.labReports.length === 0 && <Empty />}
          {d.labReports.map((r: any) => (
            <Card key={r.id}><CardContent className="space-y-2 p-4">
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-medium">{r.test_name}</div>
                  <div className="text-xs text-muted-foreground">{r.department} · {r.clinic}</div>
                </div>
                <div className="text-sm">{formatDate(r.created_at)}</div>
              </div>
              {Array.isArray(r.rows) && r.rows.length > 0 && (
                <table className="w-full text-sm">
                  <tbody>
                    {r.rows.map((row: any, i: number) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-1">{row.name ?? row.test ?? row.label ?? ""}</td>
                        <td className="py-1 font-medium">{row.result ?? row.value ?? ""} {row.unit ?? ""}</td>
                        <td className="py-1 text-xs text-muted-foreground">{row.ref ?? row.range ?? row.reference ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="appt" className="space-y-2">
          {d.appointments.length === 0 && <Empty />}
          {d.appointments.map((a: any) => (
            <Card key={a.id}><CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{formatDate(a.appt_date)} {a.appt_time ?? ""}</div>
                <div className="text-xs text-muted-foreground">{a.clinic}{a.serial_no ? ` · সিরিয়াল #${a.serial_no}` : ""}</div>
              </div>
              <Badge variant="outline">{a.status}</Badge>
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="bill" className="space-y-3">
          {d.bills.length === 0 && d.plans.length === 0 && <Empty />}
          {d.bills.map((b: any) => {
            const left = Number(b.total) - Number(b.paid);
            return (
              <Card key={b.id}><CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">{b.invoice_no || "Invoice"}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(b.sale_date)} · {b.clinic}</div>
                </div>
                <div className="text-right text-sm">
                  <div>{tk(b.total)}</div>
                  {left > 0 ? <div className="text-xs text-destructive">বকেয়া {tk(left)}</div> : <div className="text-xs text-muted-foreground">পরিশোধিত</div>}
                </div>
              </CardContent></Card>
            );
          })}
          {d.plans.map((p: any) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">ট্রিটমেন্ট প্ল্যান — {tk(Number(p.total_amount) - Number(p.discount))}</CardTitle>
                <p className="text-xs text-muted-foreground">{formatDate(p.start_date)} · {p.clinic} · {p.status}</p>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {(p.clinic_plan_installments ?? []).sort((a: any, b: any) => a.seq - b.seq).map((i: any) => (
                  <div key={i.seq} className="flex justify-between border-t border-border pt-1">
                    <span>কিস্তি {i.seq} · {formatDate(i.due_date)}</span>
                    <span className={i.status === "paid" ? "text-muted-foreground" : "font-medium"}>
                      {tk(i.amount)} {i.status === "paid" ? "✓" : ""}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-muted-foreground">কিছু পাওয়া যায়নি</p>;
}
