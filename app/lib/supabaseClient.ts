// app/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Falls back to a placeholder instead of throwing here — this file is imported at
  // module scope by client components that Next also renders during the production
  // build (e.g. for /dashboard's prerendered shell), so throwing would fail the whole
  // build over a missing env var rather than just leaving auth broken at runtime.
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — set them in the deploy environment (not just .env, which isn't shipped). Auth will not work until then.",
  );
}

// Single browser client for the whole app — Google sign-in (see useAuthFlow.ts)
// and its session are the only things Supabase is used for here.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
);
