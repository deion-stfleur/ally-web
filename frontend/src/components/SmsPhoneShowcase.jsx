import { useEffect, useRef, useState } from "react";

const SMS_POINTS = [
  "Check Calendar and Gmail like you’re texting a coworker.",
  "Draft emails and Google Docs without opening ten tabs.",
  "Turn a brain-dump into clean bullets you can paste anywhere.",
  "Stack little asks—Ally keeps the thread context.",
];

/** Casual demo thread: feels like a real ping on the go */
const SMS_DEMO_MESSAGES = [
  { who: "user", text: "hey ally when’s my next meeting" },
  { who: "ally", text: "Hey! Next up is Design review — tomorrow 2:30pm. Zoom link’s on the calendar invite." },
  { who: "user", text: "ok sweet — can you create a doc for notes" },
  { who: "ally", text: "Yep. I spun up “Design review notes” in Drive and shared it with you." },
  { who: "user", text: "legend. can you drop 3 bullets at the top" },
  { who: "ally", text: "Done — goals / decisions / parking lot. You can riff from there." },
  { who: "user", text: "also remind me 15 min before?" },
  { who: "ally", text: "Got you — ping at 2:15pm tomorrow. Want a cal hold too or just this text?" },
  { who: "user", text: "text is fine. thx ally" },
  { who: "ally", text: "Anytime 🙂 text me whenever you’re between meetings." },
];

/** Slower cadence so the demo reads clearly on screen */
const BUBBLE_MS = 3200;
const POINT_MS = 3400;

const ROTATING_PHRASES = [
  "handles your calendar.",
  "drafts that email.",
  "finds the file.",
  "keeps the thread straight.",
  "nudges you before the meeting.",
];

const ROTATE_TITLE_MS = 2600;

export default function SmsPhoneShowcase() {
  const sectionRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [bubbleIdx, setBubbleIdx] = useState(0);
  const [litCount, setLitCount] = useState(0);
  const [rotateIdx, setRotateIdx] = useState(0);
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting && e.intersectionRatio >= 0.12),
      { threshold: [0, 0.12, 0.25], rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || reduceMotion) return undefined;
    const id = window.setInterval(() => {
      setBubbleIdx((i) => (i + 1 >= SMS_DEMO_MESSAGES.length ? 0 : i + 1));
    }, BUBBLE_MS);
    return () => window.clearInterval(id);
  }, [inView, reduceMotion]);

  useEffect(() => {
    if (!inView || reduceMotion) return undefined;
    const id = window.setInterval(() => {
      setLitCount((n) => (n >= SMS_POINTS.length ? 0 : n + 1));
    }, POINT_MS);
    return () => window.clearInterval(id);
  }, [inView, reduceMotion]);

  useEffect(() => {
    if (inView || reduceMotion) return;
    setBubbleIdx(0);
    setLitCount(0);
  }, [inView, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const id = window.setInterval(() => {
      setRotateIdx((i) => (i + 1 >= ROTATING_PHRASES.length ? 0 : i + 1));
    }, ROTATE_TITLE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const visibleBubbles = reduceMotion ? SMS_DEMO_MESSAGES : SMS_DEMO_MESSAGES.slice(0, bubbleIdx + 1);
  const staticLit = reduceMotion ? SMS_POINTS.length : litCount;

  return (
    <section ref={sectionRef} className="alm-sms" aria-labelledby="alm-sms-heading">
      <div className="alm-sms__head">
        <h2 id="alm-sms-heading" className="alm-sms__title">
          <span className="alm-sms__title-brand">Text Ally</span>{" "}
          <span className="alm-sms__title-rest">
            <span className="alm-sms__title-and">and she</span>{" "}
            <span className="alm-sms__title-rot" aria-live="polite">
              {ROTATING_PHRASES[rotateIdx]}
            </span>
          </span>
        </h2>
        <p className="alm-sms__lead">
          Same Ally as the web app—just you, your thumbs, and whatever’s on fire right now.
        </p>
      </div>

      <div className="alm-sms__grid">
        <ul className="alm-sms__points">
          {SMS_POINTS.map((text, i) => (
            <li key={text.slice(0, 24)} className={`alm-sms__point${i < staticLit ? " is-lit" : ""}`}>
              <span className="alm-sms__dot" aria-hidden />
              {text}
            </li>
          ))}
        </ul>

        <div className="alm-sms__device-col">
          <div className="alm-sms__device" aria-hidden>
            <div className="alm-sms__bezel">
              <div className="alm-sms__bezel-glare" />
              <div className="alm-sms__inner">
                <div className="alm-sms__notch" />
                <div className="alm-sms__ear" />
                <div className="alm-sms__screen">
                  <div className="alm-sms__thread">
                    {visibleBubbles.map((m, idx) => (
                      <div
                        key={`${idx}-${m.who}-${m.text.slice(0, 12)}`}
                        className={`alm-sms__bubble alm-sms__bubble--${m.who}`}
                      >
                        {m.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
