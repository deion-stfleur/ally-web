import { Link, Navigate, useParams } from "react-router-dom";
import AllyAvatar from "../components/AllyAvatar";
import MarketingFooter from "../components/MarketingFooter";
import MarketingNav from "../components/MarketingNav";
import OutreachWorkflowGrid from "../components/OutreachWorkflowGrid";
import WaitlistCta from "../components/WaitlistCta";
import { ASSISTANT_NAME } from "../constants/brand";
import { WAITLIST_MODE } from "../constants/waitlist";
import {
  GOOGLE_TOOL_LABELS,
  OUTREACH_BOOKING_URL,
  firstName,
  playbookForVertical,
} from "../constants/outreachCopy";
import leads from "../data/outreach-leads.json";
import "./ally-lp.css";
import "./business-outreach.css";

export default function BusinessOutreach() {
  const { slug } = useParams();
  const lead = slug ? leads[slug] : null;

  if (!lead) {
    return <Navigate to="/" replace />;
  }

  const greeting = firstName(lead.contactName);
  const pb = playbookForVertical(lead.vertical);
  const teamN = lead.teamSize ? `${lead.teamSize}-person` : "your";

  return (
    <div className="alm">
      <MarketingNav />
      <main className="alm-main biz-outreach">
        <header className="biz-outreach__hero">
          <AllyAvatar className="biz-outreach__avatar" decorative />
          <p className="biz-outreach__eyebrow">
            Built for {lead.businessName} · {lead.city}
          </p>
          <h1 className="biz-outreach__title">
            Hi {greeting} — {ASSISTANT_NAME} for {lead.businessName}
          </h1>
          <p className="biz-outreach__lead">{pb.tagline}</p>
          <p className="biz-outreach__lead biz-outreach__lead--sub">
            Connect Google once. Text {ASSISTANT_NAME} from web or iMessage — she works Gmail, Calendar,
            Drive, Docs, and Sheets, then texts your {teamN} team when the job is done.
          </p>
          <div className="biz-outreach__google-strip" aria-label="Google Workspace integrations">
            {GOOGLE_TOOL_LABELS.map((t) => (
              <span key={t.id} className="biz-outreach__google-pill">
                {t.label}
              </span>
            ))}
          </div>
          <div className="biz-outreach__cta-row">
            <WaitlistCta
              source={`outreach-${slug}`}
              className="biz-outreach__cta biz-outreach__cta--primary"
            >
              {WAITLIST_MODE ? "Join waitlist" : `Try ${ASSISTANT_NAME} free`}
            </WaitlistCta>
            <a
              href={OUTREACH_BOOKING_URL}
              className="biz-outreach__cta biz-outreach__cta--secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Book 15 min with Deion
            </a>
          </div>
        </header>

        <OutreachWorkflowGrid groups={pb.groups} businessName={lead.businessName} />

        <section className="biz-outreach__section biz-outreach__team" aria-labelledby="biz-outreach-team">
          <h2 id="biz-outreach-team" className="biz-outreach__section-title">
            Scale from owner to office
          </h2>
          <p className="biz-outreach__team-intro">
            {lead.businessName} can start with one power user — you — then add front desk, ops, or
            associates. Same Google account, same SMS thread, same playbooks.
          </p>
          <ul className="biz-outreach__team-list">
            <li>
              <strong>Owner / partner</strong> — inbox triage, meeting prep, background research
            </li>
            <li>
              <strong>Office manager</strong> — scheduling, client emails, sheet logging from text
            </li>
            <li>
              <strong>Team rollout</strong> — Ally Pro for proactive recaps and 24/7 watches on
              inbox, calendar, or deals pipeline
            </li>
          </ul>
        </section>

        {!WAITLIST_MODE ? (
          <section className="biz-outreach__section biz-outreach__plans" aria-labelledby="biz-outreach-plans">
            <h2 id="biz-outreach-plans" className="biz-outreach__section-title">
              Plans for {lead.businessName}
            </h2>
            <div className="biz-outreach__plan-grid">
              <article className="biz-outreach__plan-card">
                <h3>Task Runner · $9.99/mo</h3>
                <p>3 background jobs/day. Queue research or multi-step work — get a text when it finishes.</p>
              </article>
              <article className="biz-outreach__plan-card biz-outreach__plan-card--featured">
                <h3>Ally · $19.99/mo</h3>
                <p>Full Google Workspace + unlimited tasks. Best for daily Gmail, Calendar, and Sheets.</p>
              </article>
              <article className="biz-outreach__plan-card">
                <h3>Ally Pro · $49.99/mo</h3>
                <p>Proactive SMS, daily watches, browser automation for harder site checks.</p>
              </article>
            </div>
            <Link to="/pricing" className="biz-outreach__link">
              Compare plans →
            </Link>
          </section>
        ) : (
          <section className="biz-outreach__section biz-outreach__book" aria-labelledby="biz-outreach-waitlist">
            <h2 id="biz-outreach-waitlist" className="biz-outreach__section-title">
              Early access for {lead.businessName}
            </h2>
            <p className="biz-outreach__book-copy">
              We&apos;re rolling out access while Google verification finishes. Join the waitlist and
              we&apos;ll email you when your account is ready.
            </p>
            <WaitlistCta
              source={`outreach-plans-${slug}`}
              className="biz-outreach__cta biz-outreach__cta--primary"
            >
              Join waitlist
            </WaitlistCta>
          </section>
        )}

        <section className="biz-outreach__section biz-outreach__book">
          <h2 className="biz-outreach__section-title">See it on your Google account</h2>
          <p className="biz-outreach__book-copy">
            15 minutes — we&apos;ll run one real workflow for {lead.businessName}: inbox, calendar, or
            a background task from your phone.
          </p>
          <a
            href={OUTREACH_BOOKING_URL}
            className="biz-outreach__cta biz-outreach__cta--primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Pick a time
          </a>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
