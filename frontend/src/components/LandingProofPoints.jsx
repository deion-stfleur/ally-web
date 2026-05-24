import { Link } from "react-router-dom";

const PROOF_POINTS = [
  {
    id: "meetings",
    title: "Meeting notes",
    description:
      "Ally joins your Meet or Zoom call, listens, and texts you a summary when the meeting ends.",
  },
  {
    id: "shopping",
    title: "Shopping links",
    description:
      "Ask for a product or gift. Ally finds options and sends links so you can check out fast.",
  },
  {
    id: "meals",
    title: "Meal photos",
    description:
      "Send a photo of your plate. Ally helps log what you ate and keeps it in one thread.",
  },
  {
    id: "research",
    title: "Background research",
    description:
      "Big question? Ally runs multi-step research in the background and texts you when it is done.",
  },
];

function ProofCheckIcon() {
  return (
    <span className="alm-proof__check" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12.5l4.2 4.2L19 7"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function LandingProofPoints() {
  return (
    <section className="alm-proof" aria-labelledby="alm-proof-heading">
      <div className="alm-proof__inner">
        <div className="alm-proof__head">
          <div className="alm-proof__copy">
            <h2 id="alm-proof-heading" className="alm-proof__title">
              Don&apos;t have a reliable assistant? Now you do.
            </h2>
            <p className="alm-proof__lead">
              Text Ally once. She handles errands, research, and follow-up for you.
            </p>
          </div>
          <Link to="/use-cases" className="alm-proof__explore">
            Explore
            <span className="alm-proof__explore-chevron" aria-hidden>
              ›
            </span>
          </Link>
        </div>

        <ul className="alm-proof__grid">
          {PROOF_POINTS.map((item) => (
            <li key={item.id} className="alm-proof__card">
              <div className="alm-proof__card-head">
                <ProofCheckIcon />
                <h3 className="alm-proof__card-title">{item.title}</h3>
              </div>
              <p className="alm-proof__card-body">{item.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
