import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

function IconGoogle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo =
    typeof location.state?.from === "string" && location.state.from.startsWith("/")
      ? location.state.from
      : "/chat";
  const { isAuthenticated, login, loginWithPhone, authError, clearAuthError } =
    useAuth();
  const [busyAction, setBusyAction] = useState(null);
  const busy = busyAction !== null;
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(returnTo, { replace: true });
    }
  }, [isAuthenticated, navigate, returnTo]);

  async function handleGoogleSignIn() {
    clearAuthError();
    setBusyAction("google");
    try {
      await login();
      navigate(returnTo, { replace: true });
    } catch {
      // Error message is in authError
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePhoneContinue(e) {
    e?.preventDefault?.();
    clearAuthError();
    setBusyAction("phone");
    try {
      const res = await loginWithPhone({
        phone,
        code: otpRequested ? code : null,
      });
      if (res?.requested) {
        setOtpRequested(true);
      } else {
        navigate(returnTo, { replace: true });
      }
    } finally {
      setBusyAction(null);
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
              <span>Sign in with Google to get started</span>
            </h1>
            <p className="alm-login__lead">
              Google sign-in unlocks Gmail, Calendar, and Drive. After you&apos;re in, add your
              phone in the app — we&apos;ll give you Ally&apos;s number to text.
            </p>

            <div className="alm-login__panel">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={busy}
                className="alm-login__google"
              >
                <IconGoogle />
                {busyAction === "google" ? "Signing in…" : "Sign in with Google"}
              </button>

              <p className="alm-login__or" aria-hidden>
                <span>or use phone SMS code</span>
              </p>

              <form className="alm-login__phone" onSubmit={handlePhoneContinue}>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+15551234567"
                  className="alm-login__input"
                  disabled={busy}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  autoCorrect="off"
                />
                {otpRequested ? (
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6-digit code"
                    className="alm-login__input"
                    disabled={busy}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                  />
                ) : null}
                <button
                  type="submit"
                  disabled={busy}
                  className="alm-login__cta alm-login__cta--phone"
                >
                  {busyAction === "phone"
                    ? "Working…"
                    : otpRequested
                      ? "Verify code"
                      : "Send code"}
                </button>
              </form>
              <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
                Phone codes can be unreliable for new numbers. Google sign-in is recommended — then
                we&apos;ll show you Ally&apos;s text line in the app.
              </p>
            </div>

            {authError ? (
              <p className="alm-login-error" role="alert">
                {authError}
              </p>
            ) : null}
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
