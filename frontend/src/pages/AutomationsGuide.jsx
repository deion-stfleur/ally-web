import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import ChatMobileHeader from "../components/ChatMobileHeader";
import { useAuth } from "../hooks/useAuth";

const EXAMPLES = [
  {
    title: "Daily SMS recap",
    body: "Ask Ally to text you every morning with calendar + inbox highlights. Pro plan recommended.",
    prompts: [
      "Text me every weekday at 8am Eastern with today's calendar and urgent emails.",
      "Set a daily SMS watch at 9:00 AM America/New_York — calendar and top 3 emails.",
    ],
  },
  {
    title: "Schedule an email",
    body: "Draft now, send later — Ally queues the send for a specific time.",
    prompts: [
      "Schedule this email to send tomorrow at 9am: [paste draft]",
      "Email the team Friday at 5pm with subject … and body …",
    ],
  },
  {
    title: "Background task",
    body: "Long research or multi-step work — Ally runs in the background and texts you when done (keep the worker running on our server).",
    prompts: [
      "Research competitors for … and text me a bullet summary when done.",
      "Pull my last 5 Gmail threads with Acme and summarize next steps — background job.",
    ],
  },
  {
    title: "Todos by text or chat",
    body: "Quick tasks on web chat:",
    prompts: ["todo: Follow up with Jordan about the contract", "add todo: Send Q2 deck to finance"],
  },
];

export default function AutomationsGuide() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    document.documentElement.classList.add("ally-route-chat");
    return () => document.documentElement.classList.remove("ally-route-chat");
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-sky-50/50 text-slate-900">
      <ChatMobileHeader
        user={user}
        onNewChat={() => navigate("/chat")}
        onOpenSearch={() => navigate("/chat")}
        onLinkPhone={() => navigate("/chat")}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-5 py-6 pb-10 lg:max-w-2xl">
          <Link
            to="/chat"
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 lg:hidden"
          >
            <span aria-hidden>←</span> Back to Ally
          </Link>

          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Home</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Create Ally automations
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Automations start in chat or SMS — describe what you want in plain language. Ally sets up
            watches, scheduled sends, or background jobs when your plan supports it.
          </p>

          <ol className="mt-6 space-y-6">
            {EXAMPLES.map((ex, i) => (
              <li
                key={ex.title}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
              >
                <span className="text-xs font-medium text-slate-400">Step {i + 1}</span>
                <h2 className="mt-1 text-base font-semibold text-slate-900">{ex.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{ex.body}</p>
                <ul className="mt-3 space-y-2">
                  {ex.prompts.map((p) => (
                    <li
                      key={p}
                      className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-snug text-slate-800"
                    >
                      &ldquo;{p}&rdquo;
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <div className="mt-8 rounded-2xl border border-violet-100 bg-violet-50/80 p-4">
            <p className="text-sm leading-relaxed text-violet-950">
              <strong className="font-semibold">Tip:</strong> Link your phone in Ally to run the same
              automations over text. Daily SMS watches need{" "}
              <strong className="font-semibold">Ally Pro</strong> and a verified mobile number.
            </p>
            <Link
              to="/chat"
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Open Ally chat
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
