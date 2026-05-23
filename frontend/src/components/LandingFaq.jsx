import { useCallback, useId, useState } from "react";

const FAQ_ITEMS = [
  {
    id: "what",
    question: "What does Ally do?",
    paragraphs: [
      "Ally is a text-first assistant for Google Workspace. You sign in with Google, then chat on the web or text from a linked phone number when SMS is set up.",
      "Ally helps with Gmail, Calendar, Sheets, and Drive in plain language: summaries, drafts, calendar checks, spreadsheet rows, finding files, and follow-ups. The goal is fewer tabs, not replacing Google.",
    ],
  },
  {
    id: "safe",
    question: "Is Ally safe with my Google account?",
    paragraphs: [
      "You only grant the Google permissions you approve at sign-in. Ally uses that access to answer you and prepare drafts or updates you ask for.",
      "Sensitive email can stay confirm-first so nothing sends until you say so.",
    ],
  },
  {
    id: "phone",
    question: "Can I use Ally on my phone?",
    paragraphs: [
      "Yes. Link your mobile number in the app so you can text Ally for quick tasks on the go. SMS needs your number saved and your Ally workspace configured for texting.",
    ],
  },
  {
    id: "send",
    question: "Does Ally send email without me knowing?",
    paragraphs: [
      "No. Ally is built so important sends wait on your OK. You stay in control of what goes out.",
    ],
  },
  {
    id: "google",
    question: "Which Google apps does Ally use?",
    paragraphs: [
      "Ally works with Gmail, Google Calendar, Google Sheets, and Google Drive, depending on the scopes you grant. You can also keep todos in the app next to your chat.",
    ],
  },
  {
    id: "cost",
    question: "Is Ally free to try?",
    paragraphs: [
      "You can start from the site to see current plans and trials. If anything changes, it will always be clear before you pay.",
    ],
  },
];

export default function LandingFaq() {
  const baseId = useId().replace(/:/g, "");
  const [openId, setOpenId] = useState("what");

  const toggle = useCallback((id) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <section className="alm-faq" aria-labelledby={`${baseId}-faq-heading`}>
      <div className="alm-faq__panel">
        <h2 id={`${baseId}-faq-heading`} className="alm-faq__title">
          Frequently asked questions
        </h2>

        <ul className="alm-faq__list">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            const panelId = `${baseId}-panel-${item.id}`;
            const buttonId = `${baseId}-btn-${item.id}`;
            return (
              <li key={item.id} className={`alm-faq__item${isOpen ? " is-open" : ""}`}>
                <div className="alm-faq__item-head">
                  <h3 className="alm-faq__question">
                    <button
                      id={buttonId}
                      type="button"
                      className="alm-faq__trigger"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggle(item.id)}
                    >
                      <span className="alm-faq__question-text">{item.question}</span>
                      <span className="alm-faq__toggle" aria-hidden>
                        <svg
                          className="alm-faq__toggle-icon"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                        </svg>
                      </span>
                    </button>
                  </h3>
                </div>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="alm-faq__answer"
                >
                  <div className="alm-faq__answer-inner">
                    {item.paragraphs.map((p, i) => (
                      <p key={`${item.id}-p-${i}`} className="alm-faq__answer-p">
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
