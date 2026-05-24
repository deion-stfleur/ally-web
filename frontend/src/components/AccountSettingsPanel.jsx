import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg ?? JSON.stringify(x)).join("; ");
  if (d && typeof d === "object") return JSON.stringify(d);
  return err.message || "Request failed";
}

/**
 * Account settings body — modal sidebar layout (desktop) or full-screen tabs (mobile page).
 */
export default function AccountSettingsPanel({
  variant = "modal",
  user,
  onLogout,
  onDeleteAccount,
  onDeleted,
  onViewPlans,
  onClose,
}) {
  const [nav, setNav] = useState("account");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isPage = variant === "page";

  useEffect(() => {
    setNav("account");
    setConfirming(false);
    setBusy(false);
    setError(null);
  }, [variant]);

  const handleConfirmDelete = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await onDeleteAccount();
      onClose?.();
      onDeleted?.();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }, [onDeleteAccount, onClose, onDeleted]);

  const handleLogout = useCallback(async () => {
    if (!onLogout) return;
    setBusy(true);
    setError(null);
    try {
      await onLogout();
      onClose?.();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }, [onLogout, onClose]);

  const switchNav = (next) => {
    setNav(next);
    setConfirming(false);
    setError(null);
  };

  const navButtons = (
    <>
      <p className={isPage ? "account-settings__nav-label" : "px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400"}>
        Account
      </p>
      <button
        type="button"
        onClick={() => switchNav("account")}
        className={
          isPage
            ? `account-settings__tab${nav === "account" ? " is-active" : ""}`
            : `mt-1 rounded-lg px-2 py-2 text-left text-sm font-medium transition ${
                nav === "account"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              }`
        }
      >
        Account
      </button>
      <p
        className={
          isPage ? "account-settings__nav-label account-settings__nav-label--spaced" : "mt-6 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
        }
      >
        Options
      </p>
      <button
        type="button"
        onClick={() => switchNav("options")}
        className={
          isPage
            ? `account-settings__tab${nav === "options" ? " is-active" : ""}`
            : `mt-1 rounded-lg px-2 py-2 text-left text-sm font-medium transition ${
                nav === "options"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              }`
        }
      >
        Options
      </button>
    </>
  );

  const accountPane = (
    <div>
      <h2
        id={isPage ? "account-page-title" : "account-settings-title"}
        className={isPage ? "account-settings__pane-title" : "text-lg font-semibold text-slate-900"}
      >
        Account
      </h2>
      <p className={isPage ? "account-settings__muted" : "mt-1 text-sm text-slate-500"}>
        Signed in as{" "}
        <span className="font-medium text-slate-800">{user?.email || "your Google account"}</span>
      </p>

      <div className={isPage ? "account-settings__section" : "mt-8 border-t border-slate-100 pt-6"}>
        <p className={isPage ? "account-settings__section-title" : "text-sm font-medium text-slate-800"}>
          Subscription
        </p>
        <p className={isPage ? "account-settings__body" : "mt-1 text-sm leading-relaxed text-slate-600"}>
          Text Ally from your phone on the same Google-connected account.{" "}
          <strong className="font-medium text-slate-800">Ally Standard ($10/mo)</strong> includes web chat,
          Google (Gmail, Calendar, Drive), and SMS when you text first.{" "}
          <strong className="font-medium text-slate-800">Ally Pro ($30/mo)</strong> adds proactive texts,
          profile memory, and deeper follow-through.
        </p>
        {user?.sms_plan_active ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {user.subscription_plan === "pro"
                ? "Ally Pro active"
                : user.subscription_plan === "starter"
                  ? "Ally Standard active"
                  : "Active"}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const { data } = await api.post("/api/billing/portal-session");
                  if (data?.url) window.location.assign(data.url);
                  else setError("No portal URL returned.");
                } catch (e) {
                  setError(formatApiError(e));
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Manage billing
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onViewPlans?.();
              }}
              className="inline-flex items-center rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
            >
              View pricing and subscribe
            </button>
          </div>
        )}
      </div>

      {!confirming ? (
        <div className={isPage ? "account-settings__section account-settings__section--danger" : "mt-8 border-t border-slate-100 pt-6"}>
          <p className={isPage ? "account-settings__section-title" : "text-sm font-medium text-slate-800"}>
            Session
          </p>
          <p className={isPage ? "account-settings__body" : "mt-1 text-sm leading-relaxed text-slate-600"}>
            Sign out on this device, or permanently delete your Ally profile, chat history, todos, and linked
            data. After deletion, the next Google sign-in starts a brand-new account.
          </p>
          <div className={isPage ? "account-settings__actions" : "mt-4 flex flex-wrap gap-2"}>
            {onLogout && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={busy}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? "Signing out…" : "Log out"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setConfirming(true);
                setError(null);
              }}
              disabled={busy}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              Delete account…
            </button>
          </div>
        </div>
      ) : (
        <div className={isPage ? "account-settings__confirm" : "mt-8 rounded-xl border border-red-100 bg-red-50/80 p-4"}>
          <p className="text-sm font-semibold text-red-900">Are you sure?</p>
          <p className="mt-2 text-sm leading-relaxed text-red-800/90">
            This cannot be undone. Your conversations, tasks, and saved settings on Ally will be erased.
          </p>
          {error && (
            <p className="mt-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={busy}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Yes, delete my account"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const optionsPane = (
    <div>
      <h2
        id={isPage ? "account-page-options" : "account-settings-options"}
        className={isPage ? "account-settings__pane-title" : "text-lg font-semibold text-slate-900"}
      >
        Options
      </h2>
      <p className={isPage ? "account-settings__body mt-3" : "mt-3 text-sm leading-relaxed text-slate-600"}>
        More preferences will land here later. Use the profile tab for account deletion.
      </p>
    </div>
  );

  if (isPage) {
    return (
      <div className="account-settings account-settings--page">
        <nav className="account-settings__tabs" aria-label="Settings sections">
          {navButtons}
        </nav>
        <div className="account-settings__pane">
          {nav === "account" ? accountPane : optionsPane}
        </div>
      </div>
    );
  }

  return (
    <>
      <aside className="flex w-[min(40%,200px)] shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-4 pt-14">
        {navButtons}
      </aside>
      <div className="min-h-[280px] min-w-0 flex-1 overflow-y-auto p-6 pt-14">
        {nav === "account" ? accountPane : optionsPane}
      </div>
    </>
  );
}
