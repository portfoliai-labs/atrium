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
  [0, 150], [70, 165], [140, 130], [210, 145], [280, 95], [350, 110], [420, 60], [500, 40],
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
          fade took. Worse, a translucent-during-its-fade front card doesn't just let something
          BEHIND it peek out at the edges, it lets it show straight THROUGH, tinting the whole
          card grey until the fade finishes. That's why the front card below doesn't animate
          opacity at all now: it's fully opaque from frame one (sliding/scaling into place
          instead), which is the only way to guarantee it always fully occludes these two. */}
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
          instead of a fade, driven entirely through framer-motion's own transform props
          (rotateY/rotateX included, held constant) rather than a static `transform` string,
          since motion takes over the whole `transform` property once any of x/y/rotate/scale
          are animated and would silently clobber a static one set alongside it. */}
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
        <div className="flex items-center justify-between mb-6">
          <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "#8A6A28" }}>Portfolio Value</span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(45,106,79,0.1)", color: "#2D6A4F" }}>
            <TrendingUp className="w-3 h-3" /> +1.8%
          </span>
        </div>
        <div className="text-[42px] font-bold leading-none mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>
          € 128,940
        </div>
        <svg viewBox="0 0 500 200" className="w-full h-auto mb-6" preserveAspectRatio="none">
          <defs>
            <linearGradient id="heroProductCardGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C49A3C" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#C49A3C" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${buildSmoothPath(CHART_POINTS)} L 500,200 L 0,200 Z`} fill="url(#heroProductCardGrad)" />
          <path d={buildSmoothPath(CHART_POINTS)} fill="none" stroke="#C49A3C" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="flex items-start gap-3 rounded-[8px] p-4" style={{ background: "#F7F5EF" }}>
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#8A6A28" }} />
          <p className="text-[12px] leading-relaxed" style={{ color: "#78716c" }}>
            AI: momentum in your tech holdings is driving today&apos;s gain — no alerts triggered.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
