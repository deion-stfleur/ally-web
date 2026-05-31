import AllyMark from "./AllyMark";

const LEGACY_PILLS = [
  "Reserve dates",
  "Find flights",
  "Book hotel",
  "Check flight",
  "Send email",
  "Research",
  "Plan dinner",
];

const ALLY_FLOW_ICONS = ["✉", "📅", "💬", "⚡"];

const LEGACY_STAGGER_S = 1.3;
const LEGACY_CYCLE_S = LEGACY_STAGGER_S * LEGACY_PILLS.length + 2;
const LEGACY_COLS = 4;

function LegacyFlowVisual() {
  return (
    <div className="alm-advantage__scene alm-advantage__scene--legacy" aria-hidden>
      <div
        className="alm-advantage__legacy-stage"
        style={{ "--legacy-cycle": `${LEGACY_CYCLE_S}s` }}
      >
        {LEGACY_PILLS.map((label, i) => {
          const col = i % LEGACY_COLS;
          const row = Math.floor(i / LEGACY_COLS);
          const colsInRow =
            row === 0
              ? Math.min(LEGACY_COLS, LEGACY_PILLS.length)
              : LEGACY_PILLS.length - LEGACY_COLS;
          const rowOffset = (LEGACY_COLS - colsInRow) * 6;

          return (
            <span
              key={label}
              className="alm-advantage__pill"
              style={{
                "--pill-x": `${rowOffset + 12 + (col * (76 - rowOffset)) / Math.max(colsInRow - 1, 1)}%`,
                "--pill-y": row === 0 ? "14px" : "42px",
                "--pill-delay": `${i * LEGACY_STAGGER_S}s`,
                "--pill-cycle": `${LEGACY_CYCLE_S}s`,
              }}
            >
              {label}
            </span>
          );
        })}
        <div className="alm-advantage__legacy-folder">
          <span className="alm-advantage__legacy-folder-label">Chat thread</span>
        </div>
      </div>
    </div>
  );
}

function AllyFlowVisual() {
  return (
    <div className="alm-advantage__scene alm-advantage__scene--ally" aria-hidden>
      <div className="alm-advantage__ally-glow" />
      <div className="alm-advantage__ally-flow-track">
        {ALLY_FLOW_ICONS.map((icon, i) => (
          <span
            key={icon}
            className="alm-advantage__flow-particle"
            style={{ "--flow-i": i }}
          >
            {icon}
          </span>
        ))}
      </div>
      <div className="alm-advantage__ally-core">
        <AllyMark className="alm-advantage__ally-mark" />
      </div>
    </div>
  );
}

export default function LandingUniqueAdvantage() {
  return (
    <section className="alm-advantage" aria-labelledby="alm-advantage-heading">
      <h2 id="alm-advantage-heading" className="alm-advantage__title">
        Ally&apos;s unique advantage
      </h2>
      <div className="alm-advantage__grid">
        <article className="alm-advantage__card">
          <LegacyFlowVisual />
          <div className="alm-advantage__body">
            <h3 className="alm-advantage__card-title">Answers once, then forgets</h3>
            <p className="alm-advantage__card-text">
              One chat for every task. You still jump apps, copy text, and start
              over. Nothing runs on its own.
            </p>
          </div>
        </article>
        <article className="alm-advantage__card">
          <AllyFlowVisual />
          <div className="alm-advantage__body">
            <h3 className="alm-advantage__card-title">Texts you when work is done</h3>
            <p className="alm-advantage__card-text">
              One text starts real work. Ally uses your Google tools, runs tasks in the
              background, and texts you when there is an update.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
