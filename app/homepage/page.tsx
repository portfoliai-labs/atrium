"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, ArrowRight } from "lucide-react";
import SubscriptionSection from "../components/homepage/SubscriptionsSection";
import FaqSection from "../components/homepage/FaqSection";
import HeroProductCard from "../components/homepage/HeroProductCard";
import HowItWorksSection from "../components/homepage/HowItWorksSection";
import MissionSection from "../components/homepage/MissionSection";
import AreasSection from "../components/homepage/AreasSection";
import PrinciplesSection from "../components/homepage/PrinciplesSection";
import RoadmapSection from "../components/homepage/RoadmapSection";
import { BetaBadge } from "../components/common/BetaBadge";

const audienceData = [
  {
    number: "01", title: "Private Investors", role: "Self-directed",
    description: "One account for your portfolios, your cash and your property. The analysis a professional would run, without the spreadsheet, and an assistant that knows your numbers and nothing else.",
    features: [
      "Net worth across investments, cash and property",
      "Returns, risk, costs and taxes, past and projected",
      "Strategies with backtests and drift alerts",
      "An AI assistant restricted to your own data",
    ],
    highlight: false,
  },
  {
    number: "02", title: "Financial Advisors", role: "Consultants & Wealth Managers",
    description: "Your clients' portfolios in one place, a verified profile, and strategies you can backtest, publish and apply to a client's portfolio with the client watching.",
    features: [
      "Every client's portfolios, insights and alerts",
      "Verified through your OCF registration",
      "Adopt a strategy on a client's portfolio and share it",
      "Chat with clients, records kept per MiFID II",
      "Publish strategies and articles",
    ],
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

// Three facts from inside the product. Real numbers, not slogans: they say "there is substance
// behind this" better than any adjective.
const HERO_FACTS = [
  { num: "40 yrs", label: "of prices behind every backtest" },
  { num: "3", label: "real crises in every stress test" },
  { num: "10,000", label: "scenarios in every projection" },
];

// ─── HERO ──────────────────────────────────────────────────────────────────────

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
          <SectionEyebrow>Investments, cash and property</SectionEyebrow>

          <h1
            className="text-[clamp(36px,4.8vw,60px)] font-black leading-[1.05] tracking-tight mb-6"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
          >
            All of your wealth,<br />
            in one place,<br />
            <em style={{ fontStyle: "italic", color: "#8A6A28" }}>understood.</em>
          </h1>

          <p className="text-[16px] font-light leading-[1.7] max-w-md mb-3" style={{ color: "#57534e" }}>
            Portfolios, bank accounts and property in one view, analysed the way a
            professional would.
          </p>
          <p className="text-[15px] font-light leading-[1.7] max-w-md mb-9" style={{ color: "#78716c" }}>
            An AI assistant that only quotes your real figures. A verified advisor when you want one.
          </p>

          <div className="flex items-center gap-5 mb-12 flex-wrap">
            <button onClick={onLogin}
              className="flex items-center gap-2 text-[13px] font-semibold px-6 py-3.5 rounded-[3px] transition-colors duration-200"
              style={{ background: "#1c1917", color: "#fafaf9" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2820")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#1c1917")}
            >
              Start free <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={onLogin}
              className="text-[13px] font-semibold transition-colors duration-200 underline-offset-4 hover:underline"
              style={{ color: "#8A6A28" }}
            >
              Try the demo account
            </button>
          </div>

          <div className="flex gap-0 pt-7 border-t max-w-md" style={{ borderColor: "#E0DACC" }}>
            {HERO_FACTS.map((s, i) => (
              <div key={s.num} className={`flex-1 ${i > 0 ? "pl-5 border-l" : ""}`} style={{ borderColor: "#E0DACC" }}>
                <div className="text-[22px] font-bold leading-none mb-1.5" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>{s.num}</div>
                <div className="text-[10px] leading-snug" style={{ color: "#857e78" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Product card — right. No wrapping fade-in here: HeroProductCard already animates its
            own layers in. A wrapping opacity fade above it would multiply with those inner fades,
            including the deliberately static shadow layer. */}
        <HeroProductCard />
      </div>
    </section>
  );
}

// ─── FOR WHOM ──────────────────────────────────────────────────────────────────

function ForWhomSection() {
  return (
    <section id="audience" className="border-b scroll-mt-20 py-24" style={{ background: "#F7F5EF", borderColor: "#e7e5e0" }}>
      <div className="max-w-6xl mx-auto px-6">
        <SectionEyebrow>Built for</SectionEyebrow>
        <SectionHeading>One platform,<br />two ways to use it.</SectionHeading>
        <p className="mt-3 mb-14 text-[14px] font-light max-w-md" style={{ color: "#78716c" }}>
          Whether you look after your own money or your clients&apos;, and the two can meet in the middle.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border rounded-sm overflow-hidden"
          style={{ borderColor: "#e7e5e0" }}>
          {audienceData.map((card, i) => (
            <motion.div key={card.number}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: i * 0.08 }}
              className="relative p-10 flex flex-col"
              style={{ background: card.highlight ? "#1c1917" : "#FDFCF8", borderColor: "#e7e5e0" }}
            >
              <span className="absolute top-5 right-6 text-[64px] font-black leading-none select-none pointer-events-none"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: card.highlight ? "rgba(255,255,255,0.05)" : "rgba(28,25,23,0.05)" }}>{card.number}</span>
              <div className="text-[20px] font-bold mb-1 tracking-tight mt-6" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: card.highlight ? "#fff" : "#1c1917" }}>{card.title}</div>
              <div className="text-[10px] uppercase tracking-widest mb-4" style={{ color: card.highlight ? "rgba(196,154,60,0.7)" : "#8A6A28" }}>{card.role}</div>
              <p className="text-[13px] leading-[1.7] mb-6 flex-1" style={{ color: card.highlight ? "rgba(255,255,255,0.5)" : "#78716c" }}>{card.description}</p>
              <ul className="flex flex-col gap-2">
                {card.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12px]" style={{ color: card.highlight ? "rgba(255,255,255,0.55)" : "#57534e" }}>
                    <span className="shrink-0 mt-0.5 text-[11px]" style={{ color: "#C49A3C" }}>→</span>{f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  // Routes into /login instead of triggering Google directly — the login page is where the
  // actual auth method (Google or email/password) gets chosen, and where the two read-only
  // demo accounts live.
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

          <nav className="hidden md:flex gap-6 text-[12px] font-normal uppercase tracking-[0.06em]">
            {[
              { label: "Why", href: "#why" },
              { label: "What's inside", href: "#areas" },
              { label: "How it works", href: "#how-it-works" },
              { label: "Who it's for", href: "#audience" },
              { label: "Where we are", href: "#roadmap" },
              { label: "Pricing", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
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

      {/* The page reads top-down as an argument: why it exists, what it contains, how it
          works, who it is for, the rules it keeps, where it stands, what it costs. */}
      <MissionSection />
      <AreasSection />
      <HowItWorksSection />
      <ForWhomSection />
      <PrinciplesSection />
      <RoadmapSection />
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
            PortfoliAI&apos;s dashboards, insights, assistant and reports include narrative analysis
            produced by an AI model and are provided for informational and educational purposes
            only. Tax figures are estimates, not a tax return. Backtests and projections are
            simulations, net of trading costs only. Nothing on this site constitutes investment,
            tax, or legal advice, or a personalised recommendation under MiFID II. Past
            performance and simulated results are not indicative of future results. Always
            verify figures independently and consult a licensed professional before making
            financial decisions.
          </p>
        </div>
      </footer>
    </div>
  );
}
