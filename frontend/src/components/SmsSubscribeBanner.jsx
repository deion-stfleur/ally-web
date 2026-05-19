import { useCallback, useState } from "react";
import { Link } from "react-router-dom";

const DISMISS_KEY = "ally_sms_subscribe_banner_dismissed";

function localCalendarDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Soft upsell when the user has no active SMS plan (web chat still works).
 */
export default function SmsSubscribeBanner({ phoneE164 }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === localCalendarDateKey();
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, localCalendarDateKey());
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  const phoneHint = phoneE164
    ? "Subscribe to text Ally from the number on your account."
    : "Subscribe to text Ally from your phone.";

  return (
    <div
      className="flex shrink-0 items-start justify-between gap-3 border-b border-violet-200/80 bg-violet-50/90 px-4 py-3 backdrop-blur-sm sm:px-6"
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-violet-950">Subscribe to text Ally from this number</p>
        <p className="mt-0.5 text-xs leading-relaxed text-violet-900/80">
          Web chat is free. SMS requires Ally Standard ($10/mo) or Ally Pro ($30/mo). {phoneHint}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to="/pricing"
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
        >
          View plans
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1.5 text-violet-700/70 transition hover:bg-violet-100 hover:text-violet-900"
          aria-label="Dismiss for today"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
