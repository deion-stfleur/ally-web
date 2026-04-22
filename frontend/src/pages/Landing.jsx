import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import LandingAutomations from "../components/LandingAutomations";
import MarketingFooter from "../components/MarketingFooter";
import MarketingNav from "../components/MarketingNav";
import SmsPhoneShowcase from "../components/SmsPhoneShowcase";
import allyAvatar from "../assets/nav-brand.png";
import {
  IconAndroid,
  IconApple,
  IconGmail,
  IconGoogle,
  IconGoogleCalendar,
  IconGoogleSheets,
} from "./IntegrationIcons";
import "./ally-lp.css";

function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function IconTabInbox() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m22 6-10 7L2 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTabCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function IconTabDraft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M12 18v-6M9 15h6" strokeLinecap="round" />
    </svg>
  );
}

function IconTabSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg className="alm-checklist__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevRightSm() {
  return (
    <svg className="alm-checklist__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#7c3aed"
        d="M12 2l1.2 4.2L17 7l-3.8 1.8L12 13l-1.2-4.2L7 7l3.8-1.8L12 2zm7 9l.7 2.5L22 14l-2.3 1-.7 2.5L17 16l-2.3 1 .7-2.5L13 14l2.3-1 2.3-1z"
      />
    </svg>
  );
}

/**
 * Each tab drives a unique showcase card + progress accent so the preview matches how people use Ally.
 */
const SHOWCASE_TABS = [
  {
    id: "catchup",
    label: "Catch up",
    Icon: IconTabInbox,
    accent: "#0284c7",
    progressGradient: "linear-gradient(90deg, #38bdf8 0%, #0369a1 100%)",
    cardTitle: "What changed while you were away",
    floating: "Summarizing threads…",
    steps: [
      {
        type: "done",
        text: "Point Ally at a messy thread or label—she reads it like a teammate.",
      },
      {
        type: "current",
        step: 2,
        text: "She stacks recent Gmail + Calendar context into one tight recap.",
        chevron: true,
      },
      {
        type: "todo",
        step: 3,
        text: "You get bullets, owners, and what can wait till Monday.",
      },
      {
        type: "todo",
        step: 4,
        text: "Follow up in chat or SMS with the next “what about…?”",
      },
    ],
  },
  {
    id: "prep",
    label: "Prep",
    Icon: IconTabCalendar,
    accent: "#059669",
    progressGradient: "linear-gradient(90deg, #34d399 0%, #047857 100%)",
    cardTitle: "Walk into the room already briefed",
    floating: "Pulling your calendar…",
    steps: [
      {
        type: "done",
        text: "Tell Ally who the meeting’s with and what you’re nervous about.",
      },
      {
        type: "current",
        step: 2,
        text: "She pulls the invite, last thread, and any Drive doc linked to it.",
        chevron: true,
      },
      {
        type: "todo",
        step: 3,
        text: "You get a short brief: goals, risks, suggested questions.",
      },
      {
        type: "todo",
        step: 4,
        text: "Ask for a tougher version—or a one-liner for Slack on the way in.",
      },
    ],
  },
  {
    id: "draft",
    label: "Draft",
    Icon: IconTabDraft,
    accent: "#7c3aed",
    progressGradient: "linear-gradient(90deg, #a78bfa 0%, #5b21b6 100%)",
    cardTitle: "Sound like you—not a template",
    floating: "Drafting in your voice…",
    steps: [
      {
        type: "done",
        text: "Paste a rough idea or bullet list—no polished paragraph required.",
      },
      {
        type: "current",
        step: 2,
        text: "Ally turns it into a Gmail draft or Google Doc in your workspace.",
        chevron: true,
      },
      {
        type: "todo",
        step: 3,
        text: "Tune tone (warmer, shorter, more direct) in the same thread.",
      },
      {
        type: "todo",
        step: 4,
        text: "When it feels right, send—or schedule—for later in one instruction.",
      },
    ],
  },
  {
    id: "send",
    label: "Send",
    Icon: IconTabSend,
    accent: "#ea580c",
    progressGradient: "linear-gradient(90deg, #fb923c 0%, #c2410c 100%)",
    cardTitle: "Close the loop without another tab",
    floating: "Scheduling send…",
    steps: [
      {
        type: "done",
        text: "Lock the final draft with Ally when you’re happy with the wording.",
      },
      {
        type: "current",
        step: 2,
        text: "She can schedule send, set reminders, or queue a follow-up nudge.",
        chevron: true,
      },
      {
        type: "todo",
        step: 3,
        text: "You stay in one conversation while Gmail + Calendar update underneath.",
      },
      {
        type: "todo",
        step: 4,
        text: "Stack the next errand—Ally keeps context from this thread.",
      },
    ],
  },
];

const INTEGRATIONS = [
  { label: "Google", Icon: IconGoogle },
  { label: "Gmail", Icon: IconGmail },
  { label: "Sheets", Icon: IconGoogleSheets },
  { label: "Calendar", Icon: IconGoogleCalendar },
  { label: "Apple", Icon: IconApple },
  { label: "Android", Icon: IconAndroid },
];

