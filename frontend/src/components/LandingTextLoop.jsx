import { useEffect, useRef, useState } from "react";

const STEP_MS = 380;
const HOLD_MS = 2400;
const RESET_MS = 320;

const SCENARIOS = [
  {
    id: "recap",
    user: "morning recap with my tasks + calendar",
    ally: "on it. lining up todos and today's schedule.",
    card: {
      title: "morning recap",
      status: "tasks + meetings",
      accent: "primary",
    },
  },
  {
    id: "reminder",
    user: "text me 1hr before my 2pm so i know when to leave",
    ally: "got you. i'll ping you an hour out with buffer.",
    card: {
      title: "2pm on calendar",
      status: "reminder queued",
      accent: "secondary",
    },
  },
  {
    id: "inbox",
    user: "text me nighttime summaries. reply to important email during the day",
    ally: "on it. evening recap at night, important threads handled while you work.",
    card: {
      title: "inbox triage",
      status: "night summary + day replies",
      accent: "primary",
    },
  },
  {
    id: "late",
    user: "still home. am i gonna be late to my 3pm?",
    ally: "checking your calendar. i'll nudge you when to leave + flag if it's tight.",
    card: {
      title: "3pm meeting",
      status: "watching your buffer",
      accent: "secondary",
    },
  },
  {
    id: "notes",
    user: "on a call. text me bullets and turn them into notes",
    ally: "got you. send messy thoughts as you go, i'll clean em up after.",
    card: {
      title: "design review",
      status: "joining call",
      statusVariant: "joining",
      accent: "primary",
    },
  },
];

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconGmail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7l8 6 8-6M4 7v10h16V7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const CARD_ICONS = {
  recap: IconList,
  reminder: IconCalendar,
  inbox: IconGmail,
  late: IconCalendar,
  notes: IconGmail,
};

function TypingDots() {
  return (
    <span className="alm-text-loop__dots" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function LandingTextLoop() {
  const rootRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [step, setStep] = useState(0);

  const scenario = SCENARIOS[scenarioIndex];
  const CardIcon = CARD_ICONS[scenario.id] || IconCalendar;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.35, rootMargin: "-6% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return undefined;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setStep(4);
      return undefined;
    }

    let cancelled = false;
    let index = scenarioIndex;

    async function runCycle() {
      setScenarioIndex(index);
      setStep(0);
      await wait(RESET_MS);
      if (cancelled) return;

      for (let s = 1; s <= 4; s += 1) {
        if (cancelled) return;
        setStep(s);
        await wait(STEP_MS);
      }

      await wait(HOLD_MS);
      if (cancelled) return;

      setStep(0);
      await wait(RESET_MS);
      if (cancelled) return;

      index = (index + 1) % SCENARIOS.length;
      runCycle();
    }

    runCycle();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loop owns scenario index
  }, [inView]);

  const show = (minStep) => step >= minStep;

  return (
    <section ref={rootRef} className="alm-text-loop" aria-labelledby="alm-text-loop-heading">
      <div className="alm-text-loop__grid">
        <div className="alm-text-loop__copy">
          <h2 id="alm-text-loop-heading" className="alm-text-loop__title">
            One text starts it.
            <br />
            Ally keeps the thread alive.
          </h2>
          <p className="alm-text-loop__sub">
            Tell Ally what to book, draft, or follow up on. Ally stays on the task and texts you when
            something moves in Gmail, Calendar, or Drive.
          </p>
        </div>

        <div
          className="alm-text-loop__stage"
          aria-live="polite"
          aria-atomic="true"
          key={scenario.id}
        >
          <div
            className={`alm-text-loop__bubble alm-text-loop__bubble--user${show(1) ? " is-visible" : ""}`}
          >
            {scenario.user}
          </div>

          <div
            className={`alm-text-loop__bubble alm-text-loop__bubble--ally${show(2) ? " is-visible" : ""}`}
          >
            {scenario.ally}
          </div>

          <div
            className={`alm-text-loop__card alm-text-loop__card--${scenario.card.accent}${
              show(3) ? " is-visible" : ""
            }`}
          >
            <span className={`alm-text-loop__card-icon alm-text-loop__card-icon--${scenario.card.accent}`}>
              <CardIcon />
            </span>
            <span className="alm-text-loop__card-body">
              <span className="alm-text-loop__card-title">{scenario.card.title}</span>
              <span
                className={`alm-text-loop__card-status${
                  scenario.card.statusVariant
                    ? ` alm-text-loop__card-status--${scenario.card.statusVariant}`
                    : ""
                }`}
              >
                {scenario.card.statusVariant === "joining" ? (
                  <span className="alm-text-loop__card-joining-dot" aria-hidden />
                ) : (
                  <span className={`alm-text-loop__card-dot alm-text-loop__card-dot--${scenario.card.accent}`} />
                )}
                {scenario.card.status}
              </span>
            </span>
          </div>

          <div className={`alm-text-loop__bubble alm-text-loop__bubble--dots${show(4) ? " is-visible" : ""}`}>
            <TypingDots />
          </div>
        </div>
      </div>
    </section>
  );
}
