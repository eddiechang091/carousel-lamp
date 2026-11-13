import { afterEach, describe, expect, it, vi } from "vitest";

// The client reads VITE_SUPABASE_* at import time, so each case re-imports
// the module with a stubbed env. This keeps the test true whether or not
// a local .env.local exists (vitest loads it into import.meta.env).
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("supabase client", () => {
  it("is unconfigured without VITE_SUPABASE_* env vars", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const mod = await import("@/lib/supabase");
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(mod.supabase).toBeNull();
  });

  it("creates a client when both env vars are present", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "sb_publishable_test");
    const mod = await import("@/lib/supabase");
    expect(mod.isSupabaseConfigured).toBe(true);
    expect(mod.supabase).not.toBeNull();
  });
});
