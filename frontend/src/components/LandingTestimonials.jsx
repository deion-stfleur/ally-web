import AllyMark from "./AllyMark";

const TESTIMONIALS = [
  {
    id: "date-night",
    title: "Books dinner & drinks for you",
    quote:
      "Had zero plan for Saturday. I told Ally what we like and our budget. It sent a few cocktail spots and dinners nearby, booked both, and texted when to head out so we were not late.",
    name: "Marcus T.",
    photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&fit=crop&crop=faces",
  },
  {
    id: "apartment",
    title: "Alerts you when listings drop",
    quote:
      "Ally watched Zillow, Facebook Marketplace, and Redfin for my budget and neighborhood. It texted the second a listing hit. I toured same day and signed the lease a week later.",
    name: "Priya K.",
    photo: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=96&h=96&fit=crop&crop=faces",
  },
  {
    id: "morning",
    title: "Calendar & inbox in one text",
    quote:
      "Every morning I text Ally what's on today. It pulls my calendar and the emails that actually need a reply, then sends one short recap before I leave for work.",
    name: "Jordan L.",
    photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&fit=crop&crop=faces",
  },
  {
    id: "inbox",
    title: "Drafts email replies over SMS",
    quote:
      "I forward messy threads to Ally over text. It sends bullets plus draft replies I can send as is. I barely open Gmail on my phone during the workday now.",
    name: "Elena R.",
    photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&fit=crop&crop=faces",
  },
  {
    id: "trip",
    title: "Flights, hotels & restaurants",
    quote:
      "We planned a weekend trip in one thread. Ally compared flights, booked the hotel from what we said, and kept a running list of restaurants that matched what we wanted.",
    name: "Chris M.",
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=faces",
  },
  {
    id: "lease",
    title: "Tracks deadlines & drafts emails",
    quote:
      "Ally tracked my lease end date and pinged me before renewal opened. It drafted the email asking for lower rent. I approved it and hit send.",
    name: "Sam D.",
    photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&fit=crop&crop=faces",
  },
  {
    id: "interview",
    title: "Interview prep before the big day",
    quote:
      "Big interview on my calendar. Ally read the job post and my notes, then texted a prep brief the night before with talking points and questions to ask.",
    name: "Alex N.",
    photo: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=96&h=96&fit=crop&crop=faces",
  },
  {
    id: "errands",
    title: "Five errands, one text thread",
    quote:
      "One text kicked off five small errands. Ally worked through each one over SMS and followed up when something stalled. I never had to re explain the list.",
    name: "Taylor W.",
    photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=96&h=96&fit=crop&crop=faces",
  },
  {
    id: "recap-night",
    title: "Inbox summaries on your schedule",
    quote:
      "I asked Ally for inbox summaries at night and only urgent replies during the day. It kept that routine going for two weeks without me reminding it.",
    name: "Morgan S.",
    photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=96&h=96&fit=crop&crop=faces",
  },
];

function splitColumns(items) {
  const cols = [[], [], []];
  items.forEach((item, i) => {
    cols[i % 3].push(item);
  });
  return cols;
}

function VerifiedBadge() {
  return (
    <svg className="alm-testimonials__verified" width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#3b82f6" />
      <path
        d="M8.5 12.2l2.2 2.2 5.3-5.4"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function TestimonialCard({ item }) {
  return (
    <article className="alm-testimonials__card">
      <h3 className="alm-testimonials__card-title">{item.title}</h3>
      <p className="alm-testimonials__card-quote">&ldquo;{item.quote}&rdquo;</p>
      <footer className="alm-testimonials__card-foot">
        <img
          className="alm-testimonials__avatar"
          src={item.photo}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
        />
        <span className="alm-testimonials__name">
          {item.name}
          <VerifiedBadge />
        </span>
      </footer>
    </article>
  );
}

function ScrollingColumn({ items, direction }) {
  const loop = [...items, ...items];
  return (
    <div
      className={`alm-testimonials__col alm-testimonials__col--${direction}`}
      aria-hidden="true"
    >
      <div className="alm-testimonials__track">
        {loop.map((item, idx) => (
          <TestimonialCard key={`${item.id}-${idx}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function LandingTestimonials() {
  const [colA, colB, colC] = splitColumns(TESTIMONIALS);

  return (
    <section className="alm-testimonials" aria-labelledby="alm-testimonials-heading">
      <div className="alm-testimonials__head">
        <AllyMark className="alm-testimonials__eyebrow" />
        <h2 id="alm-testimonials-heading" className="alm-testimonials__title">
          What Ally handles for you
        </h2>
        <p className="alm-testimonials__sub">
          Booking, research, inbox, calendar, and follow-through over text.
        </p>
      </div>

      <div className="alm-testimonials__marquee" aria-label="Testimonials from Ally users">
        <ScrollingColumn items={colA} direction="up" />
        <ScrollingColumn items={colB} direction="down" />
        <ScrollingColumn items={colC} direction="up" />
      </div>

      <ul className="alm-testimonials__sr-list">
        {TESTIMONIALS.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>: {item.quote} — {item.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
