import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Stethoscope,
  FileText,
  Users,
  Printer,
  ClipboardList,
  ShieldCheck,
  ArrowRight,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/rx")({
  head: () => ({
    meta: [
      { title: "QweekRx — Digital Prescription Software for Doctors" },
      {
        name: "description",
        content:
          "Write, print and manage prescriptions in seconds. Patient queue with tokens, chamber-wise fees, chief complaints, investigations and advice presets.",
      },
      { property: "og:title", content: "QweekRx — Digital Prescription for Doctors" },
      {
        property: "og:description",
        content:
          "A clean prescription pad for chambers and clinics: patient tokens, presets, A4/58mm/80mm printing and PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RxLanding,
});

function RxLanding() {
  return (
    <div
      className="min-h-screen text-foreground"
      style={{
        background:
          "radial-gradient(1100px 550px at 85% -10%, #10505a 0%, transparent 60%), radial-gradient(900px 500px at -10% 110%, #1f7a6b 0%, transparent 55%), #06212a",
      }}
    >
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div
            className="grid h-9 w-9 place-items-center rounded-xl shadow-lg"
            style={{ background: "linear-gradient(135deg,#7ee0c7,#22a08a)" }}
          >
            <Stethoscope className="h-5 w-5 text-[#06212a]" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">QweekRx</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
        </nav>
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-[#06212a] shadow-lg transition hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg,#7ee0c7,#22a08a)" }}
        >
          Doctor sign in <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-8 pb-14 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#7ee0c7]/30 bg-[#10505a]/40 px-3 py-1 text-xs font-medium text-[#7ee0c7] backdrop-blur">
          <Clock className="h-3.5 w-3.5" /> A prescription in under 30 seconds
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.08] text-white sm:text-5xl md:text-6xl">
          Your prescription pad, <span style={{ color: "#7ee0c7" }}>digitised</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-white/70">
          Built for chambers and clinics in Bangladesh — patient tokens, chamber-wise fees, your own
          C/C, investigation, advice and frequency lists, and clean printing on A4, 80mm or 58mm.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-full px-6 py-3 text-base font-semibold text-[#06212a] shadow-xl transition hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg,#7ee0c7,#22a08a)" }}
          >
            Start writing prescriptions
          </Link>
          <a
            href="#features"
            className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            See how it works
          </a>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            icon={<FileText className="h-6 w-6" />}
            title="Smart Rx pad"
            desc="Medicine search over your full catalogue, frequency + duration presets, and auto total-pieces calculation."
          />
          <Card
            icon={<ClipboardList className="h-6 w-6" />}
            title="Your own lists"
            desc="Chief complaints, investigations, advice and instructions — use the built-in library or manage your own."
          />
          <Card
            icon={<Users className="h-6 w-6" />}
            title="Assistant &amp; queue"
            desc="Your staff take serials location-wise, print patient tokens, and the queue lands on your dashboard."
          />
          <Card
            icon={<Printer className="h-6 w-6" />}
            title="Print &amp; PDF"
            desc="A4 with 40/60 layout, 80mm and 58mm thermal, plus PDF. Using your own pad? Toggle the top margin."
          />
          <Card
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Private by design"
            desc="Every doctor sees only their own patients and prescriptions. Assistants see only their chamber."
          />
          <Card
            icon={<Stethoscope className="h-6 w-6" />}
            title="Patient history"
            desc="Auto patient IDs, new / old / medical-person types and searchable visit history by ID, name or phone."
          />
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-4xl px-6 pb-24 text-center">
        <div
          className="rounded-3xl border border-[#7ee0c7]/20 p-10 shadow-2xl"
          style={{
            background:
              "radial-gradient(600px 300px at 50% -20%, rgba(126,224,199,0.22), transparent 60%), linear-gradient(135deg,#10505a,#06212a)",
          }}
        >
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Pay only for what you write</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Tier n="৳5" label="First 100 prescriptions / month" />
            <Tier n="৳4" label="Above 100 — all of them" />
            <Tier n="৳3" label="Above 200 — all of them" />
          </div>
          <p className="mt-6 text-sm text-white/60">
            Monthly bill by SMS. Credit packs and free access are also available.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-bold text-[#06212a] shadow-xl transition hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg,#7ee0c7,#22a08a)" }}
          >
            Create my Rx pad <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-white/50">
        QweekRx {new Date().getFullYear()} · 01712472839 (Phone/WhatsApp)
      </footer>
    </div>
  );
}

function Card({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:border-[#7ee0c7]/40 hover:shadow-[0_0_40px_-12px_#7ee0c7]">
      <div
        className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#06212a]"
        style={{ background: "linear-gradient(135deg,#7ee0c7,#22a08a)" }}
      >
        {icon}
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/70">{desc}</p>
    </div>
  );
}

function Tier({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-3xl font-bold" style={{ color: "#7ee0c7" }}>
        {n}
      </div>
      <div className="mt-1 text-xs text-white/60">{label}</div>
    </div>
  );
}
