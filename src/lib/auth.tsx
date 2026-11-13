import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl } from "./supabase";

interface AuthState {
  /** The signed-in user, or null when logged out / unconfigured. */
  user: User | null;
  /** False when Supabase env vars are missing — auth UI hides itself. */
  configured: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  configured: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return undefined;
    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, configured: isSupabaseConfigured }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/**
 * Whether Google sign-in is enabled in the Supabase dashboard
 * (Auth → Providers → Google). Read from GoTrue's public settings
 * endpoint. Checked fresh on every sign-in click, never cached: the
 * user may enable Google in the dashboard and retry in the same tab.
 * Fail-open: when the check itself fails (network error, unexpected
 * response), the OAuth flow is allowed to decide — a transient blip
 * must not break sign-in.
 */
async function isGoogleEnabled(): Promise<boolean> {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) return false;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (!res.ok) return true;
    const settings = (await res.json()) as {
      external?: { google?: boolean };
    };
    return settings?.external?.google === true;
  } catch {
    return true;
  }
}

/**
 * Starts Google sign-in. Returns an error message when the OAuth flow
 * could not start. In particular, when Google is not enabled in the
 * Supabase dashboard yet, this returns an error instead of navigating:
 * supabase-js would otherwise redirect the browser to the authorize
 * URL and strand the user on GoTrue's error page, since the client
 * itself never reports a disabled provider.
 * On success the browser leaves for Google's login page and comes back
 * to the app; the provider then picks up the session via
 * onAuthStateChange.
 */
export async function signInWithGoogle(): Promise<{ error?: string }> {
  if (!supabase) return { error: "unconfigured" };
  if (!(await isGoogleEnabled())) return { error: "provider_not_enabled" };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) return { error: error.message };
  // supabase-js redirects by default; this is a fallback for the same URL.
  if (data?.url) {
    window.location.href = data.url;
  }
  return {};
}

export async function signOut(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
}
