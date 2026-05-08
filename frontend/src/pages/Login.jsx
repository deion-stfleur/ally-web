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
  const { isAuthenticated, login, loginWithPhone, authError, clearAuthError } =
    useAuth();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);

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

  async function handlePhoneContinue(e) {
    e?.preventDefault?.();
    clearAuthError();
    setBusy(true);
    try {
      const res = await loginWithPhone({
        phone,
        code: otpRequested ? code : null,
      });
      if (res?.requested) {
        setOtpRequested(true);
      } else {
        navigate("/chat", { replace: true });
      }
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
              <span>Sign in with your phone or Google</span>
            </h1>
            <p className="alm-login__lead">
              Start with phone sign-in for texting. Connect Google anytime to unlock Gmail,
              Calendar, and Drive actions.
            </p>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                disabled={busy}
                className="alm-login__cta"
                onClick={() => setMode("phone")}
                style={{ opacity: mode === "phone" ? 1 : 0.7 }}
              >
                Phone
              </button>
              <button
                type="button"
                disabled={busy}
                className="alm-login__cta"
                onClick={() => setMode("google")}
                style={{ opacity: mode === "google" ? 1 : 0.7 }}
              >
                Google
              </button>
            </div>

            {mode === "phone" ? (
              <form onSubmit={handlePhoneContinue}>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+15551234567"
                  className="alm-login__input"
                  disabled={busy}
                />
                {otpRequested && (
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6-digit code"
                    className="alm-login__input"
                    disabled={busy}
                  />
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="alm-login__cta"
                  style={{ width: "100%", marginTop: 10 }}
                >
                  {busy
                    ? "Working…"
                    : otpRequested
                      ? "Verify code"
                      : "Send code"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={busy}
                className="alm-login__cta"
              >
                {busy ? "Signing in…" : "Continue with Google"}
              </button>
            )}

            {authError && (
              <p className="alm-login-error" role="alert">
                {authError}
              </p>
            )}
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
