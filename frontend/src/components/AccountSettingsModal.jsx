import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg ?? JSON.stringify(x)).join("; ");
  if (d && typeof d === "object") return JSON.stringify(d);
  return err.message || "Request failed";
}

/**
 * Center settings modal: left nav (Account / Options), right pane; Account includes delete with confirm.
 */
export default function AccountSettingsModal({
  open,
  onClose,
  user,
  onDeleteAccount,
  onDeleted,
}) {
  const [nav, setNav] = useState("account");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setNav("account");
    setConfirming(false);
    setBusy(false);
    setError(null);
  }, [open]);

  const handleClose = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const handleConfirmDelete = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await onDeleteAccount();
      onClose();
      onDeleted?.();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }, [onDeleteAccount, onClose, onDeleted]);

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby={nav === "options" ? "account-settings-options" : "account-settings-title"}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="relative flex max-h-[min(90vh,640px)] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={busy}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          aria-label="Close settings"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <aside className="flex w-[min(40%,200px)] shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-4 pt-14">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Account</p>
          <button
            type="button"
            onClick={() => {
              setNav("account");
              setConfirming(false);
              setError(null);
            }}
            className={`mt-1 rounded-lg px-2 py-2 text-left text-sm font-medium transition ${
              nav === "account"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
            }`}
          >
            Account
          </button>
          <p className="mt-6 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Options</p>
          <button
            type="button"
            onClick={() => {
              setNav("options");
              setConfirming(false);
              setError(null);
            }}
            className={`mt-1 rounded-lg px-2 py-2 text-left text-sm font-medium transition ${
              nav === "options"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
            }`}
          >
            Options
          </button>
        </aside>

        <div className="min-h-[280px] min-w-0 flex-1 overflow-y-auto p-6 pt-14">
          {nav === "account" && (
            <div>
              <h2 id="account-settings-title" className="text-lg font-semibold text-slate-900">
                Account
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Signed in as{" "}
                <span className="font-medium text-slate-800">{user?.email || "your Google account"}</span>
              </p>

              {!confirming ? (
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <p className="text-sm font-medium text-slate-800">Delete account</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Permanently remove your Ally profile, chat history, todos, and linked data from our servers.
                    The next time you sign in with Google, we start a brand-new account for you.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(true);
                      setError(null);
                    }}
                    disabled={busy}
                    className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    Delete account…
                  </button>
                </div>
              ) : (
                <div className="mt-8 rounded-xl border border-red-100 bg-red-50/80 p-4">
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
          )}

          {nav === "options" && (
            <div>
              <h2 id="account-settings-options" className="text-lg font-semibold text-slate-900">
                Options
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                More preferences will land here later. Use the profile tab for account deletion.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
