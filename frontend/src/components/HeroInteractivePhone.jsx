import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import allyAvatar from "../assets/nav-brand.png";

const INTRO = [
  { id: "i1", who: "ally", text: "hey, it's ally" },
  { id: "i2", who: "ally", text: "wanna see what i can do?" },
];

const INTRO_KEYBOARD_SETTLE_MS = 340;
const INTRO_TYPING_MS = 580;
const INTRO_PAUSE_MS = 360;

const MAX_USER_TURNS = 3;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function prefersTouchInterface() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches
  );
}

const IOS_KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

function safeAllyReply(userText, turnIndex) {
  const t = (userText || "").toLowerCase().trim();
  if (turnIndex >= MAX_USER_TURNS - 1) {
    return {
      cta: true,
      text: "ok that's the demo — sign in and text me for real. i'll pull your actual calendar + inbox.",
    };
  }
  if (/what.*(on|today|tomorrow)|calendar|meeting|schedule|free|busy/.test(t)) {
    return {
      text: "checking your calendar — i'd text back something like: standup 9:30, 1:1 w/ jordan 11, focus block 2–4.",
    };
  }
  if (/email|gmail|inbox|thread|summar|draft|reply|alex/.test(t)) {
    return {
      text: "on it — i'd skim that thread and send you 3 bullets plus a reply you can paste into gmail.",
    };
  }
  if (/doc|sheet|drive|slide|folder|file/.test(t)) {
    return {
      text: "yep — i can spin up a doc or drop notes in a sheet from here. want a blank doc or a template?",
    };
  }
  if (/remind|follow|track|todo|task/.test(t)) {
    return {
      text: "i'll keep that on my list and ping you when it's done or if i need a quick yes/no from you.",
    };
  }
  if (/book|reserv|dinner|lunch|table/.test(t)) {
    return {
      text: "looking at times — i'd text you back 2–3 options that fit, then hold the one you pick.",
    };
  }
  if (/hi|hey|hello|sup|yo/.test(t)) {
    return {
      text: "hey — i'm ally. try \"what's on my calendar tomorrow\" or \"summarize my last email from alex.\"",
    };
  }
  if (/thank|thx|cool|nice|ok|okay/.test(t)) {
    return { text: "anytime — what should i tackle next?" };
  }
  if (t.length < 4) {
    return { text: "say a little more — like a meeting name, thread, or what you want drafted." };
  }
  const contextual = [
    "i'm listening — mail, calendar, or drive. what's the errand?",
    "throw me a real one: inbox thread, meeting prep, or a doc you need started.",
  ];
  return { text: contextual[turnIndex % contextual.length] };
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

function IconArrowUp() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" transform="rotate(-90 12 12)" />
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

function IconDelete() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 7h10l-1 10H8L7 7zM9 9l6 6M15 9l-6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IosKeyboard({ onKey, onDismiss }) {
  const keyProps = (id, handler, extraClass = "") => ({
    type: "button",
    className: `alm-hero-phone__key${id ? ` alm-hero-phone__key--${id}` : ""}${extraClass ? ` ${extraClass}` : ""}`,
    onMouseDown: (e) => e.preventDefault(),
    onTouchStart: (e) => e.preventDefault(),
    onClick: handler,
  });

  return (
    <div className="alm-hero-phone__keyboard" role="presentation">
      <div className="alm-hero-phone__keyboard-toolbar">
        <button type="button" className="alm-hero-phone__kb-tool" onMouseDown={(e) => e.preventDefault()}>
          Aa
        </button>
        <button
          type="button"
          className="alm-hero-phone__kb-tool"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onDismiss}
        >
          Hide keyboard
        </button>
      </div>
      <div className="alm-hero-phone__keyboard-rows">
        {IOS_KEYBOARD_ROWS.map((row, ri) => (
          <div key={`row-${ri}`} className="alm-hero-phone__keyboard-row">
            {ri === 2 ? (
              <button {...keyProps("shift", () => onKey("shift"))} aria-label="Shift">
                ⇧
              </button>
            ) : null}
            {row.map((k) => (
              <button key={k} {...keyProps(null, () => onKey(k))}>
                {k}
              </button>
            ))}
            {ri === 2 ? (
              <button {...keyProps("delete", () => onKey("backspace"))} aria-label="Delete">
                <IconDelete />
              </button>
            ) : null}
          </div>
        ))}
        <div className="alm-hero-phone__keyboard-row alm-hero-phone__keyboard-row--bottom">
          <button {...keyProps("mode", () => onKey("123"))}>123</button>
          <button {...keyProps("space", () => onKey("space"), "alm-hero-phone__key--space")}>space</button>
          <button {...keyProps("return", () => onKey("return"), "alm-hero-phone__key--return")}>
            return
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HeroInteractivePhone() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [userTurns, setUserTurns] = useState(0);
  const [typing, setTyping] = useState(false);
  const [done, setDone] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [useFakeKeyboard, setUseFakeKeyboard] = useState(
    () => typeof window !== "undefined" && !prefersTouchInterface()
  );
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const innerRef = useRef(null);
  const phoneRootRef = useRef(null);
  const scrollOpenTimerRef = useRef(null);
  const introPlayedRef = useRef(false);

  const scrollThread = useCallback(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollThread();
  }, [messages, typing, keyboardOpen, scrollThread]);

  useEffect(() => {
    setUseFakeKeyboard(!prefersTouchInterface());
  }, []);

  const dismissKeyboard = useCallback(() => {
    setKeyboardOpen(false);
    inputRef.current?.blur();
  }, []);

  const openKeyboard = useCallback(() => {
    if (done || userTurns >= MAX_USER_TURNS) return;
    setKeyboardOpen(true);
    inputRef.current?.focus();
  }, [done, userTurns]);

  useEffect(() => {
    const root = phoneRootRef.current;
    if (!root) return undefined;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const clearScrollTimer = () => {
      if (scrollOpenTimerRef.current != null) {
        window.clearTimeout(scrollOpenTimerRef.current);
        scrollOpenTimerRef.current = null;
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          clearScrollTimer();
          return;
        }
        if (done || userTurns >= MAX_USER_TURNS) return;
        if (prefersTouchInterface()) return;

        clearScrollTimer();
        const delay = reduce ? 0 : 280;
        scrollOpenTimerRef.current = window.setTimeout(() => {
          scrollOpenTimerRef.current = null;
          openKeyboard();
        }, delay);
      },
      { threshold: 0.42, rootMargin: "-8% 0px -6% 0px" }
    );

    observer.observe(root);
    return () => {
      clearScrollTimer();
      observer.disconnect();
    };
  }, [done, userTurns, openKeyboard]);

  useEffect(() => {
    if (!keyboardOpen || introPlayedRef.current) return undefined;
    if (done || userTurns > 0) {
      setIntroComplete(true);
      return undefined;
    }

    introPlayedRef.current = true;
    let cancelled = false;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function runIntro() {
      if (reduce || prefersTouchInterface()) {
        setMessages([...INTRO]);
        setIntroComplete(true);
        return;
      }

      await wait(INTRO_KEYBOARD_SETTLE_MS);
      if (cancelled) return;

      setMessages([]);
      setTyping(true);
      await wait(INTRO_TYPING_MS);
      if (cancelled) return;

      setTyping(false);
      setMessages([INTRO[0]]);

      await wait(INTRO_PAUSE_MS);
      if (cancelled) return;

      setTyping(true);
      await wait(INTRO_TYPING_MS);
      if (cancelled) return;

      setTyping(false);
      setMessages([...INTRO]);
      setIntroComplete(true);
    }

    runIntro();
    return () => {
      cancelled = true;
    };
  }, [keyboardOpen, done, userTurns]);

  function handleIosKey(key) {
    if (key === "backspace") {
      setDraft((d) => d.slice(0, -1));
      return;
    }
    if (key === "space") {
      setDraft((d) => `${d} `);
      return;
    }
    if (key === "return") {
      sendMessage();
      return;
    }
    if (key.length === 1) {
      setDraft((d) => d + key);
    }
  }

  function sendMessage(e) {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || typing || done || userTurns >= MAX_USER_TURNS) return;

    setDraft("");
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, who: "user", text }]);
    const turnIndex = userTurns;
    setUserTurns((n) => n + 1);
    setTyping(true);

    const reply = safeAllyReply(text, turnIndex);

    window.setTimeout(() => {
      setTyping(false);
      if (reply.cta) {
        setDone(true);
        dismissKeyboard();
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            who: "ally",
            text: reply.text,
            cta: true,
          },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, who: "ally", text: reply.text },
      ]);
    }, 650 + Math.random() * 350);
  }

  const inputDisabled = typing || done || userTurns >= MAX_USER_TURNS || !introComplete;
  const canSend = draft.trim().length > 0 && !inputDisabled;

  return (
    <div ref={phoneRootRef} className="alm-hero-phone" aria-label="Try texting Ally">
      <div className="alm-hero-phone__scene">
        <div className="alm-hero-phone__device">
          <div className="alm-hero-phone__bezel">
            <div className="alm-hero-phone__bezel-glare" />
            <div
              ref={innerRef}
              className={`alm-hero-phone__inner${keyboardOpen ? " is-keyboard-open" : ""}`}
            >
              <header className="alm-hero-phone__header">
                <button
                  type="button"
                  className="alm-hero-phone__header-side alm-hero-phone__header-back"
                  aria-label="Back"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <IconChevLeft />
                </button>
                <button
                  type="button"
                  className="alm-hero-phone__header-center"
                  onClick={openKeyboard}
                  aria-label="Conversation with Ally"
                >
                  <img
                    src={allyAvatar}
                    alt=""
                    className="alm-hero-phone__avatar"
                    width={48}
                    height={48}
                  />
                  <span className="alm-hero-phone__name">Ally</span>
                </button>
                <button
                  type="button"
                  className="alm-hero-phone__header-side alm-hero-phone__header-camera"
                  aria-label="Video"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <IconCamera />
                </button>
              </header>

              <div
                className="alm-hero-phone__body"
                onClick={(e) => {
                  if (e.target === e.currentTarget) dismissKeyboard();
                }}
              >
                <div
                  ref={threadRef}
                  className="alm-hero-phone__thread"
                  onClick={openKeyboard}
                  role="log"
                  aria-live="polite"
                >
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`alm-hero-phone__bubble alm-hero-phone__bubble--${m.who}`}
                    >
                      {m.text}
                      {m.cta ? (
                        <Link to="/login" className="alm-hero-phone__cta-link">
                          text ally → sign in
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="alm-hero-phone__bottom">
                  <form
                    className="alm-hero-phone__composer"
                    onSubmit={sendMessage}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="alm-hero-phone__plus"
                      aria-label="Add"
                      onMouseDown={(e) => e.preventDefault()}
                      disabled={inputDisabled}
                    >
                      <IconPlus />
                    </button>
                    <label className="alm-hero-phone__field" htmlFor="hero-phone-input">
                      <input
                        ref={inputRef}
                        id="hero-phone-input"
                        type="text"
                        inputMode="text"
                        className="alm-hero-phone__input"
                        placeholder={done ? "sign in to keep going" : "iMessage"}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onFocus={() => {
                          setKeyboardOpen(true);
                          if (!introComplete && prefersTouchInterface()) {
                            setMessages([...INTRO]);
                            setIntroComplete(true);
                            introPlayedRef.current = true;
                          }
                        }}
                        onBlur={() => {
                          if (useFakeKeyboard) {
                            window.setTimeout(() => {
                              if (!innerRef.current?.contains(document.activeElement)) {
                                setKeyboardOpen(false);
                              }
                            }, 120);
                          }
                        }}
                        disabled={inputDisabled}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="sentences"
                        enterKeyHint="send"
                        maxLength={280}
                        readOnly={useFakeKeyboard}
                      />
                    </label>
                    {canSend ? (
                      <button
                        type="submit"
                        className="alm-hero-phone__send"
                        aria-label="Send"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <IconArrowUp />
                      </button>
                    ) : (
                      <span className="alm-hero-phone__mic" aria-hidden>
                        <IconMic />
                      </span>
                    )}
                  </form>

                  {useFakeKeyboard ? (
                    <IosKeyboard onKey={handleIosKey} onDismiss={dismissKeyboard} />
                  ) : null}

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
