// components/dashboard/PortfolioGroupCard.tsx
"use client";

/**
 * PORTFOLIO GROUP CARD — one portfolio's (or wallet's, `eyebrow`) share of a page that lists
 * every one's things (Investments' and Wallets' Alerts): its colour across the top, its name
 * large, a line about what's in it, its own action on the right (New alert), then its content.
 */
export function PortfolioGroupCard({ name, eyebrow = "Portfolio", color, subtitle, right, children }: {
  name: string;
  eyebrow?: string;
  color?: string;
  subtitle: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const accent = color ?? "#C49A3C";
  return (
    <section className="bg-white rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: accent }} />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-6 md:px-8 pt-6 pb-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#a8a29e] mb-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
            {eyebrow}
          </p>
          <h3 className="text-2xl md:text-[1.75rem] leading-tight font-black text-[#1c1917] truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {name}
          </h3>
          <p className="text-[13px] font-semibold text-[#78716c] mt-1.5">{subtitle}</p>
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
      {children}
    </section>
  );
}
