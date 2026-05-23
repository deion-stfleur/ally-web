import "./ally-quick-tips.css";

const TIPS = [
  {
    id: "chat",
    accent: "sky",
    title: "Start in web chat",
    body: "Sign in with Google, then ask in plain language. Ally can read Gmail, Calendar, Drive, and Sheets when you grant access.",
    try: "What meetings do I have tomorrow?",
  },
  {
    id: "sms",
    accent: "emerald",
    title: "Text Ally from your phone",
    body: "Save your mobile number, pick a plan with SMS, then send the first text to Ally’s line. Replies stay tied to the same Google account as this session.",
    try: null,
  },
  {
    id: "email",
    accent: "cyan",
    title: "Draft and schedule email",
    body: "Paste a draft and ask Ally to send it later, or say who should receive it and when. Ally confirms before anything goes out if you want that guardrail.",
    try: "Draft a follow-up to Alex about the proposal",
  },
  {
    id: "todo",
    accent: "amber",
    title: "Quick todos",
    body: "Add tasks from chat with a simple prefix. They show up in your To Do list on the right.",
    try: "todo: Send the Q2 deck to finance",
  },
  {
    id: "automations",
    accent: "blue",
    title: "Pro automations",
    body: "Ask for daily SMS recaps, inbox watches, or background research. Pro plans unlock proactive texts and longer-running jobs.",
    try: "Text me weekdays at 8am with calendar and urgent mail",
    pro: true,
  },
  {
    id: "receipts",
    accent: "teal",
    title: "Receipts to Sheets",
    body: "Attach a receipt photo in chat or describe the row you want. Tell Ally which spreadsheet to use — it can append when you confirm.",
    try: "Add this receipt to my expenses sheet",
  },
];

function TipIconById({ id, accent }) {
  const map = {
    chat: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
      />
    ),
    sms: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
      />
    ),
    email: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    ),
    todo: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    automations: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    ),
    receipts: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    ),
  };

  return (
    <span className={`ally-quick-tips__icon ally-quick-tips__icon--${accent}`} aria-hidden>
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        {map[id]}
      </svg>
    </span>
  );
}

export default function AllyQuickTips({
  darkRail = false,
  onTryPrompt,
  composerBusy = false,
}) {
  const rootClass = [
    "ally-quick-tips",
    darkRail ? "ally-quick-tips--dark" : "ally-quick-tips--light",
  ].join(" ");

  return (
    <div className={rootClass}>
      <div className="ally-quick-tips__header">
        <span className="ally-quick-tips__badge">Guide</span>
        <h2 className="ally-quick-tips__title">Quick tips: how to use Ally</h2>
        <p className="ally-quick-tips__sub">
          Use <strong>Try in chat</strong> to drop an example into the composer.
        </p>
      </div>

      <ul className="ally-quick-tips__list">
        {TIPS.map((tip) => (
          <li
            key={tip.id}
            className={[
              "ally-quick-tips__item",
              `ally-quick-tips__item--${tip.accent}`,
            ].join(" ")}
          >
            <div className="ally-quick-tips__card-head">
              <TipIconById id={tip.id} accent={tip.accent} />
              <h3 className="ally-quick-tips__card-title">
                {tip.title}
                {tip.pro ? <span className="ally-quick-tips__pro-pill">Pro</span> : null}
              </h3>
            </div>
            <p className="ally-quick-tips__body">{tip.body}</p>
            {tip.try && onTryPrompt ? (
              <button
                type="button"
                disabled={composerBusy}
                onClick={() => onTryPrompt(tip.try)}
                className="ally-quick-tips__try"
              >
                Try in chat
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
