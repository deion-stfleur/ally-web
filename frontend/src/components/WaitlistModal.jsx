import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import { captureEvent } from "../analytics/posthog";
import { APP_NAME } from "../constants/brand";
import "./waitlist-modal.css";

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg ?? JSON.stringify(x)).join("; ");
  if (d && typeof d === "object") return JSON.stringify(d);
  return err.message || "Something went wrong. Please try again.";
}

export default function WaitlistModal({ open, onClose, source = "site" }) {
  const emailRef = useRef(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [useCase, setUseCase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccessMessage(null);
    const t = window.setTimeout(() => emailRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  const handleClose = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post("/api/waitlist", {
        email: email.trim(),
        name: name.trim() || null,
        company: company.trim() || null,
        use_case: useCase.trim() || null,
        source,
      });
      setSuccessMessage(res.data?.message || "You're on the list.");
      captureEvent("waitlist_submitted", {
        source,
        already_registered: Boolean(res.data?.already_registered),
        has_name: Boolean(name.trim()),
        has_company: Boolean(company.trim()),
        has_use_case: Boolean(useCase.trim()),
      });
    } catch (err) {
      setError(formatApiError(err));
      captureEvent("waitlist_submit_failed", {
        source,
        error: formatApiError(err),
      });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="past-messages-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
      onMouseDown={handleClose}
    >
      <div className="waitlist-modal__panel" onMouseDown={(e) => e.stopPropagation()}>
        <header className="waitlist-modal__head">
          <div className="waitlist-modal__head-text">
            <h2 id="waitlist-modal-title" className="waitlist-modal__title">
              Join the {APP_NAME} waitlist
            </h2>
            <p className="waitlist-modal__sub">
              We&apos;re finishing Google verification. Leave your email and we&apos;ll notify you
              when your account is ready — no spam, just your access invite.
            </p>
          </div>
          <button
            type="button"
            className="waitlist-modal__close"
            aria-label="Close"
            onClick={handleClose}
          >
            ×
          </button>
        </header>

        <div className="waitlist-modal__body">
          {successMessage ? (
            <div className="waitlist-modal__success">
              <div className="waitlist-modal__success-icon" aria-hidden>
                ✓
              </div>
              <p className="waitlist-modal__success-title">You&apos;re on the list</p>
              <p className="waitlist-modal__success-copy">{successMessage}</p>
            </div>
          ) : (
            <form className="waitlist-modal__form" onSubmit={handleSubmit}>
              <label className="waitlist-modal__label">
                Email
                <input
                  ref={emailRef}
                  className="waitlist-modal__input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  disabled={busy}
                />
              </label>
              <label className="waitlist-modal__label">
                Name <span className="waitlist-modal__hint">(optional)</span>
                <input
                  className="waitlist-modal__input"
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  disabled={busy}
                />
              </label>
              <label className="waitlist-modal__label">
                Company <span className="waitlist-modal__hint">(optional)</span>
                <input
                  className="waitlist-modal__input"
                  type="text"
                  name="company"
                  autoComplete="organization"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Business or team"
                  disabled={busy}
                />
              </label>
              <label className="waitlist-modal__label">
                What would you use {APP_NAME} for? <span className="waitlist-modal__hint">(optional)</span>
                <textarea
                  className="waitlist-modal__textarea"
                  name="use_case"
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  placeholder="Inbox triage, calendar prep, SMS tasks…"
                  disabled={busy}
                />
              </label>
              <p className="waitlist-modal__hint">
                Once access is granted, you&apos;ll get an email at the address above with next
                steps to connect Google and start texting {APP_NAME}.
              </p>
              {error ? (
                <p className="waitlist-modal__error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="waitlist-modal__submit" disabled={busy}>
                {busy ? "Joining…" : "Join waitlist"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
