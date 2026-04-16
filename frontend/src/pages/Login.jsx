import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MarketingFooter from "../components/MarketingFooter";
import MarketingNav from "../components/MarketingNav";
import { useAuth } from "../hooks/useAuth";
import "./ally-lp.css";

function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, login, authError, clearAuthError } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/chat", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleSignIn() {
    clearAuthError();
    setBusy(true);
    try {
      await login();
      navigate("/chat", { replace: true });
    } catch {
      // Error message is in authError
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="alm">
      <MarketingNav />

      <main className="alm-main">
        <div className="alm-login-main">
          <div className="alm-card alm-login-card">
            <div className="alm-badge">
              <IconStar />
              Works with the tools you already use
            </div>
            <h1 className="alm-login__title">
              <strong>Welcome to Ally</strong>
              <span>Sign in with Google to continue</span>
            </h1>
            <p className="alm-login__lead">
              Connect Gmail, Calendar, and Drive so Ally can draft, summarize, and answer
              in one conversation—without jumping between tabs.
            </p>
            <button
              type="button"
              onClick={handleSignIn}
              disabled={busy}
              className="alm-login__cta"
            >
              {busy ? "Signing in…" : "Continue with Google"}
            </button>
            {authError && (
              <p className="alm-login-error" role="alert">
                {authError}
              </p>
            )}
            <p className="alm-login-hint">
              In Google Cloud Console, add this app&apos;s origin to{" "}
              <strong>Authorized JavaScript origins</strong> and add{" "}
              <strong>postmessage</strong> under <strong>Authorized redirect URIs</strong>{" "}
              for the OAuth web client.
            </p>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
