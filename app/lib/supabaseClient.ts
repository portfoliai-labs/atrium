// app/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";
import { AUTH_PUBLIC_KEY, AUTH_URL } from "./origins";

// Single browser client for the whole app: its sign-ins and its session (lib/origins: the
// authentication on this page's own origin unless the build names another).
export const supabase = createClient(AUTH_URL, AUTH_PUBLIC_KEY);
