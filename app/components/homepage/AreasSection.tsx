"use client";

import { motion } from "framer-motion";
import { GitBranch, MessageSquareText, UserCheck, LucideIcon } from "lucide-react";

const SERIF = "'Playfair Display', Georgia, serif";

// ─── The three worlds: what the platform adds up ───────────────────────────────

function buildSmoothPath(points: [number, number][]) {
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const dx = (x - px) / 2;
    d += ` C ${px + dx},${py} ${x - dx},${y} ${x},${y}`;
  }
  return d;
}

const SPARK: [number, number][] = [[0, 44], [40, 50], [80, 36], [120, 40], [160, 26], [200, 30], [240, 16], [280, 10]];

// Illustrative figures. Each mini-widget is one series with its values written beside it, so
// nothing rests on colour alone.
function PortfolioWidget() {
  return (
    <div className="rounded-[6px] border p-4 min-h-[136px] flex flex-col justify-between" style={{ background: "#FDFCF8", borderColor: "#E0DACC" }}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: "#8A6A28" }}>Return, 1 year</span>
        <span className="text-[18px] font-bold leading-none" style={{ fontFamily: SERIF, color: "#1c1917" }}>+8.4%</span>
      </div>
      <svg viewBox="0 0 280 56" className="w-full h-[48px]" preserveAspectRatio="none" aria-hidden>
        <path d={buildSmoothPath(SPARK)} fill="none" stroke="#C49A3C" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between gap-3 whitespace-nowrap text-[10px] mt-2" style={{ color: "#857e78" }}>
        <span>Max drawdown −11.2%</span>
        <span>vs benchmark +1.3%</span>
      </div>
    </div>
  );
}

function CashWidget() {
  const spent = 432, limit = 600, pace = 80;
  const pct = Math.round((spent / limit) * 100);
  return (
    <div className="rounded-[6px] border p-4 min-h-[136px] flex flex-col justify-between" style={{ background: "#FDFCF8", borderColor: "#E0DACC" }}>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: "#8A6A28" }}>Budget · Groceries</span>
        <span className="text-[18px] font-bold leading-none" style={{ fontFamily: SERIF, color: "#1c1917" }}>€ {spent} <span className="text-[11px] font-normal" style={{ color: "#857e78" }}>of € {limit}</span></span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "#F0ECE2" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#C49A3C" }} />
        <div className="absolute top-0 bottom-0 w-px" style={{ left: `${pace}%`, background: "#1c1917" }} title="Expected pace to today" />
      </div>
      <div className="flex justify-between gap-3 whitespace-nowrap text-[10px] mt-2" style={{ color: "#857e78" }}>
        <span>{pct}% used, day 24 of 30</span>
        <span>Ahead of pace</span>
      </div>
    </div>
  );
}

function PropertyWidget() {
  const ltv = 38;
  return (
    <div className="rounded-[6px] border p-4 min-h-[136px] flex flex-col justify-between" style={{ background: "#FDFCF8", borderColor: "#E0DACC" }}>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: "#8A6A28" }}>Equity · Via Verdi 12</span>
        <span className="text-[18px] font-bold leading-none" style={{ fontFamily: SERIF, color: "#1c1917" }}>€ 262,000</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-[2px]">
        <div className="h-full rounded-full" style={{ width: `${100 - ltv}%`, background: "#C49A3C" }} />
        <div className="h-full rounded-full" style={{ width: `${ltv}%`, background: "#1c1917" }} />
      </div>
      <div className="flex justify-between gap-3 whitespace-nowrap text-[10px] mt-2" style={{ color: "#857e78" }}>
        <span>Debt € 158,000 · LTV {ltv}%</span>
        <span>Rent vs market +4%</span>
      </div>
    </div>
  );
}

interface World {
  title: string;
  lead: string;
  points: string[];
  widget: React.ReactNode;
}

