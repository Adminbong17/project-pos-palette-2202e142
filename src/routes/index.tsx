import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { isRxMode } from "@/lib/rx-mode";

import {
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  Receipt,
  ShieldCheck,
  ArrowRight,
  Zap,
  Globe,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QweekPOS — Modern Point of Sale for Growing Businesses" },
      {
        name: "description",
        content:
          "Fast, reliable POS and inventory management. Sell, track stock, manage suppliers, and grow — all in one place.",
      },
      { property: "og:title", content: "QweekPOS — Modern Point of Sale" },
      {
        property: "og:description",
        content: "Sell faster, manage inventory smarter, and grow with confidence.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  useEffect(() => {
    if (isRxMode()) navigate({ to: "/prescriptions", replace: true });
  }, [navigate]);

  return (
    <div

      className="min-h-screen text-foreground"
      style={{
        background:
          "radial-gradient(1200px 600px at 80% -10%, #1a4a6e 0%, transparent 60%), radial-gradient(900px 500px at -10% 110%, #2d8a9e 0%, transparent 55%), #0c2340",
      }}
    >
      {/* Nav */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div
            className="grid h-9 w-9 place-items-center rounded-xl shadow-lg"
            style={{ background: "linear-gradient(135deg,#5cbdb9,#2d8a9e)" }}
          >
            <ShoppingCart className="h-5 w-5 text-[#0c2340]" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">QweekPOS</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#stats" className="hover:text-white">Why us</a>
          <a href="#cta" className="hover:text-white">Pricing</a>
        </nav>
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-[#0c2340] shadow-lg transition hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg,#5cbdb9,#2d8a9e)" }}
        >
          Sign in <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pt-10 pb-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#5cbdb9]/30 bg-[#1a4a6e]/40 px-3 py-1 text-xs font-medium text-[#5cbdb9] backdrop-blur">
          <Zap className="h-3.5 w-3.5" /> Built for modern retail
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-bold leading-[1.05] text-white sm:text-6xl md:text-7xl">
          Sell faster. <span style={{ color: "#5cbdb9" }}>Stock smarter.</span> Grow bolder.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70">
          An all-in-one POS &amp; inventory platform that turns the daily chaos of running a shop
          into a calm, beautiful flow.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-full px-6 py-3 text-base font-semibold text-[#0c2340] shadow-xl transition hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg,#5cbdb9,#2d8a9e)" }}
          >
            Get started free
          </Link>
          <a
            href="#features"
            className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            Explore features
          </a>
        </div>
      </section>

      {/* Bento Grid */}
      <section id="features" className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-[180px_180px_180px]">
          <BentoCard
            className="md:col-span-3 md:row-span-2"
            tint="from-[#2d8a9e]/40 to-[#1a4a6e]/40"
            icon={<ShoppingCart className="h-6 w-6" />}
            title="Lightning-fast POS"
            desc="Ring up sales in seconds with barcode scan, hotkeys, and smart product search. Touch-friendly on tablet, keyboard-first on desktop."
            big
          />
          <BentoCard
            className="md:col-span-3"
            tint="from-[#5cbdb9]/30 to-[#2d8a9e]/30"
            icon={<Package className="h-6 w-6" />}
            title="Live inventory"
            desc="Multi-location stock, auto-deduct on sale, low-stock alerts."
          />
          <BentoCard
            className="md:col-span-2"
            tint="from-[#1a4a6e]/40 to-[#0c2340]/40"
            icon={<Receipt className="h-6 w-6" />}
            title="Smart receipts"
            desc="Print, share or email — branded the way you want."
          />
          <BentoCard
            className="md:col-span-1"
            tint="from-[#5cbdb9]/40 to-[#2d8a9e]/40"
            icon={<Users className="h-6 w-6" />}
            title="Roles"
            desc="Admin, cashier, salesman."
          />
          <BentoCard
            className="md:col-span-2"
            tint="from-[#2d8a9e]/30 to-[#1a4a6e]/30"
            icon={<BarChart3 className="h-6 w-6" />}
            title="Reports that matter"
            desc="Profit, top sellers, supplier dues — at a glance."
          />
          <BentoCard
            className="md:col-span-2"
            tint="from-[#5cbdb9]/30 to-[#2d8a9e]/30"
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Secure by default"
            desc="Row-level security, encrypted at rest."
          />
          <BentoCard
            className="md:col-span-2"
            tint="from-[#1a4a6e]/40 to-[#0c2340]/40"
            icon={<Globe className="h-6 w-6" />}
            title="Anywhere access"
            desc="Cloud-synced across devices."
          />
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="mx-auto max-w-7xl px-6 pb-16">
        <div
          className="grid grid-cols-2 gap-4 rounded-3xl border border-white/10 p-8 md:grid-cols-4"
          style={{ background: "linear-gradient(135deg,rgba(26,74,110,0.6),rgba(12,35,64,0.6))" }}
        >
          <Stat n="10k+" label="Daily transactions" />
          <Stat n="99.9%" label="Uptime" />
          <Stat n="3s" label="Avg checkout" />
          <Stat n="24/7" label="Support" />
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="mx-auto max-w-5xl px-6 pb-24 text-center">
        <div
          className="rounded-3xl border border-[#5cbdb9]/20 p-12 shadow-2xl"
          style={{
            background:
              "radial-gradient(600px 300px at 50% -20%, rgba(92,189,185,0.25), transparent 60%), linear-gradient(135deg,#1a4a6e,#0c2340)",
          }}
        >
          <h2 className="text-4xl font-bold text-white sm:text-5xl">
            Ready to run a tighter shop?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Set up in minutes. No card required. Cancel anytime.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-bold text-[#0c2340] shadow-xl transition hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg,#5cbdb9,#2d8a9e)" }}
          >
            Start selling today <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-white/50">
        © {new Date().getFullYear()} QweekPOS · Crafted for retailers
      </footer>
    </div>
  );
}

function BentoCard({
  className = "",
  tint,
  icon,
  title,
  desc,
  big,
}: {
  className?: string;
  tint: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  big?: boolean;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${tint} p-6 backdrop-blur transition hover:border-[#5cbdb9]/40 hover:shadow-[0_0_40px_-10px_#5cbdb9] ${className}`}
    >
      <div
        className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#0c2340]"
        style={{ background: "linear-gradient(135deg,#5cbdb9,#2d8a9e)" }}
      >
        {icon}
      </div>
      <h3 className={`font-bold text-white ${big ? "text-2xl" : "text-lg"}`}>{title}</h3>
      <p className={`mt-2 text-white/70 ${big ? "text-base" : "text-sm"}`}>{desc}</p>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold sm:text-4xl" style={{ color: "#5cbdb9" }}>
        {n}
      </div>
      <div className="mt-1 text-sm text-white/60">{label}</div>
    </div>
  );
}
