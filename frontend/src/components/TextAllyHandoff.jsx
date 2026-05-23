import { useCallback, useState } from "react";
import {
  DEFAULT_FIRST_SMS_BODY,
  buildSmsDeepLink,
  formatPhoneDisplay,
} from "../utils/smsHandoff";

/**
 * Guides users off the web app: save phone on web, then send the first SMS (Sendblue text-first).
 */
function IconMessageBubble({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z" />
    </svg>
  );
}

export default function TextAllyHandoff({
  allySmsE164,
  userPhoneE164 = null,
  compact = false,
  className = "",
  showMessageIcon = false,
}) {
  const [copied, setCopied] = useState(null);
  const smsUrl = buildSmsDeepLink(allySmsE164, DEFAULT_FIRST_SMS_BODY);
  const display = formatPhoneDisplay(allySmsE164) || allySmsE164;

  const copy = useCallback(async (label, text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  if (!allySmsE164) return null;

  if (compact) {
    return (
      <div
        className={`flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-3 py-2.5 ${className}`}
      >
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-emerald-950">
          <span className="font-semibold">Text Ally</span> at {display} — send &quot;{DEFAULT_FIRST_SMS_BODY}&quot; from
          your saved number.
        </p>
        {smsUrl ? (
          <a
            href={smsUrl}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            {showMessageIcon ? <IconMessageBubble className="h-4 w-4" /> : null}
            Open Messages
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-white p-4 ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
        Continue on your phone
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm leading-relaxed text-slate-700">
        <li>
          {userPhoneE164 ? (
            <>
              Use the number you saved{" "}
              <strong className="font-medium text-slate-900">
                {formatPhoneDisplay(userPhoneE164) || userPhoneE164}
              </strong>
              .
            </>
          ) : (
            <>Save your mobile number in Ally first (same account as this web session).</>
          )}
        </li>
        <li>
          Open Messages and send{" "}
          <strong className="font-medium text-slate-900">&quot;{DEFAULT_FIRST_SMS_BODY}&quot;</strong> to{" "}
          <strong className="font-medium text-slate-900">{display}</strong>. That first text is required before
          Ally can reply by SMS.
        </li>
        <li>Ask anything by text — Gmail, calendar, and web chat stay on the same account.</li>
      </ol>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {smsUrl ? (
          <a
            href={smsUrl}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/80">
              <IconMessageBubble className="h-5 w-5" />
            </span>
            Open Messages
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => copy("number", allySmsE164)}
          className="inline-flex items-center justify-center rounded-xl border border-emerald-300/80 bg-white px-4 py-2.5 text-sm font-medium text-emerald-900 transition hover:bg-emerald-50/80"
        >
          {copied === "number" ? "Copied!" : "Copy Ally number"}
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        On desktop, copy the number and text from your phone. Welcome texts from Ally may arrive only after you
        send the first message.
      </p>
    </div>
  );
}
