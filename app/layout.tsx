import type { Metadata } from "next";
import "./globals.css";
import { Playfair_Display } from "next/font/google";
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://portfoliai.online";
const SITE_TITLE = "PortfoliAI: All of Your Wealth, Understood";
const SITE_DESCRIPTION = "Investment portfolios, bank accounts and property in one place, analysed with professional tools: returns, risk, costs, taxes and projections. An AI assistant that only quotes your real figures, and verified advisors when you want one.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | PortfoliAI",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: "PortfoliAI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}