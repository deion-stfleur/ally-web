import MarketingFooter from "../components/MarketingFooter";
import MarketingNav from "../components/MarketingNav";
import "./ally-lp.css";

export default function Features() {
  return (
    <div className="alm">
      <MarketingNav />
      <main className="alm-main alm-subpage">
        <h1 className="alm-subpage__title">Features</h1>
        <p className="alm-subpage__lead">
          Ally connects to Google so you can work from one conversation—chat in the
          browser or, where configured, by SMS.
        </p>

        <section className="alm-subpage__section" aria-labelledby="feat-chat">
          <h2 id="feat-chat" className="alm-subpage__h2">
            Chat &amp; memory
          </h2>
          <ul className="alm-subpage__list">
            <li>Natural chat with context from your thread and connected tools.</li>
            <li>Remembers the conversation so follow-ups stay coherent.</li>
          </ul>
        </section>

        <section className="alm-subpage__section" aria-labelledby="feat-google">
          <h2 id="feat-google" className="alm-subpage__h2">
            Google Workspace
          </h2>
          <ul className="alm-subpage__list">
            <li>Gmail: draft replies, summarize threads, and surface action items.</li>
            <li>Drive &amp; Docs: search files and pull relevant snippets into answers.</li>
            <li>Calendar: check availability and prep for what&apos;s next.</li>
          </ul>
        </section>

        <section className="alm-subpage__section" aria-labelledby="feat-sms">
          <h2 id="feat-sms" className="alm-subpage__h2">
            SMS (optional)
          </h2>
          <ul className="alm-subpage__list">
            <li>
              Where Sendblue (or similar) is configured, text Ally from your phone
              for quick tasks on the go.
            </li>
          </ul>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
