// app/lib/completeAuth.ts
import { userService } from "../services/userService";

/**
 * Interface for API errors to satisfy the linter without using 'any'
 */
interface ApiErrorResponse {
  status: number;
  message?: string;
}

export type AuthOutcome =
  | { kind: "addon-token"; token: string }
  | { kind: "redirect"; to: string }
  | { kind: "error"; message: string };

// Shared "what happens once we have a Supabase session" logic — used after
// Google's OAuth redirect, after an email/password sign-in, and after a
// confirmation-email link, so all three land in the same place instead of
// duplicating the profile-fetch/routing decision three times.
export async function completeAuth(
  token: string,
  mode: "default" | "addon",
  destination: string,
): Promise<AuthOutcome> {
  localStorage.setItem("auth_token", token);

  if (mode === "addon") {
    return { kind: "addon-token", token };
  }

  try {
    const userProfile = await userService.getUserProfile();
    localStorage.setItem("user_profile", JSON.stringify(userProfile));
    return { kind: "redirect", to: destination };
  } catch (error: unknown) {
    const apiError = error as ApiErrorResponse;

    if (apiError && apiError.status === 404) {
      // No account yet — go create one.
      return { kind: "redirect", to: "/onboarding" };
    }
    if (apiError && apiError.status === 403) {
      // Account exists but the backend won't return it until the currently-required
      // legal documents are accepted. Route into the app anyway — the (reserved)
      // layout's UserProvider + LegalGate will hit this same 403 and show the
      // acceptance screen before anything else renders.
      return { kind: "redirect", to: destination };
    }

    console.error("Auth Flow Error:", error);
    return { kind: "error", message: "Authentication failed." };
  }
}
