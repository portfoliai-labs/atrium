"use client";

import { motion } from "framer-motion";

// The three questions the platform exists to answer, each with its answer. The structure is
// the argument: a visitor recognises the question before reading what the product does.
const QUESTIONS = [
  {
    number: "01",
    question: "What am I worth, everything included?",
    answer: "See it whole",
    body: "One net worth that adds up your investment portfolios, your bank accounts and your property net of its mortgages, in your currency, revalued every day.",
  },
  {
    number: "02",
    question: "Is it doing well, after costs and taxes?",
    answer: "Understand it like a professional",
    body: "Time-weighted returns, a risk model with its efficient frontier, stress tests against three real crises, Monte Carlo projections, the implicit cost of every trade and an Italian tax estimate. On your own numbers.",
  },
  {
    number: "03",
    question: "And what should change?",
    answer: "Act with a plan, not a hunch",
    body: "Backtest a strategy over decades of real prices, adopt it, and be told when your allocation drifts, with the rebalancing orders already worked out. Or share it all with a verified advisor who works on your portfolios with you.",
  },
];

export default function MissionSection() {
  return (
    <section id="why" className="border-b scroll-mt-20 py-24" style={{ background: "#131210", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-5 h-px" style={{ background: "rgba(196,154,60,0.5)" }} />
            <span className="text-[11px] font-medium tracking-[0.12em] uppercase" style={{ color: "rgba(196,154,60,0.6)" }}>
              Why PortfoliAI exists
            </span>
          </div>
          <h2
            className="text-[clamp(26px,3.5vw,46px)] font-bold leading-[1.1] tracking-tight mb-5"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fff" }}
          >
            Three questions most people can&apos;t answer about their own money.
          </h2>
          <p className="text-[15px] font-light leading-[1.8]" style={{ color: "rgba(255,255,255,0.45)" }}>
            The answers sit in broker statements, bank apps, mortgage schedules and spreadsheets
            that never meet. PortfoliAI exists to answer them, from your data, every day.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px border rounded-sm overflow-hidden" style={{ background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.07)" }}>
          {QUESTIONS.map((q, i) => (
            <motion.div
              key={q.number}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flex flex-col p-8"
              style={{ background: "#131210" }}
            >
              <span
                className="text-[28px] font-bold leading-none mb-6"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#C49A3C" }}
              >
                {q.number}
              </span>
              <p
                className="text-[20px] font-bold leading-[1.25] tracking-tight mb-6"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fff" }}
              >
                {q.question}
              </p>
              <div className="mt-auto pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="text-[11px] font-medium tracking-[0.1em] uppercase mb-2" style={{ color: "#E8C97A" }}>
                  {q.answer}
                </div>
                <p className="text-[13px] leading-[1.75]" style={{ color: "rgba(255,255,255,0.42)" }}>{q.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