const PROGRESS_TARGET = 99;

export default function Landing() {
  const [activeTab, setActiveTab] = useState(0);
  const [progressNonce, setProgressNonce] = useState(0);
  const showcaseRef = useRef(null);
  const [progressPct, setProgressPct] = useState(0);
  const [progressArmed, setProgressArmed] = useState(false);
  const [showAllyMark, setShowAllyMark] = useState(false);
  const rafRef = useRef(0);
  const panel = SHOWCASE_TABS[activeTab];

  useEffect(() => {
    const el = showcaseRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.28) {
          setProgressArmed((prev) => prev || true);
        }
      },
      { threshold: [0, 0.28, 0.5, 1], rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!progressArmed) return undefined;
    setProgressPct(0);
    setShowAllyMark(false);
    const t0 = performance.now();
    const duration = 2000;
    let cancelled = false;

    function tick(now) {
      if (cancelled) return;
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - p) ** 3;
      const v = Math.round(eased * PROGRESS_TARGET);
      setProgressPct(v);
      if (v >= 6) setShowAllyMark(true);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [progressArmed, progressNonce]);

  function handleTabClick(index) {
    setActiveTab(index);
    setProgressPct(0);
    setShowAllyMark(false);
    setProgressNonce((n) => n + 1);
  }

  return (
    <div className="alm">
      <MarketingNav />

      <main className="alm-main">
        <section className="alm-hero">
          <div className="alm-badge">
            <IconStar />
            Works with the tools you already use
          </div>
          <h1 className="alm-hero__title">
            <strong>Say hello to Ally. Your AI native assistant.</strong>{" "}
          </h1>
          <p className="alm-hero__lead">
           Get things done or find answers—right from your texts.
          </p>
          <Link to="/login" className="alm-hero__cta">
            Start free trial
          </Link>
        </section>

        <div className="alm-tabs" style={{ "--tab-accent": panel.accent }}>
          <div className="alm-tabs__track" role="tablist" aria-label="How you use Ally">
            {SHOWCASE_TABS.map((tab, i) => {
              const Icon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={i === activeTab}
                  className={`alm-tabs__btn${i === activeTab ? " is-active" : ""}`}
                  onClick={() => handleTabClick(i)}
                >
                  <Icon />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <section
          ref={showcaseRef}
          className="alm-showcase"
          aria-label="Product preview"
          style={{ "--showcase-accent": panel.accent }}
        >
          <div className="alm-showcase__bg" />
          <div className="alm-showcase__overlay" />
          <div className="alm-showcase__content">
            <div className="alm-card">
              <h2 className="alm-card__title">{panel.cardTitle}</h2>
              <div className="alm-progress">
                <div className="alm-progress__wrap">
                  <div className="alm-progress__track">
                    <div
                      className="alm-progress__fill"
                      style={{
                        width: `${progressPct}%`,
                        background: panel.progressGradient,
                      }}
                    />
                  </div>
                  <div
                    className={`alm-progress__tip${progressArmed ? " is-on" : ""}`}
                    style={{
                      left: `${Math.max(progressPct, 1)}%`,
                      borderColor: panel.accent,
                    }}
                    aria-hidden
                  >
                    <img src={allyAvatar} alt="" className="alm-progress__tip-avatar" width={40} height={40} />
                  </div>
                </div>
                <div className="alm-progress__meta">
                  <span
                    className={`alm-progress__brand${showAllyMark ? " is-visible" : ""}`}
                    aria-hidden
                  >
                    ✳ ally
                  </span>
                  <span className="alm-progress__pct">{progressPct}%</span>
                </div>
              </div>
              <ul className="alm-checklist">
                {panel.steps.map((row, idx) => {
                  const rowKey = `${panel.id}-${idx}`;
                  if (row.type === "done") {
                    return (
                      <li key={rowKey}>
                        <IconCheckCircle />
                        {row.text}
                      </li>
                    );
                  }
                  if (row.type === "current") {
                    return (
                      <li key={rowKey}>
                        <span className="alm-step" aria-hidden>
                          {row.step}
                        </span>
                        {row.text}
                        {row.chevron ? <IconChevRightSm /> : null}
                      </li>
                    );
                  }
                  return (
                    <li key={rowKey} className="is-muted">
                      <span className="alm-step" aria-hidden>
                        {row.step}
                      </span>
                      {row.text}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <div className="alm-floating">
            <IconSparkle />
            {panel.floating}
          </div>
        </section>

        <footer className="alm-integ" id="integrations">
          <p className="alm-integ__label">Integrates with</p>
          <div className="alm-integ__row">
            {INTEGRATIONS.map(({ label, Icon }) => (
              <div key={label} className="alm-integ__item">
                <span className="alm-integ__icon-wrap">
                  <Icon />
                </span>
                <span className="alm-integ__name">{label}</span>
              </div>
            ))}
          </div>
        </footer>

        <LandingAutomations />

        <SmsPhoneShowcase />
      </main>
      <MarketingFooter />
    </div>
  );
}
