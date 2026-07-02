import { Link } from "react-router-dom";
import LegalPageLayout from "../components/LegalPageLayout";
import { APP_DOMAIN, APP_NAME, ASSISTANT_NAME } from "../constants/brand";
import "./ally-lp.css";

export default function TermsOfService() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="June 1, 2026">
      <section className="alm-subpage__section">
        <p className="alm-subpage__p">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of {APP_NAME}
          (&quot;{ASSISTANT_NAME},&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) at{" "}
          <a href={`https://${APP_DOMAIN}`}>{APP_DOMAIN}</a> and related services. By using
          {ASSISTANT_NAME}, you agree to these Terms and our{" "}
          <Link to="/privacy-policy">Privacy Policy</Link>.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-eligibility">
        <h2 id="tos-eligibility" className="alm-subpage__h2">
          Eligibility
        </h2>
        <p className="alm-subpage__p">
          You must be at least 18 years old (or the age of majority where you live) and able to form a
          binding contract. You are responsible for ensuring your use complies with laws that apply to
          you, including workplace and industry rules when using Ally with work accounts.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-account">
        <h2 id="tos-account" className="alm-subpage__h2">
          Account and Google access
        </h2>
        <ul className="alm-subpage__list">
          <li>You must provide accurate account information and keep credentials secure.</li>
          <li>
            Connecting Google grants Ally permission to act on your behalf only within the scopes you
            approve. You can revoke access in Google Account settings at any time.
          </li>
          <li>You are responsible for activity under your account, including texts sent from your linked phone number.</li>
        </ul>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-service">
        <h2 id="tos-service" className="alm-subpage__h2">
          The service
        </h2>
        <p className="alm-subpage__p">
          Ally is an AI assistant that helps with tasks involving Google Workspace, web search, optional
          SMS, subscriptions, and related features described on our site. Features may change; we do not
          guarantee uninterrupted or error-free operation.
        </p>
        <p className="alm-subpage__p">
          <strong>Not professional advice.</strong> Ally outputs are for informational and productivity
          purposes only. They are not legal, medical, financial, or other professional advice. You are
          responsible for reviewing anything before you send, publish, or rely on it.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-acceptable">
        <h2 id="tos-acceptable" className="alm-subpage__h2">
          Acceptable use
        </h2>
        <p className="alm-subpage__p">You agree not to:</p>
        <ul className="alm-subpage__list">
          <li>Use Ally for unlawful, harmful, harassing, or fraudulent purposes.</li>
          <li>Attempt to access other users&apos; data or our systems without authorization.</li>
          <li>Reverse engineer, scrape, or overload the service except as allowed by law.</li>
          <li>Send spam or automate messages that violate carrier, Sendblue, or applicable messaging rules.</li>
          <li>Misrepresent Ally-generated content as human when doing so would be deceptive or prohibited.</li>
        </ul>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-sms">
        <h2 id="tos-sms" className="alm-subpage__h2">
          SMS and messaging
        </h2>
        <p className="alm-subpage__p">
          If you use SMS, message and data rates may apply. You consent to receive service-related texts
          at the number you provide. Paid plans may include proactive messages; you can manage preferences
          in the app where available. Opt out of marketing texts by following instructions in those
          messages, if offered.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-billing">
        <h2 id="tos-billing" className="alm-subpage__h2">
          Subscriptions and billing
        </h2>
        <ul className="alm-subpage__list">
          <li>Paid plans are billed monthly through Stripe at the prices shown at checkout unless stated otherwise.</li>
          <li>Subscriptions renew automatically until you cancel through the customer portal or as we describe.</li>
          <li>Refunds are handled according to our refund policy at the time of purchase; contact us if you believe a charge is in error.</li>
          <li>We may change pricing for new subscribers with notice; existing subscriptions may be governed by Stripe and your plan terms.</li>
        </ul>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-ip">
        <h2 id="tos-ip" className="alm-subpage__h2">
          Intellectual property
        </h2>
        <p className="alm-subpage__p">
          Ally, our branding, and the service software are owned by us or our licensors. You retain rights
          to content you provide. You grant us a limited license to use your content solely to operate and
          improve the service, including processing through AI providers.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-third">
        <h2 id="tos-third" className="alm-subpage__h2">
          Third-party services
        </h2>
        <p className="alm-subpage__p">
          Ally integrates with Google, Stripe, SMS providers, AI vendors, and others. Your use of those
          services is also subject to their terms. We are not responsible for third-party outages or
          policies.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-disclaimer">
        <h2 id="tos-disclaimer" className="alm-subpage__h2">
          Disclaimers
        </h2>
        <p className="alm-subpage__p">
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
          KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT. WE DO NOT WARRANT THAT AI OUTPUTS WILL BE ACCURATE, COMPLETE, OR SUITABLE FOR
          YOUR PURPOSE.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-liability">
        <h2 id="tos-liability" className="alm-subpage__h2">
          Limitation of liability
        </h2>
        <p className="alm-subpage__p">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR SUPPLIERS WILL NOT BE LIABLE FOR INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR
          GOODWILL. OUR TOTAL LIABILITY FOR CLAIMS ARISING FROM THE SERVICE IN ANY 12-MONTH PERIOD IS
          LIMITED TO THE GREATER OF (A) AMOUNTS YOU PAID US IN THAT PERIOD OR (B) USD $100.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-termination">
        <h2 id="tos-termination" className="alm-subpage__h2">
          Termination
        </h2>
        <p className="alm-subpage__p">
          You may stop using Ally at any time. We may suspend or terminate access if you violate these
          Terms, pose a security risk, or as required by law. Sections that by nature should survive
          (disclaimers, liability limits, dispute terms) survive termination.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-law">
        <h2 id="tos-law" className="alm-subpage__h2">
          Governing law
        </h2>
        <p className="alm-subpage__p">
          These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law
          rules, except where mandatory consumer protections in your country of residence apply. Disputes
          will be resolved in the state or federal courts located in Delaware, unless applicable law requires
          otherwise.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-changes">
        <h2 id="tos-changes" className="alm-subpage__h2">
          Changes
        </h2>
        <p className="alm-subpage__p">
          We may modify these Terms. We will post updates on this page with a new &quot;Last updated&quot;
          date. Material changes may be communicated by email or in-app notice where appropriate.
          Continued use after the effective date constitutes acceptance.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="tos-contact">
        <h2 id="tos-contact" className="alm-subpage__h2">
          Contact
        </h2>
        <p className="alm-subpage__p">
          Questions about these Terms:{" "}
          <a href="mailto:support@yourfriendally.com">support@yourfriendally.com</a>
        </p>
      </section>
    </LegalPageLayout>
  );
}
