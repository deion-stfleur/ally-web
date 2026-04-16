import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import MarketingFooter from "../components/MarketingFooter";
import MarketingNav from "../components/MarketingNav";
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

function IconTabChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" />
    </svg>
  );
}

function IconTabBook() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function IconTabFlask() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 3h6M10 9v11a2 2 0 002 2h0a2 2 0 002-2V9M8 3h8l-1 6H9L8 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTabRocket() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09zM12 15l-3-3a22 22 0 012-3A22 22 0 0122 2c0 5-3 9-7 10l-3-3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12H4s0-4 2-6" strokeLinecap="round" />
    </svg>
  );
}

function IconRocketKnob() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09zM12 15l-3-3a22 22 0 012-3A22 22 0 0122 2c0 5-3 9-7 10l-3-3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12H4s0-4 2-6" strokeLinecap="round" />
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

const TABS = [
  { id: "analyse", label: "Analyse", Icon: IconTabChart },
  { id: "train", label: "Train", Icon: IconTabBook },
  { id: "testing", label: "Testing", Icon: IconTabFlask },
  { id: "deploy", label: "Deploy", Icon: IconTabRocket },
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
  const showcaseRef = useRef(null);
  const [progressPct, setProgressPct] = useState(0);
  const [progressArmed, setProgressArmed] = useState(false);
  const [showAllyMark, setShowAllyMark] = useState(false);
  const rafRef = useRef(0);

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
  }, [progressArmed]);

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
            <strong>Message Ally. Check things off your list.</strong>{" "}
            <span>Gmail, Calendar, Drive—and more—in one conversation.</span>
          </h1>
          <p className="alm-hero__lead">
            Sign in with Google, then chat or text a plain request: summarize a thread,
            prep for a meeting, find a file—whatever you need next, without tab sprawl.
          </p>
          <Link to="/login" className="alm-hero__cta">
            Start free trial
          </Link>
        </section>

        <div className="alm-tabs">
          <div className="alm-tabs__track" role="tablist" aria-label="Product areas">
            {TABS.map((tab, i) => {
              const Icon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={i === activeTab}
                  className={`alm-tabs__btn${i === activeTab ? " is-active" : ""}`}
                  onClick={() => setActiveTab(i)}
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
        >
          <div className="alm-showcase__bg" />
          <div className="alm-showcase__overlay" />
          <div className="alm-showcase__content">
            <div className="alm-card">
              <h2 className="alm-card__title">Your day in a few messages</h2>
              <div className="alm-progress">
                <div className="alm-progress__wrap">
                  <div className="alm-progress__track">
                    <div
                      className="alm-progress__fill"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div
                    className={`alm-progress__tip${progressArmed ? " is-on" : ""}`}
                    style={{ left: `${Math.max(progressPct, 1)}%` }}
                    aria-hidden
                  >
                    <IconRocketKnob />
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
                <li>
                  <IconCheckCircle />
                  Text Ally something simple (&ldquo;Summarize my last thread&rdquo;)
                </li>
                <li>
                  <span className="alm-step" aria-hidden>
                    2
                  </span>
                  Ally pulls Gmail &amp; Calendar context
                  <IconChevRightSm />
                </li>
                <li className="is-muted">
                  <span className="alm-step" aria-hidden>
                    3
                  </span>
                  Get bullets, a draft, or next steps in one reply
                </li>
                <li className="is-muted">
                  <span className="alm-step" aria-hidden>
                    4
                  </span>
                  Ask again for whatever&apos;s next on your list
                </li>
              </ul>
            </div>
          </div>
          <div className="alm-floating">
            <IconSparkle />
            Drafting…
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
      </main>
      <MarketingFooter />
    </div>
  );
}
