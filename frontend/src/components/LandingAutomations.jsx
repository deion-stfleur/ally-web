import { Link } from "react-router-dom";
import iconCalender from "../assets/calender-dynamic-color.png";
import iconChat from "../assets/chat-text-dynamic-color.png";
import iconCopy from "../assets/copy-dynamic-color.png";
import iconFile from "../assets/file-dynamic-color.png";
import iconMobile from "../assets/mobile-dynamic-color.png";
import iconPencil from "../assets/pencil-dynamic-color.png";
import iconShield from "../assets/sheild-dynamic-color.png";

/**
 * Feature grid (wide rows + tiles). Icons use imported PNG assets; cards stay white on the page background.
 */
const FEATURES = [
  {
    id: "chat",
    wide: false,
    title: "Text Ally anytime",
    copy: "Ping Ally from your phone between errands. One SMS thread keeps context for the next text.",
    iconSrc: iconChat,
  },
  {
    id: "inbox",
    wide: false,
    title: "Inbox by text",
    copy: "Text what you need from Gmail. Summaries and draft lines come back in the same thread.",
    iconSrc: iconFile,
  },
  {
    id: "calendar",
    wide: false,
    title: "Calendar by text",
    copy: "Ask when you are free or what is next. Ally texts back from your Google Calendar.",
    iconSrc: iconCalender,
  },
  {
    id: "workspace",
    wide: true,
    title: "Google in one text thread",
    copy: "Mail, calendar, Sheets, and Drive questions over SMS without hopping between apps.",
    iconSrc: iconMobile,
  },
  {
    id: "control",
    wide: true,
    title: "You approve sends",
    copy: "Sensitive email waits on your OK. Quick questions still get fast text replies.",
    iconSrc: iconShield,
  },
  {
    id: "sheets",
    wide: false,
    title: "Log rows by text",
    copy: "Text a receipt or expense line. Ally can append the next row in the sheet you chose.",
    iconSrc: iconCopy,
  },
  {
    id: "drafts",
    wide: false,
    title: "Rough text to drafts",
    copy: "Text messy bullets, get a tidy Gmail draft or copy you can polish later.",
    iconSrc: iconPencil,
  },
  {
    id: "todos",
    wide: false,
    title: "Todos and recaps",
    copy: "Text a new task or ask for a one message weekly recap from your Google stuff.",
    iconSrc: iconChat,
  },
  {
    id: "meetings",
    wide: false,
    title: "Attend meetings ready",
    copy: "Text a meeting name or paste a link. Ally pulls the invite, last Gmail thread, and files so you show up prepared.",
    iconSrc: iconCalender,
  },
  {
    id: "transcripts",
    wide: false,
    title: "Transcripts and next steps",
    copy: "After a call, text for a recap: what was decided, outcomes, owners, and what to do next in plain bullets.",
    iconSrc: iconFile,
  },
  {
    id: "research",
    wide: false,
    title: "Research by text",
    copy: "Text a topic or question. Ally summarizes what matters, points to sources, and gives a simple take you can use.",
    iconSrc: iconPencil,
  },
];

export default function LandingAutomations() {
  return (
    <section className="alm-auto" aria-labelledby="alm-auto-heading">
      <div className="alm-auto__head">
        <p className="alm-auto__badge">Features</p>
        <h2 id="alm-auto-heading" className="alm-auto__title alm-auto__title--features">
          Ally is your text assistant for Google
        </h2>
        <p className="alm-auto__sub alm-auto__sub--features">
          You type a short text. Ally can peek at Gmail, Calendar, Sheets, and Drive when your phone is linked. Same idea on the web.
        </p>
      </div>

      <div className="alm-auto__grid">
        {FEATURES.map((item) => (
          <article
            key={item.id}
            className={`alm-auto__card alm-auto__card--grid${item.wide ? " alm-auto__card--wide" : " alm-auto__card--tile"}`}
          >
            <div className="alm-auto__card-icon alm-auto__card-icon--feature alm-auto__card-icon--asset">
              <img src={item.iconSrc} alt="" width={50} height={50} decoding="async" />
            </div>
            <h3 className="alm-auto__card-title alm-auto__card-title--feature">{item.title}</h3>
            <p className="alm-auto__card-copy alm-auto__card-copy--feature">{item.copy}</p>
          </article>
        ))}
      </div>

      <div className="alm-auto__cta-wrap">
        <Link to="/login" className="alm-hero__cta">
          Try for $0
        </Link>
      </div>
    </section>
  );
}
