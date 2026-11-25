// The user's IANA time zone ("Europe/Rome"): the day the backend counts their "today", current
// month and year in. The browser's is sent at sign-up and whenever the profile has none; the user
// can change it from Profile › Preferences.

/** The browser's IANA time zone, or null when it can't tell. */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** The zones the user can pick, the current one always among them. */
export function timeZoneOptions(current: string | null): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  const all = new Set(zones);
  if (current) all.add(current);
  all.add("UTC");
  return Array.from(all).sort();
}

/** A zone as the user reads it: "Europe/Rome" → "Europe / Rome". */
export function timeZoneLabel(zone: string): string {
  return zone.replaceAll("_", " ").replaceAll("/", " / ");
}
