import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider, setLocale } from "@/i18n";
import { AuthProvider } from "@/lib/auth";
import AuthButton from "@/components/AuthButton";

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "sb_publishable_test",
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithOAuth: mocks.signInWithOAuth,
      signOut: mocks.signOut,
    },
  },
}));

const testUser = {
  id: "user-1",
  email: "test@example.com",
  user_metadata: {
    full_name: "Test User",
    avatar_url: "https://example.com/avatar.png",
  },
};

function renderAuthButton(onNotice: (message: string) => void = vi.fn()) {
  setLocale("en");
  return render(
    <I18nProvider>
      <AuthProvider>
        <AuthButton onNotice={onNotice} />
      </AuthProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ external: { google: true } }),
  });
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mocks.unsubscribe } },
  });
  mocks.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  mocks.signOut.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthButton", () => {
  it("offers Google sign-in when logged out and starts the OAuth flow", async () => {
    const user = userEvent.setup();
    renderAuthButton();

    const button = await screen.findByRole("button", { name: "Sign in" });
    expect(button).toHaveTextContent("Sign in with Google");
    await user.click(button);

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/settings",
      { headers: { apikey: "sb_publishable_test" } },
    );
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  });

  it("does not navigate away when Google is not enabled in the dashboard", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ external: { google: false } }),
    });
    const onNotice = vi.fn();
    const user = userEvent.setup();
    renderAuthButton(onNotice);

    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith(
      "Couldn't sign in with Google — try again",
    );
  });

  it("reports a failed sign-in through the notice instead of navigating", async () => {
    mocks.signInWithOAuth.mockResolvedValue({
      data: {},
      error: { message: "provider is not enabled" },
    });
    const onNotice = vi.fn();
    const user = userEvent.setup();
    renderAuthButton(onNotice);

    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(onNotice).toHaveBeenCalledWith(
      "Couldn't sign in with Google — try again",
    );
  });

  it("shows the signed-in user's name and signs out on click", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: testUser } },
    });
    const onNotice = vi.fn();
    const user = userEvent.setup();
    renderAuthButton(onNotice);

    expect(await screen.findByText("Test User")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(mocks.signOut).toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith("Signed out");
  });

  it("picks up a session that arrives through onAuthStateChange", async () => {
    let authCallback: (
      event: string,
      session: { user: typeof testUser } | null,
    ) => void = () => {};
    mocks.onAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    });
    renderAuthButton();

    await screen.findByRole("button", { name: "Sign in" });
    authCallback("SIGNED_IN", { user: testUser });

    expect(await screen.findByText("Test User")).toBeInTheDocument();
  });

  it("renders nothing without an AuthProvider (unconfigured)", () => {
    setLocale("en");
    const { container } = render(
      <I18nProvider>
        <AuthButton onNotice={vi.fn()} />
      </I18nProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
