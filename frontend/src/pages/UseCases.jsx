import MarketingFooter from "../components/MarketingFooter";
import MarketingNav from "../components/MarketingNav";
import "./ally-lp.css";

export default function UseCases() {
  return (
    <div className="alm">
      <MarketingNav />
      <main className="alm-main alm-subpage">
        <h1 className="alm-subpage__title">Use cases</h1>
        <p className="alm-subpage__lead">
          Real ways people use Ally—pick one, sign in with Google, and start with a
          single prompt.
        </p>

        <section className="alm-subpage__section" aria-labelledby="uc-inbox">
          <h2 id="uc-inbox" className="alm-subpage__h2">
            Tame the inbox
          </h2>
          <p className="alm-subpage__p">
            Ask Ally to summarize a long thread, draft a polite decline, or list open
            questions before you reply. Less reading, faster decisions.
          </p>
        </section>

        <section className="alm-subpage__section" aria-labelledby="uc-meetings">
          <h2 id="uc-meetings" className="alm-subpage__h2">
            Meeting prep
          </h2>
          <p className="alm-subpage__p">
            &ldquo;What&apos;s on my calendar tomorrow?&rdquo; or &ldquo;Pull notes from
            last week&apos;s doc&rdquo;—Ally ties Calendar and Drive together in one
            answer.
          </p>
        </section>

        <section className="alm-subpage__section" aria-labelledby="uc-text">
          <h2 id="uc-text" className="alm-subpage__h2">
            Text Ally on the go
          </h2>
          <p className="alm-subpage__p">
            When SMS is enabled, send a short message: reminders, rewrites, or
            &ldquo;what did I miss?&rdquo; Ally answers in plain language—no app
            hopping.
          </p>
        </section>

        <section className="alm-subpage__section" aria-labelledby="uc-research">
          <h2 id="uc-research" className="alm-subpage__h2">
            Quick research
          </h2>
          <p className="alm-subpage__p">
            Point Ally at a Drive folder or topic name; get bullets you can paste into
            a doc or forward to your team.
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
