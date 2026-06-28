import { useCallback, useState } from "react";
import AllyAvatar from "./AllyAvatar";
import {
  DEFAULT_FIRST_SMS_BODY,
  buildSmsDeepLink,
  formatPhoneDisplay,
} from "../utils/smsHandoff";

/**
 * Guides users off the web app: save phone on web, then send the first SMS (Sendblue text-first).
 */
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
        {showMessageIcon ? (
          <AllyAvatar className="h-8 w-8 shrink-0 rounded-full object-cover" decorative />
        ) : null}
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-emerald-950">
          <span className="font-semibold">Text Ally</span> at {display} — send &quot;{DEFAULT_FIRST_SMS_BODY}&quot; from
          your saved number.
        </p>
        {smsUrl ? (
          <a
            href={smsUrl}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
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
      <div className="flex items-center gap-3">
        <AllyAvatar className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm" decorative />
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
          Continue on your phone
        </p>
      </div>
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
            <AllyAvatar className="h-8 w-8 rounded-full object-cover ring-2 ring-emerald-500/80" decorative />
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
