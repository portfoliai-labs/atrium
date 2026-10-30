// app/lib/password.ts

// Supabase's own minimum (its default), checked here too so the form says so before sending.
export const MIN_PASSWORD_LENGTH = 6;

/**
 * What's wrong with a new password and its confirmation, or null when it can be set: the rules
 * Settings' password change and the reset link's page (auth/reset-password) both check.
 */
export function newPasswordError(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (password !== confirmation) return "Passwords don't match";
  return null;
}
