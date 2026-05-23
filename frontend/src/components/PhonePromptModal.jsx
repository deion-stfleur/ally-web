import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import TextAllyHandoff from "./TextAllyHandoff";
import {
  clearPendingPhone,
  consumeShowSmsHandoff,
  getPendingPhone,
  markShowSmsHandoff,
  setPendingPhone,
} from "../utils/phoneOnboarding";

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg ?? JSON.stringify(x)).join("; ");
  if (d && typeof d === "object") return JSON.stringify(d);
  return err.message || "Request failed";
}

function isPaymentRequired(err) {
  return err?.response?.status === 402;
}

function IconMessagesBubble() {
  return (
    <div
      className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/35 ring-4 ring-emerald-50"
      aria-hidden
    >
      <svg className="h-9 w-9 text-white" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z" />
      </svg>
    </div>
  );
}

/**
 * Phone-first onboarding: enter number → subscribe if needed → Messages handoff.
 */
export default function PhonePromptModal({
  open,
  onDismiss,
  refreshUser,
  smsPlanActive,
  onViewPlans,
  userPhoneE164 = null,
}) {
  const inputRef = useRef(null);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [allySmsE164, setAllySmsE164] = useState(null);
  const [savedPhoneE164, setSavedPhoneE164] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/auth/app-config")
      .then((res) => {
        if (!cancelled) setAllySmsE164(res.data?.ally_sms_e164 || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setShowSuccess(false);
      return;
    }
    setError(null);

    if (consumeShowSmsHandoff() && userPhoneE164 && smsPlanActive) {
      setSavedPhoneE164(userPhoneE164);
      setShowSuccess(true);
      return;
    }

    setShowSuccess(false);
    setPhone(userPhoneE164 || getPendingPhone() || "");
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, userPhoneE164, smsPlanActive]);

  const finishAfterSuccess = useCallback(() => {
    setShowSuccess(false);
    onDismiss({ saved: true });
  }, [onDismiss]);

  const handleDismissForm = useCallback(() => {
    if (saving) return;
    onDismiss();
  }, [onDismiss, saving]);

  const openPricingForPhone = useCallback(
    (raw) => {
      setPendingPhone(raw);
      onDismiss();
      onViewPlans?.();
    },
    [onDismiss, onViewPlans]
  );

  const handleSave = useCallback(async () => {
    const raw = phone.trim();
    if (!raw) {
      setError("Enter your phone number.");
      return;
    }

    if (!smsPlanActive) {
      openPricingForPhone(raw);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data } = await api.patch("/api/auth/me/phone", { phone: raw });
      clearPendingPhone();
      await refreshUser();
      setSavedPhoneE164(data?.phone_e164 || raw);
      markShowSmsHandoff();
      setShowSuccess(true);
    } catch (e) {
      if (isPaymentRequired(e)) {
        openPricingForPhone(raw);
        return;
      }
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }, [phone, smsPlanActive, refreshUser, openPricingForPhone]);

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
              <IconMessagesBubble />
              <h2 id="phone-success-title" className="mt-5 text-lg font-semibold text-slate-900">
                You&apos;re set — open Messages
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Text Ally from your saved number. Send the first message below so Ally can reply by SMS.
              </p>
            </div>

            <TextAllyHandoff
              className="mt-4"
              allySmsE164={allySmsE164}
              userPhoneE164={savedPhoneE164}
              showMessageIcon
            />

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={finishAfterSuccess}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
              >
                Done
              </button>
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
              Enter the mobile number you&apos;ll text from. Web chat stays free — SMS needs Ally Standard or
              Pro.
            </p>

            <label htmlFor="phone-prompt-input" className="mt-5 block text-xs font-medium text-slate-500">
              Your phone number
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
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save & continue"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
