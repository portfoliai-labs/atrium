// lib/origins.ts
//
// Where the browser reaches the platform. A self-hosted install serves atrium, the API (/v1) and
// the authentication (/auth/v1) from one address behind its nginx (forum's deploy/), so the
// defaults are this page's own origin and one image fits every install; a build given
// NEXT_PUBLIC_API_URL or NEXT_PUBLIC_SUPABASE_URL (development's next dev on :3000, a deployment
// with the API elsewhere) uses those.

// "" makes every call relative to the page: /v1/... on the same origin.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// The Supabase SDK needs an absolute URL (it appends /auth/v1). On the server, during the build
// or a prerender, there is no page: a placeholder no request goes to.
export const AUTH_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost");

// The local authentication reads no key (Supabase's own gateway does): any value serves there.
export const AUTH_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "self-hosted";
