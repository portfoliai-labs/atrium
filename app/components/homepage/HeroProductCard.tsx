"use client";

import { motion } from "framer-motion";
import { TrendingUp, Sparkles } from "lucide-react";

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

const CHART_POINTS: [number, number][] = [
  [0, 78], [70, 84], [140, 66], [210, 72], [280, 50], [350, 56], [420, 34], [500, 24],
];

// The three worlds the platform adds up into one net worth. Illustrative figures.
const SLICES = [
  { label: "Investments",          value: "€ 128,940", share: 31, color: "#C49A3C" },
  { label: "Real estate (equity)", value: "€ 262,000", share: 64, color: "#1c1917" },
  { label: "Cash",                 value: "€ 21,440",  share: 5,  color: "#B8B0A2" },
];

export default function HeroProductCard() {
  return (
    <div className="relative" style={{ perspective: "1600px" }}>
      {/* Shadow and back-depth layers are static — never animated, always fully there from the
          first frame. Both used to fade in via opacity (independently of the front card and of
          each other), and both are dark/high-contrast against the page's cream background, so
          partway through any of those fades they already read as clearly "arrived" while the
          low-contrast white front card was still mostly transparent — looking like something
          dark sitting on top of / cutting across the card, for as long as the front card's own
          fade took. That's why the front card below doesn't animate opacity at all: it's fully
          opaque from frame one (sliding/scaling into place instead), which is the only way to
          guarantee it always fully occludes these two. */}
      <div
        className="absolute inset-0 rounded-[14px]"
        style={{ boxShadow: "0 60px 100px -30px rgba(28,25,23,0.28)", transform: "rotateY(-8deg) rotateX(3deg)" }}
      />
      <div
        className="absolute inset-0 rounded-[14px]"
        style={{
          background: "#1c1917",
          transform: "rotateY(-8deg) rotateX(3deg) translate(28px, 28px)",
        }}
      />
      {/* Front card — always fully opaque (see above); the entrance is a slide+scale settle
          driven entirely through framer-motion's own transform props (rotateY/rotateX included,
          held constant) rather than a static `transform` string, since motion takes over the
          whole `transform` property once any of x/y/rotate/scale are animated. */}
      <motion.div
        className="relative rounded-[14px] p-7"
        style={{
          background: "#fff", border: "1px solid #E0DACC", transformStyle: "preserve-3d",
          willChange: "transform",
        }}
        initial={{ y: 20, scale: 0.97, rotateY: -8, rotateX: 3 }}
        animate={{ y: 0, scale: 1, rotateY: -8, rotateX: 3 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "#8A6A28" }}>Net worth</span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(45,106,79,0.1)", color: "#2D6A4F" }}>
            <TrendingUp className="w-3 h-3" /> +0.6% today
          </span>
        </div>
        <div className="text-[40px] font-bold leading-none mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>
          € 412,380
        </div>

        <svg viewBox="0 0 500 100" className="w-full h-auto mb-5" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="heroProductCardGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C49A3C" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#C49A3C" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${buildSmoothPath(CHART_POINTS)} L 500,100 L 0,100 Z`} fill="url(#heroProductCardGrad)" />
          <path d={buildSmoothPath(CHART_POINTS)} fill="none" stroke="#C49A3C" strokeWidth="3" strokeLinecap="round" />
        </svg>

        {/* The one bar: how the net worth splits across the three worlds. */}
        <div className="flex h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "#F0ECE2" }}>
          {SLICES.map((s) => (
            <div key={s.label} style={{ width: `${s.share}%`, background: s.color }} />
          ))}
        </div>
        <ul className="flex flex-col gap-2 mb-5">
          {SLICES.map((s) => (
            <li key={s.label} className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-2" style={{ color: "#57534e" }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="flex items-baseline gap-3">
                <span className="font-semibold" style={{ color: "#1c1917" }}>{s.value}</span>
                <span className="w-8 text-right tabular-nums" style={{ color: "#a8a29e" }}>{s.share}%</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-start gap-3 rounded-[8px] p-4" style={{ background: "#F7F5EF" }}>
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#8A6A28" }} />
          <p className="text-[12px] leading-relaxed" style={{ color: "#78716c" }}>
            AI: today&apos;s gain comes from your tech holdings. The rent on Via Verdi is due in
            3 days. No alerts triggered.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
