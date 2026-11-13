import { LogIn, LogOut } from "lucide-react";
import { translate } from "@/i18n";
import { signInWithGoogle, signOut, useAuth } from "@/lib/auth";

// Account button in the header controls row. Hidden entirely when
// Supabase is not configured, so the app is unchanged without env vars.
// Logged out: "Sign in with Google". Logged in: the user's name/avatar;
// clicking signs out. A failed sign-in surfaces through the app's
// notice system instead of navigating anywhere.
export default function AuthButton({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const { user, configured } = useAuth();

  if (!configured) return null;

  if (!user) {
    return (
      <button
        type="button"
        className="model-toggle auth-button"
        aria-label={translate("a11y.authButton")}
        onClick={() => {
          void signInWithGoogle().then(({ error }) => {
            if (error) {
              onNotice(translate("auth.signInFailed"));
            }
          });
        }}
      >
        <LogIn className="theme-icon" aria-hidden="true" />
        {translate("auth.signIn")}
      </button>
    );
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    user.email ||
    "";
  const avatar =
    typeof metadata.avatar_url === "string" ? metadata.avatar_url : undefined;

  return (
    <button
      type="button"
      className="model-toggle auth-button"
      aria-label={translate("auth.signOut")}
      title={translate("auth.signOut")}
      onClick={() => {
        void signOut().then(() => {
          onNotice(translate("auth.signedOut"));
        });
      }}
    >
      {avatar ? (
        <img src={avatar} alt="" className="auth-avatar" aria-hidden="true" />
      ) : (
        <LogOut className="theme-icon" aria-hidden="true" />
      )}
      <span>{name}</span>
    </button>
  );
}
