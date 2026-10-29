"use client";

import { motion } from "framer-motion";

interface Stage {
  label: string;
  title: string;
  items: string[];
  current?: boolean;
}

// Where the platform stands and where it is going, as the platform map's roadmap puts it,
// without the internal dates: they are a proposal, not a promise to visitors.
const STAGES: Stage[] = [
  {
    label: "Today",
    title: "Open beta, free",
    current: true,
    items: [
      "Portfolios with the full analysis and the Italian tax estimate",
      "Strategies, backtests, catalogue and adoption with drift alerts",
      "Bank accounts with open banking, budgets and recurring payments",
      "Real estate ledger with mortgages, taxes and OMI market data",
      "AI assistant with PDF reports; advisor matching and chat",
      "Demo accounts for an investor and for an advisor",
    ],
  },
  {
    label: "Next",
    title: "First real users, first paid plan",
    items: [
      "A closed group of investors and advisors using it on real data",
      "The Pro plan, €49 a year, already open for the waitlist",
      "The mobile app for iOS and Android",
      "Export of all your data in one file",
    ],
  },
  {
    label: "Later",
    title: "Planning across everything you own",
    items: [
      "Saved goals and Monte Carlo projections on investments, cash and property together",
      "A benchmark you choose instead of the synthetic one",
      "Your data available to the AI clients you already use, under your consent",
      "Appointments and payments with advisors, inside the platform",
    ],
  },
];

export default function RoadmapSection() {
  return (
    <section id="roadmap" className="border-b scroll-mt-20 py-24" style={{ background: "#131210", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-5 h-px" style={{ background: "rgba(196,154,60,0.5)" }} />
          <span className="text-[11px] font-medium tracking-[0.12em] uppercase" style={{ color: "rgba(196,154,60,0.6)" }}>
            Where we are
          </span>
        </div>
        <h2
          className="text-[clamp(26px,3.5vw,46px)] font-bold leading-[1.1] tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fff" }}
        >
          Built far, shipped carefully.
        </h2>
        <p className="mt-3 mb-14 text-[14px] font-light max-w-lg" style={{ color: "rgba(255,255,255,0.35)" }}>
          The platform already covers more than a first user can try in a week. The work now
          is putting it in front of real people, in order.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px rounded-sm overflow-hidden border" style={{ background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.07)" }}>
          {STAGES.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="relative p-8 flex flex-col"
              style={{ background: s.current ? "rgba(196,154,60,0.05)" : "#131210" }}
            >
              <div className="flex items-center gap-2 mb-5">
                <span
                  className="text-[10px] font-semibold tracking-[0.12em] uppercase px-2 py-0.5 rounded-sm"
                  style={s.current
                    ? { background: "#C49A3C", color: "#1c1917" }
                    : { border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.4)" }}
                >
                  {s.label}
                </span>
              </div>
              <h3
                className="text-[20px] font-bold tracking-tight mb-5"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fff" }}
              >
                {s.title}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {s.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-[12.5px] leading-snug" style={{ color: s.current ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.38)" }}>
                    <span className="shrink-0 mt-0.5 text-[11px]" style={{ color: "rgba(196,154,60,0.55)" }}>→</span>
                    {it}
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
