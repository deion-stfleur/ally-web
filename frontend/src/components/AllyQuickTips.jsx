import { useCallback, useId, useState } from "react";

const TIPS = [
  {
    id: "chat",
    title: "Start in web chat",
    body: "Sign in with Google, then ask in plain language. Ally can read Gmail, Calendar, Drive, and Sheets when you grant access.",
    try: "What meetings do I have tomorrow?",
  },
  {
    id: "sms",
    title: "Text Ally from your phone",
    body: "Save your mobile number, pick a plan with SMS, then send the first text to Ally’s line. Replies stay tied to the same Google account as this session.",
    try: null,
  },
  {
    id: "email",
    title: "Draft and schedule email",
    body: "Paste a draft and ask Ally to send it later, or say who should receive it and when. Ally confirms before anything goes out if you want that guardrail.",
    try: "Draft a follow-up to Alex about the proposal",
  },
  {
    id: "todo",
    title: "Quick todos",
    body: "Add tasks from chat with a simple prefix. They show up in your To Do list on the right.",
    try: "todo: Send the Q2 deck to finance",
  },
  {
    id: "automations",
    title: "Pro automations",
    body: "Ask for daily SMS recaps, inbox watches, or background research. Pro plans unlock proactive texts and longer-running jobs.",
    try: "Text me weekdays at 8am with calendar and urgent mail",
  },
  {
    id: "receipts",
    title: "Receipts to Sheets",
    body: "Attach a receipt photo in chat or describe the row you want. Tell Ally which spreadsheet to use — it can append when you confirm.",
    try: "Add this receipt to my expenses sheet",
  },
];

function Chevron({ open, darkRail }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${
        darkRail ? "text-slate-400" : "text-slate-500"
      }`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

export default function AllyQuickTips({
  darkRail = false,
  onTryPrompt,
  composerBusy = false,
}) {
  const baseId = useId().replace(/:/g, "");
  const [openId, setOpenId] = useState("chat");

  const toggle = useCallback((id) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const borderSubtle = darkRail ? "border-slate-600" : "border-slate-200";
  const cardMuted = darkRail ? "bg-slate-800/80" : "bg-slate-50";
  const textMuted = darkRail ? "text-slate-400" : "text-slate-500";
  const textBody = darkRail ? "text-slate-300" : "text-slate-600";
  const triggerText = darkRail ? "text-slate-100" : "text-slate-900";
  const itemBorder = darkRail ? "border-slate-600/80" : "border-slate-200/90";

  return (
    <div className={`rounded-2xl border p-4 ${borderSubtle} ${cardMuted}`}>
      <h2 className={`text-base font-semibold tracking-tight ${triggerText}`}>
        Quick tips: how to use Ally
      </h2>
      <p className={`mt-1 text-[11px] leading-relaxed ${textMuted}`}>
        Tap a topic to expand. Use Try in chat to drop an example into the composer.
      </p>

      <ul className="mt-3 space-y-1.5" role="list">
        {TIPS.map((tip) => {
          const isOpen = openId === tip.id;
          const panelId = `${baseId}-panel-${tip.id}`;
          const buttonId = `${baseId}-btn-${tip.id}`;

          return (
            <li
              key={tip.id}
              className={`overflow-hidden rounded-xl border ${itemBorder} ${
                darkRail ? "bg-slate-900/40" : "bg-white"
              }`}
            >
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold ${triggerText}`}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(tip.id)}
                >
                  <span>{tip.title}</span>
                  <Chevron open={isOpen} darkRail={darkRail} />
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className={isOpen ? "block" : "hidden"}
              >
                <div className={`border-t px-3 py-2.5 ${itemBorder}`}>
                  <p className={`text-[11px] leading-relaxed ${textBody}`}>{tip.body}</p>
                  {tip.try && onTryPrompt ? (
                    <button
                      type="button"
                      disabled={composerBusy}
                      onClick={() => onTryPrompt(tip.try)}
                      className={`mt-2.5 w-full rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        darkRail
                          ? "border-sky-700 bg-sky-900/50 text-sky-100 hover:bg-sky-900/80"
                          : "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                      }`}
                    >
                      Try in chat
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
