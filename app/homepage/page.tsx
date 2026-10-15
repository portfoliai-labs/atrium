"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3, ArrowRight,
  TrendingUp, DollarSign, Activity, Shield, Scale,
  LayoutDashboard,
} from "lucide-react";
import FeatureCard from "../components/homepage/FeatureCard";
import SubscriptionSection from "../components/homepage/SubscriptionsSection";
import FaqSection from "../components/homepage/FaqSection";
import HeroProductCard from "../components/homepage/HeroProductCard";
import HowItWorksSection from "../components/homepage/HowItWorksSection";
import { BetaBadge } from "../components/common/BetaBadge";

const featuresData = [
  { icon: LayoutDashboard, title: "Daily Dashboard",       description: "Current value, unrealized P/L, composition and costs — refreshed once a day after markets close." },
  { icon: DollarSign,     title: "Cost Transparency",     description: "Explicit commissions and implicit bid-ask spreads broken down by broker, asset, and period. The true cost of every trade." },
  { icon: TrendingUp,     title: "Cash Flow & Dividends", description: "Historical deposits, withdrawals, buy/sell activity, and dividend income broken down by asset — yield, yield on cost, and YoY growth." },
  { icon: Activity,       title: "Performance & ROI",     description: "Monthly heatmaps, annual returns, trailing period performance, and comparison against a market benchmark — alpha, tracking error, and more." },
  { icon: Scale,          title: "Efficient Frontier",    description: "Mean-variance optimization, Max Sharpe and Min Volatility allocations, and an asset correlation matrix — where you stand vs. the theoretical optimum." },
  { icon: Shield,         title: "Risk & Volatility",     description: "21-day rolling volatility, max drawdown, Sharpe ratio, and a category-level breakdown of what's really driving your risk." },
];

const audienceData = [
  {
    number: "01", title: "Private Investors", role: "Self-directed",
    description: "Finally understand exactly what's happening inside your portfolio, day after day — with AI doing the reading so you don't have to.",
    features: ["Daily-updated dashboard", "AI-powered risk & performance insights", "Custom portfolio alerts", "Cost transparency by broker"],
    highlight: false,
  },
  {
    number: "02", title: "Financial Advisors", role: "Consultants & Wealth Managers",
    description: "Every client's portfolio tracked in one place, with AI surfacing what needs your attention before they have to ask.",
    features: ["Unified view of your whole book", "AI insights & risk profiling per client", "AUM tracking across clients", "Alerts across every portfolio"],
    highlight: true,
  },
];

function SectionEyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-5 h-px" style={{ background: light ? "rgba(196,154,60,0.5)" : "#C49A3C" }} />
      <span className="text-[11px] font-medium tracking-[0.12em] uppercase" style={{ color: light ? "rgba(196,154,60,0.6)" : "#8A6A28" }}>
        {children}
      </span>
    </div>
  );
}

function SectionHeading({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <h2 className="text-[clamp(26px,3.5vw,46px)] font-bold leading-[1.1] tracking-tight"
      style={{ fontFamily: "'Playfair Display', Georgia, serif", color: light ? "#fff" : "#1c1917" }}>
      {children}
    </h2>
  );
}

