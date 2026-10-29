// app/bank-link/app/route.ts

// The mobile app's own scheme (its bundle id), where it waits for the bank's answer: tabella's
// `lib/constants/banking.dart`.
const APP_BANK_LINK = "online.portfoliai.tabella://bank-link";
// What the bank sends back: the link's `state` and `code`, or an `error` when the consent wasn't given.
const PASSED_ON = ["state", "code", "error", "error_description"];

/**
 * BANK LINK, FOR THE APP — where the bank sends back a user who started the link in the mobile app
 * (registered with the open banking aggregator: arca's `[banking] APP_REDIRECT_URL`). No session
 * here: the bank's answer is handed on, as it came, to the app's scheme, which completes the link
 * itself. A redirect, as an OAuth provider's, so the browser the app opened gives it back.
 */
export function GET(request: Request) {
  const given = new URL(request.url).searchParams;
  const passed = new URLSearchParams();
  for (const key of PASSED_ON) {
    const value = given.get(key);
    if (value !== null) passed.set(key, value);
  }
  return new Response(null, { status: 302, headers: { Location: `${APP_BANK_LINK}?${passed}` } });
}
