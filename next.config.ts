import type { NextConfig } from "next";

// Sent with every page (forum's service map, "Security review before publishing", 15). Only the
// directives that restrict nothing the app loads: no other site may frame a page (a click on
// "Confirm" under someone else's overlay), no plugin, no <base> or form posting elsewhere. A
// policy on scripts and connections (nonces, every API, wallet and image origin) is left for
// later: one missed origin breaks a page.
const contentSecurityPolicy = [
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // frame-ancestors' predecessor, for browsers that don't read it.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Another site sees where its visitor came from, never the page (a report's id, a query).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Dominio tipico delle foto Google
        port: '',
        pathname: '/**',
      },
      // Aggiungi altri domini se necessario
    ],
  },
};

export default nextConfig;
