import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg ?? JSON.stringify(x)).join("; ");
  if (d && typeof d === "object") return JSON.stringify(d);
  return err.message || "Request failed";
}

/**
 * Prompt for SMS-capable phone; dismiss is handled by parent (e.g. per-day localStorage).
 */
export default function PhonePromptModal({
  open,
  onDismiss,
  refreshUser,
}) {
  const inputRef = useRef(null);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPhone("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  const handleDismiss = useCallback(() => {
    if (saving) return;
    onDismiss();
  }, [onDismiss, saving]);

  const handleSave = useCallback(async () => {
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
      onDismiss({ saved: true });
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  }, [phone, refreshUser, onDismiss]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleDismiss]);

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phone-prompt-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleDismiss}
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
          Enter your mobile number to text Ally and get errands and follow-ups done faster when
          you are not at your computer. (Totally optional—you can add it another time.)
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
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none ring-slate-400/30 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 disabled:opacity-60"
        />
        {error && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleDismiss}
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
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
