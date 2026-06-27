import { useCallback, useState } from "react";
import { PRO_MONTHLY_LABEL, STARTER_MONTHLY_LABEL, TASK_RUNNER_MONTHLY_LABEL } from "../constants/plans";

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
export default function SmsSubscribeBanner({ phoneE164, onViewPlans }) {
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
      className="flex shrink-0 items-start justify-between gap-3 border-b border-sky-200/80 bg-sky-50/95 px-4 py-3 backdrop-blur-sm sm:px-6"
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-sky-950">Subscribe to text Ally from this number</p>
        <p className="mt-0.5 text-xs leading-relaxed text-sky-900/85">
          Web chat is free. SMS requires {TASK_RUNNER_MONTHLY_LABEL}, {STARTER_MONTHLY_LABEL}, or{" "}
          {PRO_MONTHLY_LABEL}. {phoneHint}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onViewPlans}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-500"
        >
          View plans
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1.5 text-sky-700/70 transition hover:bg-sky-100 hover:text-sky-900"
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
