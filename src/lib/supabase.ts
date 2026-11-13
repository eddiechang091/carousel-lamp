import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase client for the per-user app (auth + per-user photos).
// The URL and anon key come from VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY (see .env.local for local dev, Vercel env vars
// for the deployed app). The anon key is public by design — it ships in
// the client bundle and is gated by Row Level Security. The service_role
// key must never appear here or in the repo.
//
// When the env vars are missing (e.g. the hackathon build on main),
// the client is null and the auth UI hides itself — the app keeps
// working exactly as before, local-only.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// The raw URL / anon key, for callers that need to talk to GoTrue
// directly (the provider pre-check in auth.tsx). The anon key is
// public by design — it ships in the client bundle and is gated by RLS.
export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;
