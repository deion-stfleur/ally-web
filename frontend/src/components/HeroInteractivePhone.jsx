import { useCallback, useEffect, useRef, useState } from "react";
import AllyMark from "./AllyMark";

const DEMO_SCRIPT = [
  { who: "ally", text: "hey. text me an errand. calendar, inbox, research, whatever you need." },
  { who: "user", text: "what's on my calendar tomorrow?" },
  {
    who: "ally",
    text: "standup 9:30, 1:1 w/ jordan at 11, focus block 2-4. want prep notes for either?",
  },
  { who: "user", text: "summarize my last email from alex" },
  {
    who: "ally",
    text: "on it. 3 bullets plus a reply you can paste into gmail. texting you in a sec.",
  },
  { who: "user", text: "also join my 3pm product sync on zoom" },
  {
    who: "ally",
    text: "got it. i'll join, take notes, and text you a recap when it ends.",
  },
  { who: "user", text: "need a gift for my mom, she loves gardening" },
  {
    who: "ally",
    text: "nice. what's your budget and when do you need it? i'll send a few links that fit.",
  },
  { who: "user", text: "under $60, her birthday is next week" },
  {
    who: "ally",
    text: "looking now. planter sets, herb kits, and a hand tool set. texting options.",
  },
  { who: "user", text: "book dinner saturday under $80" },
  {
    who: "ally",
    text: "checking tables near you for saturday evening. i'll send 2-3 picks to confirm.",
  },
  { who: "user", text: "any good books on productivity?" },
  {
    who: "ally",
    text: "deep work, atomic habits, and make time are the ones people love. want a quick why for each?",
  },
  { who: "user", text: "yeah send those" },
  {
    who: "ally",
    text: "on it. texting quick summaries you can skim in 30 seconds.",
  },
];

const MS_PER_CHAR = 62;
const USER_AFTER_TYPE_MS = 900;
const ALLY_TYPING_BASE_MS = 1400;
const ALLY_MS_PER_CHAR = 28;
const PAUSE_MS = 850;
const LOOP_PAUSE_MS = 5500;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function allyTypingMs(text) {
  return Math.min(3400, ALLY_TYPING_BASE_MS + text.length * ALLY_MS_PER_CHAR);
}

function IconChevLeft() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.5 6.5L8 12l6.5 5.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M19 11a7 7 0 01-14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TypingDots() {
  return (
    <span className="alm-hero-phone__ai-dots" aria-hidden>
      <span className="alm-hero-phone__ai-dot" />
      <span className="alm-hero-phone__ai-dot" />
      <span className="alm-hero-phone__ai-dot" />
    </span>
  );
}

export default function HeroInteractivePhone() {
  const [messages, setMessages] = useState([]);
  const [typingWho, setTypingWho] = useState(null);
  const [composerPreview, setComposerPreview] = useState("");
  const threadRef = useRef(null);

  const scrollThread = useCallback(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollThread();
  }, [messages, typingWho, composerPreview, scrollThread]);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cancelled = false;

    async function playScript() {
      if (reduce) {
        setMessages(DEMO_SCRIPT.map((line, i) => ({ id: `m-${i}`, ...line })));
        setTypingWho(null);
        setComposerPreview("");
        return;
      }

      while (!cancelled) {
        setMessages([]);
        setTypingWho(null);
        setComposerPreview("");

        for (let i = 0; i < DEMO_SCRIPT.length; i += 1) {
          if (cancelled) return;
          const line = DEMO_SCRIPT[i];

          if (line.who === "user") {
            setComposerPreview("");
            for (let c = 0; c < line.text.length; c += 1) {
              if (cancelled) return;
              setComposerPreview(line.text.slice(0, c + 1));
              await wait(MS_PER_CHAR);
            }
            await wait(USER_AFTER_TYPE_MS);
            if (cancelled) return;
            setComposerPreview("");
            setMessages((prev) => [...prev, { id: `m-${i}`, ...line }]);
            await wait(PAUSE_MS);
            continue;
          }

          setTypingWho("ally");
          await wait(allyTypingMs(line.text));
          if (cancelled) return;
          setTypingWho(null);
          setMessages((prev) => [...prev, { id: `m-${i}`, ...line }]);
          await wait(PAUSE_MS);
        }

        await wait(LOOP_PAUSE_MS);
      }
    }

    playScript();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="alm-hero-phone alm-hero-phone--auto" aria-label="Sample Ally conversation">
      <div className="alm-hero-phone__scene">
        <div className="alm-hero-phone__device">
          <div className="alm-hero-phone__bezel">
            <span className="alm-hero-phone__hw-btn alm-hero-phone__hw-btn--vol-up" aria-hidden />
            <span className="alm-hero-phone__hw-btn alm-hero-phone__hw-btn--vol-down" aria-hidden />
            <span className="alm-hero-phone__hw-btn alm-hero-phone__hw-btn--power" aria-hidden />
            <div className="alm-hero-phone__bezel-glare" />
            <div className="alm-hero-phone__inner">
              <header className="alm-hero-phone__header">
                <div className="alm-hero-phone__header-side alm-hero-phone__header-back" aria-hidden>
                  <IconChevLeft />
                </div>
                <div className="alm-hero-phone__header-center">
                  <AllyMark className="alm-hero-phone__avatar alm-hero-phone__avatar-mark" />
                  <span className="alm-hero-phone__name">Ally</span>
                </div>
                <div className="alm-hero-phone__header-side alm-hero-phone__header-camera" aria-hidden>
                  <IconCamera />
                </div>
              </header>

              <div className="alm-hero-phone__body">
                <div ref={threadRef} className="alm-hero-phone__thread" role="log" aria-live="polite">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`alm-hero-phone__bubble alm-hero-phone__bubble--${m.who}`}
                    >
                      {m.text}
                    </div>
                  ))}
                  {typingWho === "ally" ? (
                    <div className="alm-hero-phone__bubble alm-hero-phone__bubble--ally alm-hero-phone__typing-bubble">
                      <TypingDots />
                    </div>
                  ) : null}
                </div>

                <div className="alm-hero-phone__bottom">
                  <div className="alm-hero-phone__composer">
                    <span className="alm-hero-phone__plus" aria-hidden>
                      <IconPlus />
                    </span>
                    <div className="alm-hero-phone__field">
                      <span
                        className={`alm-hero-phone__input alm-hero-phone__input--preview${composerPreview ? "" : " is-empty"}`}
                      >
                        {composerPreview || "iMessage"}
                      </span>
                    </div>
                    <span className="alm-hero-phone__mic" aria-hidden>
                      <IconMic />
                    </span>
                  </div>
                  <div className="alm-hero-phone__home-indicator" aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
