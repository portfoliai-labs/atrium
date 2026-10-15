// app/hooks/useAuthFlow.ts
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { completeAuth } from '../lib/completeAuth';

export function useAuthFlow(mode: 'default' | 'addon' = 'default', next?: string | null) {
  const router = useRouter();
  const [status, setStatus] = useState<string>('Ready to authenticate');
  const [isError, setIsError] = useState<boolean>(false);
  const [addonToken, setAddonToken] = useState<string | null>(null);
  // Set to the email just signed up with once Supabase requires clicking a
  // confirmation link before a session is issued. null the rest of the time.
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState<string | null>(null);

  // Where to send the user once they're actually let into the app. Falls
  // back to the dashboard when there's no specific page they were trying
  // to reach (e.g. a deep link to a report shared from an email).
  const destination = next || '/dashboard';

  const callbackUrl = () => {
    const url = new URL('/auth/callback', window.location.origin);
    url.searchParams.set('next', destination);
    if (mode === 'addon') url.searchParams.set('source', 'addon');
    return url.toString();
  };

  const applyOutcome = async (token: string) => {
    const outcome = await completeAuth(token, mode, destination);
    if (outcome.kind === 'addon-token') {
      setAddonToken(outcome.token);
    } else if (outcome.kind === 'redirect') {
      router.push(outcome.to);
    } else {
      setIsError(true);
      setStatus(outcome.message);
    }
  };

  // Triggers Supabase's Google OAuth redirect. Unlike the email/password flows
  // below, this navigates the whole tab away to Google and back — completion
  // (profile fetch, routing, addon token display) happens on /auth/callback
  // once Supabase hands back a session, via the same completeAuth() used here.
  const login = async () => {
    setStatus('Redirecting to Google...');
    setIsError(false);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    });

    // Only reached if Supabase refuses to even start the redirect (e.g. the
    // Google provider isn't configured) — once the redirect happens, this
    // component is torn down.
    if (error) {
      console.error("Auth Flow Error:", error);
      setIsError(true);
      setStatus('Google Login failed.');
    }
  };

  const loginWithPassword = async (email: string, password: string) => {
    setStatus('Signing in...');
    setIsError(false);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setIsError(true);
      setStatus(error.message);
      return;
    }
    if (data.session) {
      await applyOutcome(data.session.access_token);
    }
  };

  const signUpWithPassword = async (email: string, password: string) => {
    setStatus('Creating account...');
    setIsError(false);
    setNeedsEmailConfirmation(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callbackUrl() },
    });

    if (error) {
      setIsError(true);
      setStatus(error.message);
      return;
    }

    if (data.session) {
      // The project has email confirmation turned off — a session comes back
      // immediately, same as a normal sign-in.
      await applyOutcome(data.session.access_token);
    } else {
      // Confirmation required: Supabase emailed a link to `emailRedirectTo`
      // (/auth/callback) — nothing more to do here until the user clicks it.
      setNeedsEmailConfirmation(email);
    }
  };

  const resendConfirmation = async (email: string) => {
    setStatus('Resending confirmation email...');
    setIsError(false);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: callbackUrl() },
    });

    if (error) {
      setIsError(true);
      setStatus(error.message);
    } else {
      setStatus('Confirmation email resent.');
    }
  };

  return {
    login,
    loginWithPassword,
    signUpWithPassword,
    resendConfirmation,
    status,
    isError,
    addonToken,
    needsEmailConfirmation,
  };
}
