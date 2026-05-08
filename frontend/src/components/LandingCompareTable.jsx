/**
 * Marketing comparison: Ally vs typical virtual assistants vs Claude-style chat.
 * Rows mix “same baseline” capabilities with Ally-only differentiators.
 */
const ROWS = [
  {
    label: "Help draft or rewrite email and messages",
    ally: "yes",
    virtualAssistants: "yes",
    claude: "yes",
  },
  {
    label: "Acts on your linked Gmail, Calendar, Sheets, and Drive",
    ally: "yes",
    virtualAssistants: "limited",
    claude: "no",
    highlight: true,
  },
  {
    label: "Runs autonomous tasks for you: multi-step work in one thread until it is done or needs your OK",
    ally: "yes",
    virtualAssistants: "limited",
    claude: "partial",
    highlight: true,
  },
  {
    label: "Show up briefed: pull the invite, last Gmail thread, and files for that meeting",
    ally: "yes",
    virtualAssistants: "limited",
    claude: "partial",
    highlight: true,
  },
  {
    label: "Turn a recording or messy notes into a transcript you can reuse or share",
    ally: "yes",
    virtualAssistants: "limited",
    claude: "partial",
    highlight: true,
  },
  {
    label: "Attends meetings, creates transcripts after, and texts you what to do next",
    ally: "yes",
    virtualAssistants: "no",
    claude: "partial",
    highlight: true,
  },
  {
    label: "Quiet text: full drafts and recaps without reading everything aloud",
    ally: "yes",
    virtualAssistants: "limited",
    claude: "yes",
    highlight: true,
  },
  {
    label: "Sheet rows, calendar checks, and Drive lookups in one running errand",
    ally: "yes",
    virtualAssistants: "limited",
    claude: "no",
    highlight: true,
  },
  {
    label: "You approve before anything sensitive sends",
    ally: "yes",
    virtualAssistants: "partial",
    claude: "partial",
    highlight: true,
  },
];

const CELL = {
  partial: { text: "Partial" },
  limited: { text: "Limited" },
  no: { text: "No" },
};

function CompareCheckYes() {
  return (
    <span className="alm-compare__check">
      <svg className="alm-compare__check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M20 6L9 17l-5-5"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function CompareCell({ value }) {
  if (value === "yes") {
    return (
      <td className="alm-compare__td alm-compare__td--yes">
        <CompareCheckYes />
        <span className="sr-only">Yes</span>
      </td>
    );
  }
  const cfg = CELL[value] ?? CELL.no;
  return (
    <td className={`alm-compare__td alm-compare__td--${value}`}>
      <span className="alm-compare__val">{cfg.text}</span>
    </td>
  );
}

export default function LandingCompareTable() {
  return (
    <section className="alm-compare" aria-labelledby="alm-compare-heading">
      <div className="alm-compare__head">
        <p className="alm-auto__badge">Compare</p>
        <h2 id="alm-compare-heading" className="alm-compare__title">
          Same smarts, different job
        </h2>
        <p className="alm-compare__sub">
          Ally, big chat apps, and phone assistants can all sound helpful. Here is where the work actually
          happens, and what only Ally is built for.
        </p>
      </div>

      <div className="alm-compare__scroll" role="region" aria-label="Feature comparison table" tabIndex={0}>
        <table className="alm-compare__table">
          <thead>
            <tr>
              <th scope="col" className="alm-compare__th alm-compare__th--feature">
                Capability
              </th>
              <th scope="col" className="alm-compare__th alm-compare__th--ally">
                Ally
              </th>
              <th scope="col" className="alm-compare__th alm-compare__th--va">
                <span className="alm-compare__th-main">Virtual assistants</span>
                <span className="alm-compare__th-sub">Siri, Google Assistant, Alexa</span>
              </th>
              <th scope="col" className="alm-compare__th alm-compare__th--claude">
                <span className="alm-compare__th-main">Claude</span>
                <span className="alm-compare__th-sub">Chat experience</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className={row.highlight ? "alm-compare__tr--highlight" : undefined}>
                <th scope="row" className="alm-compare__rowhead">
                  {row.label}
                </th>
                <CompareCell value={row.ally} />
                <CompareCell value={row.virtualAssistants} />
                <CompareCell value={row.claude} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
