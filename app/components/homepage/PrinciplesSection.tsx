"use client";

import { motion } from "framer-motion";

// How the platform treats the user's money and data. Each line is a rule the code enforces,
// as the platform map records it, not a marketing promise. A dense list, on purpose: after
// two sections of cards the eye needs text.
const PRINCIPLES = [
  {
    title: "Numbers from your data only",
    body: "Every figure the assistant quotes comes from a tool reading your records. The model never adds, converts or estimates a number itself.",
  },
  {
    title: "Analysis, never advice",
    body: "PortfoliAI tells you what is happening. What to do about it is yours, or your advisor's. Ask it what to buy and it points you to a licensed professional.",
  },
  {
    title: "A source on every fact",
    body: "Instrument profiles cite ESMA, the SEC, issuer documents and Wikipedia field by field. Market statistics show the method they were computed with.",
  },
  {
    title: "Read-only access to your bank",
    body: "Open banking under PSD2, with a consent you renew. Only the last four digits of your IBAN are kept. Nothing is ever moved or paid from here.",
  },
  {
    title: "Your data stays yours",
    body: "Delete your account and every part of the platform erases what it holds about you. No sale of data, no advertising.",
  },
  {
    title: "Honest about being a beta",
    body: "Free while we learn with a first group of users. The next section says exactly where things stand and what comes next.",
  },
];

export default function PrinciplesSection() {
  return (
    <section id="principles" className="border-b py-24 scroll-mt-20" style={{ background: "#FDFCF8", borderColor: "#e7e5e0" }}>
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        <div className="lg:col-span-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-5 h-px" style={{ background: "#C49A3C" }} />
            <span className="text-[11px] font-medium tracking-[0.12em] uppercase" style={{ color: "#8A6A28" }}>
              How we work
            </span>
          </div>
          <h2
            className="text-[clamp(26px,3.5vw,46px)] font-bold leading-[1.1] tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
          >
            Six rules<br />we don&apos;t bend.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "#78716c" }}>
            Money software earns trust slowly. These are written into the code, not into a policy page.
          </p>
        </div>

        <ol className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
          {PRINCIPLES.map((p, i) => (
            <motion.li
              key={p.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: (i % 2) * 0.06 }}
              className="grid grid-cols-[32px_1fr] gap-3 pt-5 border-t"
              style={{ borderColor: "#E0DACC" }}
            >
              <span className="text-[13px] font-bold tabular-nums pt-0.5" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#C49A3C" }}>
                0{i + 1}
              </span>
              <div>
                <h3 className="text-[16px] font-bold tracking-tight mb-1.5" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>
                  {p.title}
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "#78716c" }}>{p.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
