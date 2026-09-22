// app/context/UserContext.tsx
"use client";

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useCallback, 
  useMemo 
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { userService } from '../services/userService';
import { ApiError } from '../services/apiClient';
import type { UserProfile } from '../models/User';

/**
 * Context Type Definition
 */
interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  // True when the backend refused GET /users/profile specifically because
  // the account exists but hasn't accepted the currently-required legal
  // documents (403). Distinct from `user === null`, which also covers a
  // brand-new account that hasn't registered yet (404) — LegalGate needs to
  // tell these two apart to know whether it's safe to call /legal/pending.
  needsLegalAcceptance: boolean;
  // `silent: true` re-fetches without touching `loading`, for a caller that's already showing
  // its own feedback (e.g. a save button) and would otherwise have that feedback torn down by
  // the full-page spinner other pages show while `loading` is true.
  refreshUser: (opts?: { silent?: boolean }) => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * UserProvider Component
 * To be placed in app/(reserved)/layout.tsx
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [needsLegalAcceptance, setNeedsLegalAcceptance] = useState<boolean>(false);
  const [hasInitialized, setHasInitialized] = useState<boolean>(false);

  const router = useRouter();
  const pathname = usePathname();

  /**
   * Centralized Logout Logic
   * Cleans up local storage and resets the state
   */
  const logout = useCallback((): void => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_profile");
    setUser(null);
    setLoading(false);
    
    // Redirect to login with a reason parameter for UX
    router.replace('/homepage');
  }, [router]);

  /**
   * Profile Fetcher
   * Attempts to retrieve the user profile from the backend
   */
  const fetchProfile = useCallback(async (opts?: { silent?: boolean }): Promise<void> => {
    const silent = opts?.silent ?? false;
    try {
      if (!silent) setLoading(true);
      const profile: UserProfile = await userService.getUserProfile();
      setUser(profile);
      setNeedsLegalAcceptance(false);

      // Cache the profile for performance
      localStorage.setItem("user_profile", JSON.stringify(profile));
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        // User is authenticated but profile doesn't exist yet
        setUser(null);
        setNeedsLegalAcceptance(false);
        if (!pathname.includes('/onboarding')) {
          router.replace('/onboarding');
        }
      } else if (error instanceof ApiError && error.status === 403) {
        // Account exists, but the backend won't return it until the
        // currently-required legal documents are accepted. Do NOT redirect
        // to onboarding — there's already a profile. Leave `user` null and
        // flag it so LegalGate knows to check /legal/pending (safe to call:
        // the account exists) instead of assuming this is a brand-new signup.
        setUser(null);
        setNeedsLegalAcceptance(true);
      }
      // Note: 401 errors are handled globally by the 'auth-unauthorized' event
    } finally {
      if (!silent) setLoading(false);
    }
  }, [pathname, router]);

  /**
   * Initial effect to handle event listeners and startup logic
   */
  useEffect(() => {
    // Listen for the custom event dispatched by apiClient on 401 responses
    window.addEventListener("auth-unauthorized", logout);

    const token: string | null = localStorage.getItem("auth_token");

    // 1. Mandatory check: if no token is found within (reserved) group, boot
    // to login — preserving the page they were trying to reach (e.g. a
    // report link shared from an email) so the post-login redirect can send
    // them there instead of defaulting to the dashboard.
    if (!token) {
      setUser(null);
      setLoading(false);
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    // 2. Only run initialization once
    if (!hasInitialized) {
      const cachedProfile: string | null = localStorage.getItem("user_profile");

      if (cachedProfile) {
        try {
          setUser(JSON.parse(cachedProfile));
          setLoading(false);
          // Refresh data in background to keep it in sync
          fetchProfile();
        } catch {
          // If JSON is corrupted, fallback to full fetch
          fetchProfile();
        }
      } else {
        fetchProfile();
      }

      setHasInitialized(true);
    }

    return () => {
      window.removeEventListener("auth-unauthorized", logout);
    };
  }, [hasInitialized, fetchProfile, logout, router, pathname]);

  /**
   * Memoize context value to prevent unnecessary re-renders of consuming components
   */
  const contextValue: UserContextType = useMemo(() => ({
    user,
    loading,
    needsLegalAcceptance,
    refreshUser: fetchProfile,
    logout
  }), [user, loading, needsLegalAcceptance, fetchProfile, logout]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

/**
 * Custom hook to consume the UserContext
 */
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider inside the (reserved) group");
  }
  return context;
};