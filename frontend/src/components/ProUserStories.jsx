import "./pro-user-stories.css";

function IconMorning() {
  return (
    <svg className="ally-pro-stories__card-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  );
}

function IconInbox() {
  return (
    <svg className="ally-pro-stories__card-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 8.25V19.5A2.25 2.25 0 0118.75 21.75H5.25A2.25 2.25 0 013 19.5V8.25m18 0A2.25 2.25 0 0018.75 6H5.25A2.25 2.25 0 003 8.25m18 0v.75H3v-.75"
      />
    </svg>
  );
}

const STORIES = [
  {
    label: "Morning brief · SMS",
    icon: IconMorning,
    body: (
      <>
        I wanted a <strong>weekday heads-up before standup</strong>. Ally texts my calendar, open
        threads, and anything flagged urgent — usually before I&apos;ve finished coffee.
      </>
    ),
  },
  {
    label: "Inbox watch · alerts",
    icon: IconInbox,
    body: (
      <>
        Ally <strong>watches a shared label</strong> and pings me when a vendor contract lands. I
        approved the reply from my phone between meetings — no tab-hopping.
      </>
    ),
  },
];

/**
 * Social proof grid inspired by editorial layouts — Ally-specific copy only.
 */
export default function ProUserStories({ variant = "landing" }) {
  const rootClass = [
    "ally-pro-stories",
    variant === "modal" ? "ally-pro-stories--modal" : "ally-pro-stories--landing",
  ].join(" ");

  return (
    <section className={rootClass} aria-labelledby="ally-pro-stories-heading">
      <header className="ally-pro-stories__head">
        <h2 id="ally-pro-stories-heading" className="ally-pro-stories__title">
          What Ally Pro users are saying
        </h2>
        <p className="ally-pro-stories__sub">
          Real ways people delegate email, calendar, and follow-ups to Ally over text and web chat.
        </p>
      </header>

      <div className="ally-pro-stories__featured">
        <blockquote className="ally-pro-stories__pullquote">
          <span className="ally-pro-stories__quote-mark" aria-hidden>
            &ldquo;
          </span>
          <p>
            I started with web chat for drafts — now Ally <strong>texts me first</strong> when a
            deadline moves and queues the send while I&apos;m away from my laptop.
          </p>
        </blockquote>
        <aside className="ally-pro-stories__meta">
          <p className="ally-pro-stories__attribution">
            <span className="ally-pro-stories__name">Morgan Lee</span>
            <span className="ally-pro-stories__role">founder, Northline Studio</span>
          </p>
          <div className="ally-pro-stories__bubble" aria-hidden>
            <p className="ally-pro-stories__bubble-text">Just moved to Ally Pro</p>
            <span className="ally-pro-stories__bubble-status">Delivered</span>
          </div>
        </aside>
      </div>

      <div className="ally-pro-stories__grid">
        {STORIES.map((story) => {
          const Icon = story.icon;
          return (
            <article key={story.label} className="ally-pro-stories__card">
              <div className="ally-pro-stories__card-label">
                <Icon />
                <span>{story.label}</span>
              </div>
              <p className="ally-pro-stories__card-body">{story.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
