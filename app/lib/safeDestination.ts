// lib/safeDestination.ts
//
// Where to go once signed in (`next` on /login and /auth/callback), from the address' query
// string: anyone can write it, so only a path on this site is followed ("/dashboard/..."), never
// another site ("https://...", "//host", "/\host", which browsers read as "//host"). Anything else
// goes to the dashboard (forum's service map, "Security review before publishing", 12).

export const DEFAULT_DESTINATION = "/dashboard";

const ORIGIN = "http://atrium.invalid";

export function safeDestination(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_DESTINATION;
  }
  try {
    // A path that still resolves elsewhere (an encoded or control character the checks above
    // miss) is refused too.
    const url = new URL(next, ORIGIN);
    if (url.origin !== ORIGIN) return DEFAULT_DESTINATION;
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_DESTINATION;
  }
}
