import { motion } from "framer-motion";

interface Step {
  title: string;
  description: string;
  highlight?: boolean;
}

const STEPS: Step[] = [
  {
    title: "Bring your data in",
    description: "Upload your broker's CSV or Excel export, connect your bank, add your home with its mortgage. The AI maps the columns; you confirm once.",
  },
  {
    title: "Everything is valued, every day",
    description: "Prices, exchange rates and interest rates from market data with the source cited. Positions revalued through the day, the full history rebuilt every night.",
  },
  {
    title: "Read it, and ask",
    description: "Insights widgets with a detail page behind each one. Next to every chart, a button that asks the assistant to explain what you're looking at, from your data.",
  },
  {
    title: "Act, or get help",
    description: "Set alerts, adopt a strategy and be told when you drift from it, or share your policy with a verified advisor and work on the plan together.",
    highlight: true,
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-b py-24 scroll-mt-20" style={{ background: "#FDFCF8", borderColor: "#e7e5e0" }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-5 h-px" style={{ background: "#C49A3C" }} />
          <span className="text-[11px] font-medium tracking-[0.12em] uppercase" style={{ color: "#8A6A28" }}>
            How it works
          </span>
        </div>
        <h2
          className="text-[clamp(26px,3.5vw,46px)] font-bold leading-[1.1] tracking-tight mb-3"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
        >
          Set it up once.<br />Then it keeps the books for you.
        </h2>
        <p className="mb-14 text-[14px] font-light max-w-lg" style={{ color: "#78716c" }}>
          No spreadsheet to maintain, no analysis to run by hand. You bring the data in once and
          add to it as life happens; PortfoliAI does the rest.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-px" style={{ background: "#e7e5e0" }}>
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative flex flex-col p-7"
              style={{ background: step.highlight ? "#1c1917" : "#FDFCF8" }}
            >
              <span
                className="text-[34px] font-bold leading-none mb-5"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: step.highlight ? "#C49A3C" : "#E0DACC" }}
              >
                0{i + 1}
              </span>
              <h3
                className="text-[16px] font-bold mb-2 tracking-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: step.highlight ? "#fff" : "#1c1917" }}
              >
                {step.title}
              </h3>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: step.highlight ? "rgba(255,255,255,0.5)" : "#78716c" }}
              >
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
