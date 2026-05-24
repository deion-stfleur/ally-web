import { Link, useNavigate } from "react-router-dom";
import AppShellHeader from "../components/AppShellHeader";
import InPageMobileFooter from "../components/InPageMobileFooter";
import FadeInSection from "../components/FadeInSection";
import { useAuth } from "../hooks/useAuth";

const EXAMPLES = [
  {
    title: "Daily SMS recap",
    body: "Morning text with calendar and inbox highlights.",
    prompts: [
      "Text me every weekday at 8am Eastern with today's calendar and urgent emails.",
      "Set a daily SMS watch at 9:00 AM America/New_York — calendar and top 3 emails.",
    ],
  },
  {
    title: "Schedule an email",
    body: "Draft now, send at a set time.",
    prompts: [
      "Schedule this email to send tomorrow at 9am: [paste draft]",
      "Email the team Friday at 5pm with subject … and body …",
    ],
  },
  {
    title: "Background task",
    body: "Ally works in the background, texts when done.",
    prompts: [
      "Research competitors for … and text me a bullet summary when done.",
      "Pull my last 5 Gmail threads with Acme and summarize next steps — background job.",
    ],
  },
  {
    title: "Todos by text or chat",
    body: "Quick tasks from chat or SMS.",
    prompts: ["todo: Follow up with Jordan about the contract", "add todo: Send Q2 deck to finance"],
  },
];

export default function AutomationsGuide() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="automations-guide bg-sky-50/50 text-slate-900">
      <AppShellHeader
        title="Automations"
        showBack
        onBack={() => navigate("/home")}
        user={user}
      />

      <div className="automations-guide__inner mx-auto max-w-lg px-4 py-6 pb-6 sm:px-5 lg:max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Home</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Create Ally automations
          </h1>
          <p className="mt-2 text-sm text-slate-600">Plain language in chat or SMS.</p>

          <ol className="automations-guide__steps mt-6 space-y-5">
            {EXAMPLES.map((ex, i) => (
              <FadeInSection key={ex.title} as="li" className="automations-guide__step">
                <span className="automations-guide__step-num">Step {i + 1}</span>
                <h2 className="automations-guide__step-title">{ex.title}</h2>
                <p className="automations-guide__step-body">{ex.body}</p>
                <ul className="automations-guide__bubbles">
                  {ex.prompts.map((p) => (
                    <li key={p} className="automations-guide__bubble-wrap">
                      <p className="automations-guide__bubble">{p}</p>
                    </li>
                  ))}
                </ul>
              </FadeInSection>
            ))}
          </ol>

          <FadeInSection className="automations-guide__tip mt-8">
            <p className="automations-guide__tip-text">
              <strong className="font-semibold">Tip:</strong> Link your phone to run the same
              automations over text. Daily SMS watches need{" "}
              <strong className="font-semibold">Ally Pro</strong>.
            </p>
            <Link
              to="/chat"
              className="automations-guide__tip-cta mt-4 inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Open Ally chat
            </Link>
          </FadeInSection>
      </div>
      <InPageMobileFooter />
    </div>
  );
}
