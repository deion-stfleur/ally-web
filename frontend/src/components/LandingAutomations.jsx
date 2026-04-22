import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import allyAvatar from "../assets/nav-brand.png";

const GAP_PX = 16;

function IconVerified() {
  return (
    <svg className="alm-auto__verified" width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#2563eb" />
      <path
        fill="#fff"
        d="M10.2 14.4l-2.5-2.5 1.1-1.1 1.4 1.4 3.5-3.5 1.1 1.1-4.6 4.6z"
      />
    </svg>
  );
}

function IconChevLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** At most two sentences each — keep under ~200 chars for card density. */
const AUTOMATIONS = [
  {
    id: "hydration",
    title: "Water reminders that don’t nag",
    copy: "Light nudges when you need them, quiet when you don’t. Stay on track without the lecture.",
    iconBg: "#e0f2fe",
    iconColor: "#0369a1",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2.5c2 3.5 5 7.2 5 11a5 5 0 11-10 0c0-3.8 3-7.5 5-11z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "shorts",
    title: "Turn video ideas into tasks or notes",
    copy: "Save an idea before it vanishes—paste a link or a rough note. Turn it into todos or a draft in one thread.",
    iconBg: "#fce7f3",
    iconColor: "#be185d",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M17 9l4-2v10l-4-2V9z" fill="currentColor" opacity="0.35" />
      </svg>
    ),
  },
  {
    id: "assistant",
    title: "Your inbox and calendar in plain English",
    copy: "Ask in plain language like you would with Assistant. Ally answers from your Gmail, Calendar, and Drive.",
    iconBg: "#e8f0fe",
    iconColor: "#1a73e8",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <circle cx="9" cy="12" r="4.5" fill="currentColor" />
        <circle cx="16.5" cy="8" r="3" fill="currentColor" opacity="0.55" />
        <circle cx="16.5" cy="16" r="3" fill="currentColor" opacity="0.55" />
      </svg>
    ),
  },
  {
    id: "drive-image",
    title: "Upload a picture—extract text or summarize it",
    copy: "Receipts, screenshots, whiteboards, or slides. Ally pulls out text, bullets, or next steps and can stash a note in Drive.",
    iconBg: "#ecfeff",
    iconColor: "#0e7490",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M8 15l3-3 3 3 4-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="9" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "sheets-append",
    title: "Log numbers or notes straight into Sheets",
    copy: "Track spend, miles, or inventory in plain sentences. Ally appends a clean row to the spreadsheet you pick—no copy-paste.",
    iconBg: "#e6f4ea",
    iconColor: "#137333",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 6h16v12H4V6z" stroke="currentColor" strokeWidth="1.75" />
        <path d="M4 10h16M10 6v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "calendar-block",
    title: "Describe a meeting; get a Calendar event",
    copy: "Say who, what, and roughly when. Ally drafts the invite, checks conflicts, and drops it on your Google Calendar.",
    iconBg: "#fce8e6",
    iconColor: "#c5221f",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
        <path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M9 14h2M13 14h2M9 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "todos",
    title: "Handle your to-do list right in chat",
    copy: "Add and check things off without another tab. Your list lives in the same conversation.",
    iconBg: "#fef3c7",
    iconColor: "#b45309",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "journal",
    title: "Voice or text turned into a journal entry",
    copy: "Dump the day in voice or text. Ally shapes it into a short entry you can search later.",
    iconBg: "#ede9fe",
    iconColor: "#5b21b6",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 4h10a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M8 9h8M8 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "meals",
    title: "Say what you ate and get a neat log",
    copy: "Say what you ate in plain words. Ally formats a clean row for Sheets or your tracker.",
    iconBg: "#dcfce7",
    iconColor: "#15803d",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 13h12v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6z" stroke="currentColor" strokeWidth="1.75" />
        <path d="M9 13V9a3 3 0 016 0v4M12 3v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "trends",
    title: "See how busy your week really was",
    copy: "See what moved: inbox load, tasks closed, and calendar crunch. Ask anytime—great before standup.",
    iconBg: "#f1f5f9",
    iconColor: "#334155",
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 19h16M7 16V10M12 16V6M17 16v-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
];

const SLIDE_COUNT = AUTOMATIONS.length;
const LOOP_ITEMS = [...AUTOMATIONS, ...AUTOMATIONS, ...AUTOMATIONS].map((item, i) => ({
  ...item,
  loopKey: `${item.id}-${i}`,
  loopIndex: i,
}));