function CapabilityBadges() {
  const badges = ["Daily Dashboard", "AI-Powered Insights", "Portfolio Alerts"];
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {badges.map((label, i) => (
        <span key={label} className="flex items-center gap-3">
          {i > 0 && <span className="w-1 h-1 rounded-full" style={{ background: "#C49A3C" }} />}
          <span className="text-[11px] font-medium tracking-[0.08em] uppercase" style={{ color: "#78716c" }}>
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}

// ─── HERO — centered copy, wide dashboard panel beneath ─────────────────────────

function HeroSection({ onLogin }: { onLogin: () => void }) {
  return (
    <section
      className="border-b relative overflow-hidden flex-1 flex flex-col justify-center"
      style={{ background: "#F7F5EF", borderColor: "#E0DACC" }}
    >
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-100px", right: "-100px", width: "600px", height: "600px",
          background: "radial-gradient(circle, rgba(196,154,60,0.16) 0%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      <div className="relative w-full max-w-7xl mx-auto px-6 md:px-10 py-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Copy — left */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        >
          <SectionEyebrow>AI-Powered Portfolio Management</SectionEyebrow>

          <h1
            className="text-[clamp(36px,4.8vw,60px)] font-black leading-[1.05] tracking-tight mb-6"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
          >
            Command every<br />
            <em style={{ fontStyle: "italic", color: "#8A6A28" }}>angle</em> of your<br />
            portfolio.
          </h1>

          <p className="text-[15px] font-light leading-[1.8] max-w-md mb-8" style={{ color: "#78716c" }}>
            One upload, and PortfoliAI turns your broker statements into a living command
            deck — performance, risk, costs and alerts, read and explained by AI, updated
            every single day.
          </p>

          <div className="mb-9"><CapabilityBadges /></div>

          <div className="flex items-center gap-5 mb-12">
            <button onClick={onLogin}
              className="flex items-center gap-2 text-[13px] font-semibold px-6 py-3.5 rounded-[3px] transition-colors duration-200"
              style={{ background: "#1c1917", color: "#fafaf9" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2820")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#1c1917")}
            >
              Start Tracking Free <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-0 pt-7 border-t max-w-md" style={{ borderColor: "#E0DACC" }}>
            {[{ num: "Daily", label: "updates" }, { num: "AI", label: "analysis" }, { num: "100%", label: "cost transparency" }].map((s, i) => (
              <div key={i} className={`flex-1 ${i > 0 ? "pl-5 border-l" : ""}`} style={{ borderColor: "#E0DACC" }}>
                <div className="text-[22px] font-bold leading-none mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>{s.num}</div>
                <div className="text-[9px] uppercase tracking-[0.08em]" style={{ color: "#a8a29e" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Product card — right. No wrapping fade-in here: HeroProductCard already animates its
            own layers in (shadow, back depth card, front card) on mount. A wrapping opacity
            fade ABOVE it would multiply with those inner fades — including the shadow layer,
            which is deliberately static precisely so it's never dimmed by an ancestor's opacity
            — reintroducing the same "shadow outshines the still-fading card" flash from one
            level up. */}
        <HeroProductCard />
      </div>
    </section>
  );
}

// ─── FOR WHOM ──────────────────────────────────────────────────────────────────

function ForWhomSection() {
  return (
    <section id="audience" className="border-b scroll-mt-20 py-24" style={{ background: "#131210", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <SectionEyebrow light>Built for</SectionEyebrow>
        <SectionHeading light>One platform,<br />two ways to use it.</SectionHeading>
        <p className="mt-3 mb-14 text-[14px] font-light max-w-md" style={{ color: "rgba(255,255,255,0.3)" }}>
          Whether monitoring your own portfolio or every client&apos;s, automatically and continuously.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border rounded-sm overflow-hidden"
          style={{ borderColor: "rgba(255,255,255,0.07)", "--tw-divide-opacity": 1 } as React.CSSProperties}>
          {audienceData.map((card, i) => {
            return (
              <motion.div key={card.number}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative p-10 flex flex-col transition-colors duration-300"
                style={{ background: card.highlight ? "rgba(196,154,60,0.025)" : "transparent" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(196,154,60,0.04)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = card.highlight ? "rgba(196,154,60,0.025)" : "transparent"; }}
              >
                <span className="absolute top-5 right-6 text-[64px] font-black leading-none select-none pointer-events-none"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "rgba(255,255,255,0.04)" }}>{card.number}</span>
                <div className="text-[20px] font-bold mb-1 tracking-tight mt-6" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fff" }}>{card.title}</div>
                <div className="text-[10px] uppercase tracking-widest mb-4" style={{ color: "rgba(196,154,60,0.55)" }}>{card.role}</div>
                <p className="text-[13px] leading-[1.7] mb-6 flex-1" style={{ color: "rgba(255,255,255,0.35)" }}>{card.description}</p>
                <ul className="flex flex-col gap-2">
                  {card.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                      <span className="shrink-0 mt-0.5 text-[11px]" style={{ color: "rgba(196,154,60,0.45)" }}>→</span>{f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  // Routes into /login instead of triggering Google directly — the login page
  // is where the actual auth method (Google or email/password) gets chosen.
  const goToLogin = () => router.push("/login");

  return (
    <div className="min-h-screen font-sans overflow-hidden scroll-smooth" style={{ background: "#F7F5EF", color: "#1c1917" }}>

      {/* HEADER + HERO — sized to fill the viewport on any device */}
      <div className="flex flex-col" style={{ minHeight: "100dvh" }}>
        <header className="px-6 md:px-10 py-4 flex justify-between items-center sticky top-0 z-50 border-b backdrop-blur-md shrink-0"
          style={{ background: "rgba(250,248,242,0.94)", borderColor: "#e7e5e0" }}>
          <motion.div className="flex items-center gap-2.5" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <div className="w-7 h-7 flex items-center justify-center rounded-sm" style={{ background: "#1c1917" }}>
              <BarChart3 className="w-3.5 h-3.5" style={{ stroke: "#C49A3C" }} strokeWidth={2} />
            </div>
            <span className="text-[20px] font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>
              PortfoliAI
            </span>
            <BetaBadge />
          </motion.div>

          <nav className="hidden md:flex gap-7 text-[12px] font-normal uppercase tracking-[0.06em]">
            {[{ label: "Who it's for", href: "#audience" },
              { label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "FAQ", href: "#faq" }
            ].map((item) => (
              <a key={item.label} href={item.href} className="transition-colors duration-200" style={{ color: "#78716c" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#1c1917")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#78716c")}
              >{item.label}</a>
            ))}
          </nav>

          <motion.button onClick={goToLogin}
            className="text-[12px] font-semibold px-5 py-2.5 rounded-[3px] uppercase tracking-[0.05em] transition-colors duration-200"
            style={{ background: "#1c1917", color: "#fafaf9" }}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#292524")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1c1917")}
          >
            Sign In / Sign Up
          </motion.button>
        </header>

        <HeroSection onLogin={goToLogin} />
      </div>

      <HowItWorksSection />
      <ForWhomSection />

      {/* FEATURES — light */}
      <section id="features" className="border-b py-24 scroll-mt-20" style={{ background: "#F7F5EF", borderColor: "#e7e5e0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <SectionEyebrow>What&apos;s inside PortfoliAI</SectionEyebrow>
          <SectionHeading>Every angle,<br />covered.</SectionHeading>
          <p className="mt-3 mb-14 text-[14px] text-stone-400 max-w-sm">
            From the daily dashboard to the deepest risk analysis — AI keeps every angle within reach.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuresData.map((f, i) => <FeatureCard key={i} index={i} {...f} />)}
          </div>
        </div>
      </section>

      <SubscriptionSection onCta={goToLogin} />
      <FaqSection />

      {/* FOOTER */}
      <footer className="border-t py-12" style={{ background: "#131210", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-[18px] font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fafaf9" }}>
            <BarChart3 className="w-5 h-5" style={{ stroke: "#C49A3C" }} strokeWidth={1.5} />PortfoliAI
          </div>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.2)" }}>
            © {new Date().getFullYear()} PortfoliAI. All rights reserved.
          </p>
          <div className="flex gap-6">
            {[{ label: "Privacy Policy", href: "/privacy-policy" }, { label: "Terms of Service", href: "/terms-of-service" }].map((l) => (
              <a key={l.label} href={l.href} className="text-[11px] uppercase tracking-wider transition-colors duration-200" style={{ color: "rgba(255,255,255,0.25)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
              >{l.label}</a>
            ))}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 mt-8 pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.22)" }}>
            PortfoliAI&apos;s dashboard, insights and alerts include narrative analysis produced by an AI
            model, and are provided for informational and educational purposes only. Nothing on
            this site constitutes investment, tax, or legal advice, or a personalized recommendation
            under MiFID II. Past performance and simulated projections are not indicative of future
            results. Always verify figures independently and consult a licensed financial advisor
            before making investment decisions.
          </p>
        </div>
      </footer>
    </div>
  );
}
