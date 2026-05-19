import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api } from "../api/client";

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg ?? JSON.stringify(x)).join("; ");
  if (d && typeof d === "object") return JSON.stringify(d);
  return err.message || "Request failed";
}

function IconCheckCircle() {
  return (
    <div
      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 ring-4 ring-emerald-50"
      aria-hidden
    >
      <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </div>
  );
}

/**
 * Prompt to link a phone for SMS. Requires an active plan before saving (enforced on API too).
 */
export default function PhonePromptModal({ open, onDismiss, refreshUser, smsPlanActive }) {
  const inputRef = useRef(null);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const canSavePhone = Boolean(smsPlanActive);

  useEffect(() => {
    if (!open) {
      setShowSuccess(false);
      return;
    }
    setError(null);
    setPhone("");
    setShowSuccess(false);
    if (canSavePhone) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open, canSavePhone]);

  const finishAfterSuccess = useCallback(() => {
    setShowSuccess(false);
    onDismiss({ saved: true });
  }, [onDismiss]);

  const handleDismissForm = useCallback(() => {
    if (saving) return;
    onDismiss();
  }, [onDismiss, saving]);

  const handleSave = useCallback(async () => {
    if (!canSavePhone) return;
    const raw = phone.trim();
    if (!raw) {
      setError("Enter your phone number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch("/api/auth/me/phone", { phone: raw });
      await refreshUser();
      setShowSuccess(true);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }, [canSavePhone, phone, refreshUser]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (showSuccess) finishAfterSuccess();
      else handleDismissForm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, showSuccess, finishAfterSuccess, handleDismissForm]);

  if (!open) return null;

  const onBackdropMouseDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (showSuccess) finishAfterSuccess();
    else handleDismissForm();
  };

  const node = (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby={showSuccess ? "phone-success-title" : "phone-prompt-title"}
      onMouseDown={onBackdropMouseDown}
    >
      <div
        className="relative max-h-[min(90vh,560px)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {showSuccess ? (
          <>
            <button
              type="button"
              onClick={finishAfterSuccess}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="pt-2 text-center">
              <IconCheckCircle />
              <h2 id="phone-success-title" className="mt-5 text-lg font-semibold text-slate-900">
                Number saved — SMS is on
              </h2>
              <p className="mt-3 text-left text-sm leading-relaxed text-slate-600">
                Your plan is active. Text Ally from this number anytime; it stays linked to the same
                account as web chat.
              </p>
              <p className="mt-3 text-left text-sm leading-relaxed text-slate-600">
                You should get a welcome text shortly. If you signed in with Google, Gmail, Calendar,
                and Drive stay connected for SMS answers too.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={finishAfterSuccess}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Got it
              </button>
            </div>
          </>
        ) : !canSavePhone ? (
          <>
            <button
              type="button"
              onClick={handleDismissForm}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 id="phone-prompt-title" className="pr-10 text-lg font-semibold text-slate-900">
              Subscribe before linking your phone
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Web chat is free. To text Ally from your phone, you need{" "}
              <strong className="font-medium text-slate-800">Ally Standard ($10/mo)</strong> or{" "}
              <strong className="font-medium text-slate-800">Ally Pro ($30/mo)</strong>. After you
              subscribe, come back here to save your number.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleDismissForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Not now
              </button>
              <Link
                to="/pricing"
                onClick={() => onDismiss()}
                className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                View plans
              </Link>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleDismissForm}
              disabled={saving}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 id="phone-prompt-title" className="pr-10 text-lg font-semibold text-slate-900">
              Text Ally from your phone
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Enter your mobile number to text Ally when you are away from your computer. SMS is
              included with your active plan.
            </p>
            <p className="mt-2 rounded-lg border border-violet-100 bg-violet-50/80 px-3 py-2 text-xs leading-relaxed text-violet-950">
              SMS requires a plan from $10/mo. You are subscribed — save your number to start texting.
            </p>

            <label htmlFor="phone-prompt-input" className="mt-5 block text-xs font-medium text-slate-500">
              Phone number
            </label>
            <input
              id="phone-prompt-input"
              ref={inputRef}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder="+1 555 123 4567"
              disabled={saving}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 outline-none ring-slate-400/30 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 disabled:opacity-60"
            />
            {error ? (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleDismissForm}
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save number"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
