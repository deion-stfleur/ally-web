import TextAllyHandoff from "./TextAllyHandoff";

export default function ChatLanding({ user, onPickPrompt, allySmsE164 = null }) {
  const first = user?.name?.split(/\s+/)[0] || "there";

  const tasks = [
    "Summarize my last Gmail thread",
    "Draft a follow-up after a meeting",
    "List files I touched this week",
  ];

  return (
    <div className="chat-landing-root mx-auto flex max-w-4xl flex-col items-center px-4 pb-8 pt-6">
      <div className="chat-landing-llama relative mb-6 h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-white bg-violet-50 shadow-xl shadow-violet-300/40 ring-4 ring-sky-100/90">
        <img
          src="/ally-llama.png"
          alt="Ally"
          width={112}
          height={112}
          className="h-full w-full object-cover object-center"
        />
      </div>

      <h1 className="text-center text-3xl font-semibold tracking-tight text-slate-900">
        Hi, {first}{" "}
        <span className="inline-block" role="img" aria-label="wave">
          👋
        </span>
      </h1>
      <p className="mt-2 max-w-lg text-center text-sm text-slate-500">
        Tell us what you need — email, Drive, Calendar, and more. We&apos;ll handle the rest.
      </p>

      {user?.sms_plan_active && user?.phone_e164 && allySmsE164 ? (
        <div className="chat-landing-handoff mt-8 w-full max-w-3xl">
          <TextAllyHandoff
            allySmsE164={allySmsE164}
            userPhoneE164={user.phone_e164}
          />
        </div>
      ) : user?.sms_plan_active && !user?.phone_e164 ? (
        <p className="mt-6 max-w-md text-center text-sm text-violet-800">
          Link your phone in the popup to text Ally from Messages — save your number, then send &quot;Hi
          Ally&quot; to get off the web app.
        </p>
      ) : null}

      <div className="chat-landing-tasks mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-lg shadow-slate-900/20">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-300/90">
            Workspace assistant
          </p>
          <p className="mt-2 text-lg font-semibold leading-snug">
            {user?.name || "Your Ally"}
          </p>
          <span className="mt-3 inline-block rounded-full bg-sky-500/20 px-2.5 py-0.5 text-xs font-medium text-sky-200">
            Gmail · Drive · Docs
          </span>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            Grounded in your Google account. Confirm before anything sends.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Tasks</h3>
          <ul className="mt-3 space-y-2.5">
            {tasks.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => onPickPrompt(t)}
                  className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  <span className="mt-0.5 text-slate-400" aria-hidden>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </span>
                  <span>{t}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-medium text-sky-600">Tap a task to try it</p>
        </div>
      </div>
    </div>
  );
}