const WORLDS: World[] = [
  {
    title: "Investment portfolios",
    lead: "Import your broker's file once; the AI maps the columns and remembers the layout. From then on the platform keeps the books.",
    points: [
      "Returns by horizon, drawdowns, monthly heatmap, synthetic benchmark",
      "Risk model, efficient frontier, correlation matrix, stress tests",
      "Explicit commissions and the implicit bid-ask spread of every trade",
      "Dividends, realised P&L, Italian capital-gains estimate with loss carry-forward",
    ],
    widget: <PortfolioWidget />,
  },
  {
    title: "Cash & spending",
    lead: "Current accounts, cards, savings and cash. Fed by hand, from a statement, or straight from your bank through read-only open banking.",
    points: [
      "Categories that learn from your corrections",
      "Monthly budgets with a pace line to today",
      "Recurring payments and what your subscriptions cost a year",
      "Alerts on balance, budget and single large payments",
    ],
    widget: <CashWidget />,
  },
  {
    title: "Real estate",
    lead: "A full property ledger, not a list of houses: mortgages, rents, Italian taxes and the market in your zone.",
    points: [
      "Equity, loan-to-value, gross yield and cash flow per property",
      "Amortisation schedules, early-repayment and refinancing simulators",
      "IMU, rental tax in both regimes, capital gain on a sale, real or simulated",
      "Official OMI prices for your zone, with your rent against the market",
    ],
    widget: <PropertyWidget />,
  },
];

// ─── The three layers: what sits on top of the worlds ──────────────────────────

interface Layer {
  icon: LucideIcon;
  title: string;
  body: string;
}

const LAYERS: Layer[] = [
  {
    icon: GitBranch,
    title: "Strategies & backtests",
    body: "A strategy is target weights plus a rebalancing rule. Test it on up to 40 years of real prices, adopt it, and get drift alerts with the rebalancing orders worked out. Browse the catalogue advisors publish to.",
  },
  {
    icon: MessageSquareText,
    title: "AI assistant & reports",
    body: "Ask about your money in plain language. Every figure comes from a tool that read your data; the model never calculates and never advises. An \"explain this\" button sits next to every chart, and a full PDF report is one request away.",
  },
  {
    icon: UserCheck,
    title: "Advisors",
    body: "Write your Investment Policy Statement, get matched with an advisor verified against the Italian OCF register, and let them work on your portfolios, share strategies and talk to you in a chat kept as MiFID II requires.",
  },
];

export default function AreasSection() {
  return (
    <section id="areas" className="border-b py-24 scroll-mt-20" style={{ background: "#F7F5EF", borderColor: "#e7e5e0" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-5 h-px" style={{ background: "#C49A3C" }} />
          <span className="text-[11px] font-medium tracking-[0.12em] uppercase" style={{ color: "#8A6A28" }}>
            What&apos;s inside
          </span>
        </div>
        <h2
          className="text-[clamp(26px,3.5vw,46px)] font-bold leading-[1.1] tracking-tight"
          style={{ fontFamily: SERIF, color: "#1c1917" }}
        >
          Three worlds you own.<br />Three ways to work on them.
        </h2>
        <p className="mt-3 mb-14 text-[14px] max-w-lg" style={{ color: "#78716c" }}>
          Each is a complete tool on its own. Together they add up to one picture of what you
          own, what it earns and what it costs you.
        </p>

        {/* The three worlds, with a mini-widget each */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {WORLDS.map((w, i) => (
            <motion.div
              key={w.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flex flex-col gap-5 p-7 border rounded-[4px] bg-white"
              style={{ borderColor: "#E0DACC" }}
            >
              {w.widget}
              <h3 className="text-[20px] font-bold leading-tight tracking-tight" style={{ fontFamily: SERIF, color: "#1c1917" }}>
                {w.title}
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: "#78716c" }}>{w.lead}</p>
              <ul className="flex flex-col gap-2 mt-auto pt-4 border-t" style={{ borderColor: "#F0ECE2" }}>
                {w.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[12px] leading-snug" style={{ color: "#57534e" }}>
                    <span className="shrink-0 mt-[1px] text-[11px]" style={{ color: "#C49A3C" }}>→</span>
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* The three layers, as one dark strip */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-px rounded-[4px] overflow-hidden border" style={{ background: "rgba(255,255,255,0.08)", borderColor: "#1c1917" }}>
          {LAYERS.map((l, i) => {
            const Icon = l.icon;
            return (
              <motion.div
                key={l.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
                className="p-7 flex flex-col gap-3"
                style={{ background: "#1c1917" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-[4px]" style={{ border: "1px solid rgba(196,154,60,0.3)" }}>
                    <Icon className="w-4 h-4" style={{ color: "#E8C97A" }} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-[17px] font-bold tracking-tight" style={{ fontFamily: SERIF, color: "#fff" }}>{l.title}</h3>
                </div>
                <p className="text-[13px] leading-[1.7]" style={{ color: "rgba(255,255,255,0.5)" }}>{l.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