export default function LandingAutomations() {
  const scrollerRef = useRef(null);
  const setWRef = useRef(0);
  const loopingRef = useRef(false);

  const remeasure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const cards = el.querySelectorAll(".alm-auto__card");
    if (cards.length < SLIDE_COUNT * 2) return;
    const c0 = cards[0];
    const cN = cards[SLIDE_COUNT];
    const setW = cN.offsetLeft - c0.offsetLeft;
    if (setW > 0) setWRef.current = setW;
  }, []);

  /** First card of the middle triplet, centered in the viewport. */
  const centerMiddleHead = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const cards = el.querySelectorAll(".alm-auto__card");
    const midHead = cards[SLIDE_COUNT];
    if (!midHead) return;
    const target =
      midHead.offsetLeft + midHead.offsetWidth / 2 - el.clientWidth / 2;
    el.scrollLeft = Math.max(0, target);
  }, []);

  const loopScroll = useCallback(() => {
    const el = scrollerRef.current;
    const setW = setWRef.current;
    if (!el || !setW || loopingRef.current) return;
    /* All cards fit — no horizontal loop (avoids jump flicker on wide screens). */
    if (el.scrollWidth <= el.clientWidth + setW * 0.35) return;

    /* Near start of first copy — jump forward one full cycle (seamless loop). */
    if (el.scrollLeft < setW * 0.22) {
      loopingRef.current = true;
      el.scrollLeft += setW;
      requestAnimationFrame(() => {
        loopingRef.current = false;
      });
      return;
    }

    /* Near end of third copy — jump back one cycle so the strip repeats. */
    if (el.scrollLeft + el.clientWidth > el.scrollWidth - 12) {
      loopingRef.current = true;
      el.scrollLeft -= setW;
      requestAnimationFrame(() => {
        loopingRef.current = false;
      });
    }
  }, []);

  const onScroll = useCallback(() => {
    loopScroll();
  }, [loopScroll]);

  useLayoutEffect(() => {
    remeasure();
    centerMiddleHead();
    requestAnimationFrame(() => {
      remeasure();
      centerMiddleHead();
    });
  }, [remeasure, centerMiddleHead]);

  useEffect(() => {
    const onResize = () => {
      remeasure();
      centerMiddleHead();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [remeasure, centerMiddleHead]);

  function scrollByDir(dir) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector(".alm-auto__card");
    const cardW = card ? card.offsetWidth + GAP_PX : 296;
    const step = Math.min(cardW, Math.max(200, el.clientWidth * 0.72));
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <section className="alm-auto" aria-labelledby="alm-auto-heading">
      <div className="alm-auto__head">
        <h2 id="alm-auto-heading" className="alm-auto__title">
          Ally works for everyone
        </h2>
        <p className="alm-auto__sub">Get started with these text automations</p>
      </div>

      <div className="alm-auto__carousel-wrap">
        <button
          type="button"
          className="alm-auto__arrow alm-auto__arrow--prev"
          aria-label="Scroll automations left"
          onClick={() => scrollByDir(-1)}
        >
          <IconChevLeft />
        </button>
        <div ref={scrollerRef} className="alm-auto__scroller" onScroll={onScroll}>
          {LOOP_ITEMS.map((item) => {
            const Icon = item.Icon;
            return (
              <article
                key={item.loopKey}
                className="alm-auto__card"
                data-loop-index={item.loopIndex}
              >
                <div
                  className="alm-auto__card-icon"
                  style={{ background: item.iconBg, color: item.iconColor }}
                >
                  <Icon />
                </div>
                <h3 className="alm-auto__card-title">{item.title}</h3>
                <p className="alm-auto__card-copy">{item.copy}</p>
                <div className="alm-auto__author">
                  <img src={allyAvatar} alt="" width={28} height={28} className="alm-auto__author-avatar" />
                  <span className="alm-auto__author-name">Ally Team</span>
                  <IconVerified />
                </div>
                <Link to="/login" className="alm-auto__card-cta">
                  Get Started
                </Link>
              </article>
            );
          })}
        </div>
        <button
          type="button"
          className="alm-auto__arrow alm-auto__arrow--next"
          aria-label="Scroll automations right"
          onClick={() => scrollByDir(1)}
        >
          <IconChevRight />
        </button>
      </div>
    </section>
  );
}
