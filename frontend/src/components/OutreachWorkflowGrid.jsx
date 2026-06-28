import { useCallback, useEffect, useRef, useState } from "react";
import AllyAvatar from "./AllyAvatar";

const TOOL_META = {
  gmail: {
    label: "Gmail",
    search: "Scans threads & labels",
    execute: "Drafts or schedules send",
    result: "Texts draft for your OK",
  },
  calendar: {
    label: "Calendar",
    search: "Reads events & gaps",
    execute: "Blocks time or builds brief",
    result: "Texts schedule summary",
  },
  drive: {
    label: "Drive",
    search: "Finds folders & files",
    execute: "Pulls docs & assembles",
    result: "Texts what's ready",
  },
  sheets: {
    label: "Sheets",
    search: "Opens your tracker",
    execute: "Logs row or updates pipeline",
    result: "Texts confirmation",
  },
  background: {
    label: "Background",
    search: "Queues long-running job",
    execute: "Researches & compiles",
    result: "Texts when finished",
  },
};

const FILTER_OPTIONS = [
  { id: "all", label: "All workflows" },
  { id: "gmail", label: "Gmail" },
  { id: "calendar", label: "Calendar" },
  { id: "drive", label: "Drive" },
  { id: "sheets", label: "Sheets" },
  { id: "background", label: "Background" },
];

function ToolIcon({ toolId }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true };
  switch (toolId) {
    case "gmail":
      return (
        <svg {...common}>
          <path
            d="M4 7l8 6 8-6M4 7v10h16V7"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
          <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case "drive":
      return (
        <svg {...common}>
          <path
            d="M12 4L4 18h16L12 4zM8.5 16h7"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "sheets":
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
          <path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path
            d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

function stripQuotes(text) {
  return (text || "").replace(/^"|"$/g, "").trim();
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function WorkflowCard({ item, toolId, toolLabel }) {
  const meta = TOOL_META[toolId] || TOOL_META.background;
  const prompt = stripQuotes(item.example);
  const cardRef = useRef(null);
  const hasAutoPlayed = useRef(false);
  const finishedRef = useRef(false);
  const playingRef = useRef(false);
  const [activeStep, setActiveStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);

  const steps = [
    {
      key: "ask",
      label: "You text",
      detail: prompt,
      type: "prompt",
    },
    {
      key: "find",
      label: "Ally finds",
      detail: meta.search,
      type: "tool",
    },
    {
      key: "execute",
      label: "Ally executes",
      detail: item.title,
      type: "ally",
    },
    {
      key: "notify",
      label: "Ally texts back",
      detail: meta.result,
      type: "result",
    },
  ];

  const playWorkflow = useCallback(async () => {
    if (playingRef.current || finishedRef.current) return;
    playingRef.current = true;
    setPlaying(true);
    setActiveStep(0);
    await wait(120);
    for (let s = 1; s <= 4; s += 1) {
      setActiveStep(s);
      await wait(520);
    }
    finishedRef.current = true;
    playingRef.current = false;
    setPlaying(false);
    setFinished(true);
  }, []);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return undefined;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      finishedRef.current = true;
      setActiveStep(4);
      setFinished(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !hasAutoPlayed.current) {
          hasAutoPlayed.current = true;
          playWorkflow();
        }
      },
      { threshold: 0.55 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [playWorkflow]);

  const stepLit = (index) => activeStep >= index + 1;

  return (
    <article
      ref={cardRef}
      className={`biz-workflow-card${playing ? " is-playing" : ""}${activeStep > 0 ? " is-active" : ""}${finished ? " is-complete" : ""}`}
      style={{ "--workflow-step": activeStep }}
      tabIndex={0}
      aria-label={`${item.title} workflow in ${meta.label}`}
    >
      <header className="biz-workflow-card__head">
        <span className={`biz-workflow-card__tool biz-workflow-card__tool--${toolId}`}>
          <ToolIcon toolId={toolId} />
          {toolLabel || meta.label}
        </span>
        <h3 className="biz-workflow-card__title">{item.title}</h3>
      </header>

      <div className="biz-workflow-card__pipeline" aria-hidden>
        <span className="biz-workflow-card__track" />
        <span className="biz-workflow-card__track-fill" />
        {steps.map((step, i) => (
          <div key={step.key} className="biz-workflow-card__step-wrap">
            <div className={`biz-workflow-card__step${stepLit(i) ? " is-lit" : ""}`}>
              <span className="biz-workflow-card__step-num">{i + 1}</span>
              <span className="biz-workflow-card__step-label">{step.label}</span>
              <div className={`biz-workflow-card__step-panel biz-workflow-card__step-panel--${step.type}`}>
                {step.type === "ally" && (
                  <AllyAvatar className="biz-workflow-card__ally-mini" decorative />
                )}
                {step.type === "tool" && <ToolIcon toolId={toolId} />}
                <p className="biz-workflow-card__step-detail">{step.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!finished && (
        <p className="biz-workflow-card__hint">Steps animate once when this card scrolls into view</p>
      )}
    </article>
  );
}

export default function OutreachWorkflowGrid({ groups, businessName }) {
  const [filter, setFilter] = useState("all");

  const items = groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      toolId: group.id,
      toolLabel: group.label,
    }))
  );

  const visible =
    filter === "all" ? items : items.filter((item) => item.toolId === filter);

  return (
    <section className="biz-outreach__workflows" aria-labelledby="biz-outreach-workflows">
      <div className="biz-outreach__workflows-head">
        <h2 id="biz-outreach-workflows" className="biz-outreach__section-title">
          How Ally works for {businessName}
        </h2>
        <p className="biz-outreach__workflows-sub">
          Each card shows the full loop — your text, what Ally finds in Google, what she executes,
          and the SMS you get back.
        </p>
      </div>

      <div className="biz-outreach__filters" role="tablist" aria-label="Filter by Google tool">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={filter === opt.id}
            className={`biz-outreach__filter${filter === opt.id ? " is-selected" : ""}`}
            onClick={() => setFilter(opt.id)}
          >
            {opt.id !== "all" && <ToolIcon toolId={opt.id} />}
            {opt.label}
          </button>
        ))}
      </div>

      <div className="biz-outreach__workflow-grid">
        {visible.map((item) => (
          <WorkflowCard
            key={`${item.toolId}-${item.title}`}
            item={item}
            toolId={item.toolId}
            toolLabel={item.toolLabel}
          />
        ))}
      </div>
    </section>
  );
}
