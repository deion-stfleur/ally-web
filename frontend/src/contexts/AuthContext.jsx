import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { api, setAuthHeader } from "../api/client";
import { identifyUser, resetPostHogUser } from "../analytics/posthog";
import { OPEN_HOME_AFTER_AUTH_KEY } from "../hooks/useChat";

const AuthContext = createContext(null);

/** Persist JWT so refresh keeps you signed in (while the server session still exists). */
const SESSION_TOKEN_KEY = "ally_session_token";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

function loadGsiScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Sign-In script"));
    document.head.appendChild(s);
  });
}

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg ?? JSON.stringify(x)).join("; ");
  if (d && typeof d === "object") return JSON.stringify(d);
  return err.message || "Request failed";
}

function readStoredSessionToken() {
  if (typeof window === "undefined") return null;
  const t = window.localStorage.getItem(SESSION_TOKEN_KEY);
  return t && t.trim() ? t.trim() : null;
}

export function AuthProvider({ children }) {
  const [sessionToken, setSessionToken] = useState(() => {
    const t = readStoredSessionToken();
    if (t) setAuthHeader(t);
    return t;
  });
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!sessionToken) {
      setUser(null);
      return;
    }
    let cancelled = false;
    api
      .get("/api/auth/me")
      .then((res) => {
        if (!cancelled) setUser(res.data);
      })
      .catch(() => {
        if (!cancelled) {
          setAuthHeader(null);
          setSessionToken(null);
          window.localStorage.removeItem(SESSION_TOKEN_KEY);
          setUser(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (user?.email) {
      identifyUser(user.email, {
        name: user.name || undefined,
        sms_plan_active: Boolean(user.sms_plan_active),
        subscription_plan: user.subscription_plan || undefined,
      });
      return;
    }
    if (!sessionToken) {
      resetPostHogUser();
    }
  }, [user, sessionToken]);

  useEffect(() => {
    const onExpired = () => {
      setAuthHeader(null);
      setSessionToken(null);
      setUser(null);
    };
    window.addEventListener("ally:session-expired", onExpired);
    return () => window.removeEventListener("ally:session-expired", onExpired);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const refreshUser = useCallback(async () => {
    // After login, `sessionToken` state may not have flushed yet; token is already in localStorage + axios header.
    const t = readStoredSessionToken() || sessionToken;
    if (!t) {
      setUser(null);
      return null;
    }
    const { data } = await api.get("/api/auth/me");
    setUser(data);
    return data;
  }, [sessionToken]);

  const loginWithPhone = useCallback(
    async ({ phone, code }) => {
      setAuthError(null);
      const p = (phone || "").trim();
      if (!p) {
        const msg = "Enter a phone number.";
        setAuthError(msg);
        throw new Error(msg);
      }
      if (!code) {
        // Request OTP
        await api.post("/api/auth/phone/request", { phone: p });
        return { requested: true };
      }
      // Verify OTP -> session token
      const { data } = await api.post("/api/auth/phone/verify", { phone: p, code });
      const token = data.access_token;
      setAuthHeader(token);
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
      flushSync(() => {
        setSessionToken(token);
      });
      await refreshUser();
      return { requested: false };
    },
    [refreshUser]
  );

  const login = useCallback(async () => {
    setAuthError(null);
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      const msg = "Missing REACT_APP_GOOGLE_CLIENT_ID in .env.local";
      setAuthError(msg);
      throw new Error(msg);
    }
    await loadGsiScript();
    if (!window.google?.accounts?.oauth2?.initCodeClient) {
      const msg = "Google OAuth client API not available";
      setAuthError(msg);
      throw new Error(msg);
    }

    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn) => {
        if (settled) return;
        settled = true;
        fn();
      };

      const redirectUri =
        typeof window !== "undefined" ? window.location.origin : "";

      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: SCOPES,
        ux_mode: "popup",
        redirect_uri: redirectUri,
        select_account: true,
        error_callback: () => {
          finish(() => {
            const msg = "Google sign-in was cancelled or failed";
            setAuthError(msg);
            reject(new Error(msg));
          });
        },
        callback: async (resp) => {
          if (resp.error) {
            const msg =
              resp.error_description || resp.error || "Google sign-in error";
            setAuthError(msg);
            finish(() => reject(new Error(msg)));
            return;
          }
          if (!resp.code) {
            const msg = "No authorization code returned";
            setAuthError(msg);
            finish(() => reject(new Error(msg)));
            return;
          }
          try {
            const { data } = await api.post("/api/auth/google", {
              code: resp.code,
              redirect_uri: redirectUri,
            });
            const token = data.access_token;
            setAuthHeader(token);
            window.localStorage.setItem(SESSION_TOKEN_KEY, token);
            try {
              sessionStorage.setItem(OPEN_HOME_AFTER_AUTH_KEY, token);
            } catch {
              /* ignore */
            }
            flushSync(() => {
              setSessionToken(token);
            });
            try {
              await refreshUser();
            } catch (meErr) {
              try {
                sessionStorage.removeItem(OPEN_HOME_AFTER_AUTH_KEY);
              } catch {
                /* ignore */
              }
              window.localStorage.removeItem(SESSION_TOKEN_KEY);
              setAuthError(
                `Signed in, but loading your profile failed: ${formatApiError(meErr)}`
              );
              finish(() => reject(meErr));
              return;
            }
            finish(() => resolve());
          } catch (e) {
            const msg = formatApiError(e);
            setAuthError(msg);
            setAuthHeader(null);
            window.localStorage.removeItem(SESSION_TOKEN_KEY);
            setSessionToken(null);
            setUser(null);
            finish(() => reject(e));
          }
        },
      });
      client.requestCode();
    });
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      if (sessionToken) {
        await api.post("/api/auth/logout");
      }
    } catch {
      // Clear local session even if server fails
    } finally {
      setAuthHeader(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SESSION_TOKEN_KEY);
        try {
          sessionStorage.removeItem(OPEN_HOME_AFTER_AUTH_KEY);
        } catch {
          /* ignore */
        }
      }
      setSessionToken(null);
      setUser(null);
      resetPostHogUser();
    }
  }, [sessionToken]);

  /** Permanently deletes server-side profile (DB cascades) and clears local session. */
  const deleteAccount = useCallback(async () => {
    if (!sessionToken) return;
    await api.delete("/api/auth/me");
    setAuthHeader(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
      try {
        sessionStorage.removeItem(OPEN_HOME_AFTER_AUTH_KEY);
      } catch {
        /* ignore */
      }
    }
    setSessionToken(null);
    setUser(null);
    resetPostHogUser();
  }, [sessionToken]);

  const value = useMemo(
    () => ({
      sessionToken,
      user,
      isAuthenticated: Boolean(sessionToken),
      authError,
      clearAuthError,
      refreshUser,
      login,
      loginWithPhone,
      logout,
      deleteAccount,
    }),
    [
      sessionToken,
      user,
      authError,
      clearAuthError,
      refreshUser,
      login,
      loginWithPhone,
      logout,
      deleteAccount,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
