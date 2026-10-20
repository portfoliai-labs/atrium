import Link from "next/link";
import { BarChart3, ArrowLeft } from "lucide-react";
import { BetaBadge } from "../common/BetaBadge";

export function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen font-sans" style={{ background: "#F7F5EF", color: "#1c1917" }}>
      <header
        className="px-6 md:px-10 py-4 flex justify-between items-center border-b"
        style={{ background: "rgba(250,248,242,0.94)", borderColor: "#e7e5e0" }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center rounded-sm" style={{ background: "#1c1917" }}>
            <BarChart3 className="w-3.5 h-3.5" style={{ stroke: "#C49A3C" }} strokeWidth={2} />
          </div>
          <span
            className="text-[20px] font-bold tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
          >
            PortfoliAI
          </span>
          <BetaBadge />
        </Link>

        <Link
          href="/"
          className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] transition-colors duration-200"
          style={{ color: "#78716c" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to home
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        <h1
          className="text-[clamp(28px,4vw,42px)] font-bold tracking-tight mb-2"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h1>
        <p className="text-[12px] uppercase tracking-widest mb-12" style={{ color: "#857e78" }}>
          Last updated: {lastUpdated}
        </p>

        <div className="legal-content space-y-10">{children}</div>
      </main>

      <footer className="border-t py-10" style={{ background: "#131210", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-3xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-[16px] font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#fafaf9" }}>
            <BarChart3 className="w-4 h-4" style={{ stroke: "#C49A3C" }} strokeWidth={1.5} />
            PortfoliAI
          </div>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.2)" }}>
            © {new Date().getFullYear()} PortfoliAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="text-[19px] font-bold mb-3 tracking-tight"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}
      >
        {heading}
      </h2>
      <div className="text-[14px] leading-[1.75] space-y-3" style={{ color: "#4a4642" }}>
        {children}
      </div>
    </section>
  );
}
