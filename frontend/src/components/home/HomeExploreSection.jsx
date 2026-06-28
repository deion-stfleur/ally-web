import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import AllyMark from "../AllyMark";
import AllySearchField from "./AllySearchField";
import TextAllyHandoff from "../TextAllyHandoff";
import { openAccountSettings } from "../../utils/openAccountSettings";
import "./home-explore.css";

function ArrowIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

const EXPLORE_CARDS = [
  {
    id: "text",
    title: "Text Ally (SMS)",
    icon: "imessage",
    usersLabel: "Link",
    usersValue: "Phone",
    downloadsLabel: "Text",
    downloadsValue: "Ally",
    tone: "brand",
    action: "phone",
  },
  {
    id: "messages",
    title: "Past messages",
    icon: "chat",
    usersLabel: "Your threads",
    usersValue: "Browse",
    downloadsLabel: "View",
    downloadsValue: "Read-only",
    tone: "sky",
    action: "pastMessages",
  },
  {
    id: "automations",
    title: "Automations",
    icon: "bolt",
    usersLabel: "SMS + chat",
    usersValue: "Pro",
    downloadsLabel: "Runs",
    downloadsValue: "Background",
    tone: "blue",
    action: "link",
    to: "/automations",
  },
  {
    id: "recipes",
    title: "Ally recipes",
    icon: "book",
    usersLabel: "Playbooks",
    usersValue: "Quick",
    downloadsLabel: "Try in",
    downloadsValue: "Chat",
    tone: "bright",
    action: "link",
    to: "/recipes",
  },
  {
    id: "account",
    title: "Account",
    icon: "user",
    usersLabel: "Profile",
    usersValue: "Settings",
    downloadsLabel: "Billing",
    downloadsValue: "Plans",
    tone: "light",
    action: "account",
  },
  {
    id: "newchat",
    title: "New chat",
    icon: "spark",
    usersLabel: "Start",
    usersValue: "Fresh",
    downloadsLabel: "Thread",
    downloadsValue: "Now",
    tone: "sky",
    action: "newChat",
  },
];

function IMessageIcon() {
  const gradId = "home-imessage-grad";
  return (
    <svg className="home-explore-card__imessage-icon" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#65F090" />
          <stop offset="1" stopColor="#34C759" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5.5" fill={`url(#${gradId})`} />
      <path
        fill="#ffffff"
        d="M16.35 7H7.65A2.15 2.15 0 005.5 9.15v4.7A2.15 2.15 0 007.65 16h5.85l1.95 1.95V16h1.9A2.15 2.15 0 0019.5 13.85V9.15A2.15 2.15 0 0017.35 7z"
      />
    </svg>
  );
}

function CardIcon({ name }) {
  const paths = {
    chat: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    ),
    mail: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    ),
    bolt: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    ),
    check: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    book: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    ),
    phone: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
      />
    ),
    user: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    ),
    spark: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
    ),
  };
  return (
    <svg className="home-explore-card__glyph" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
      {paths[name] || paths.chat}
    </svg>
  );
}

export default function HomeExploreSection({
  user,
  allySmsE164,
  onOpenSearch,
  onOpenPastMessages,
  onLinkPhone,
  onOpenChat,
}) {
  const navigate = useNavigate();
  const trackRef = useRef(null);
  const first = user?.name?.split(/\s+/)[0] || "there";

  const scrollTrack = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 320);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  const handleCard = (card) => {
    switch (card.action) {
      case "search":
        onOpenSearch?.();
        break;
      case "pastMessages":
        onOpenPastMessages?.();
        break;
      case "phone":
        onLinkPhone?.();
        break;
      case "link":
        navigate(card.to);
        break;
      case "prompt":
        onOpenChat?.({ seedPrompt: card.prompt });
        break;
      case "account":
        openAccountSettings(navigate, window.location.pathname);
        break;
      case "newChat":
        onOpenChat?.({ newChat: true });
        break;
      default:
        break;
    }
  };

  return (
    <section className="home-explore" aria-labelledby="home-explore-heading">
      <div className="home-explore__hero">
        <p className="home-explore__badge">
          <AllyMark className="home-explore__badge-icon" />
          Hi, {first}
        </p>
        <h1 id="home-explore-heading" className="home-explore__title">
          Ally is ready
        </h1>
        <p className="home-explore__lead">
          Start a web chat below or text Ally from Messages. Search past threads or browse them
          read-only.
        </p>
        <div className="home-explore__hero-actions">
          <button
            type="button"
            className="home-explore__new-chat-btn"
            onClick={() => onOpenChat?.({ newChat: true })}
          >
            New chat
          </button>
          <AllySearchField onOpen={onOpenSearch} className="home-explore__search-inline" />
        </div>
      </div>

      <div className="home-explore__market">
        <div className="home-explore__market-head">
          <h2 className="home-explore__market-title">Explore Ally</h2>
          <button
            type="button"
            className="home-explore__scroll-btn"
            aria-label="Scroll carousel right"
            onClick={() => scrollTrack(1)}
          >
            <ArrowIcon />
          </button>
        </div>

        <div ref={trackRef} className="home-explore__track" tabIndex={0}>
          {EXPLORE_CARDS.map((card) => (
            <article
              key={card.id}
              className={`home-explore-card home-explore-card--${card.tone}`}
            >
              <button
                type="button"
                className="home-explore-card__btn"
                onClick={() => handleCard(card)}
              >
                <div className="home-explore-card__top">
                  <span
                    className={`home-explore-card__icon-wrap${
                      card.icon === "imessage" ? " home-explore-card__icon-wrap--imessage" : ""
                    }`}
                  >
                    {card.icon === "imessage" ? <IMessageIcon /> : <CardIcon name={card.icon} />}
                  </span>
                </div>
                <h3 className="home-explore-card__title">{card.title}</h3>
                <div className="home-explore-card__stats">
                  <div>
                    <p className="home-explore-card__stat-label">{card.usersLabel}</p>
                    <p className="home-explore-card__stat-pill">{card.usersValue}</p>
                  </div>
                  <div>
                    <p className="home-explore-card__stat-label">{card.downloadsLabel}</p>
                    <p className="home-explore-card__stat-value">{card.downloadsValue}</p>
                  </div>
                </div>
                <div className="home-explore-card__rule" aria-hidden />
                <div className="home-explore-card__foot">
                  <span className="home-explore-card__foot-label">Open</span>
                  <ArrowIcon className="home-explore-card__arrow" />
                </div>
              </button>
            </article>
          ))}
        </div>
      </div>

      {user?.sms_plan_active && user?.phone_e164 && allySmsE164 ? (
        <div className="home-explore__handoff">
          <TextAllyHandoff allySmsE164={allySmsE164} userPhoneE164={user.phone_e164} />
        </div>
      ) : null}
    </section>
  );
}
