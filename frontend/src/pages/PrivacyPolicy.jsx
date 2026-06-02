import LegalPageLayout from "../components/LegalPageLayout";
import { APP_NAME, ASSISTANT_NAME } from "../constants/brand";
import "./ally-lp.css";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="June 1, 2026">
      <section className="alm-subpage__section">
        <p className="alm-subpage__p">
          Your Friend Ally (&quot;{APP_NAME}&quot;, &quot;{ASSISTANT_NAME},&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates{" "}
          <a href="https://yourfriendally.com">yourfriendally.com</a> and related services, including
          our web application and optional SMS features. This Privacy Policy explains how we collect,
          use, share, and protect information when you use {ASSISTANT_NAME}.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-info">
        <h2 id="privacy-info" className="alm-subpage__h2">
          Information we collect
        </h2>
        <ul className="alm-subpage__list">
          <li>
            <strong>Account information:</strong> When you sign in with Google, we receive your email,
            name, and profile picture from Google, along with OAuth tokens needed to access Google
            services you authorize.
          </li>
          <li>
            <strong>Phone number:</strong> If you link a mobile number, we store it in E.164 format and
            use it to verify your account and deliver SMS messages.
          </li>
          <li>
            <strong>Conversation data:</strong> Messages you send in the web app or by SMS, plus related
            metadata (timestamps, conversation identifiers) needed to provide the service.
          </li>
          <li>
            <strong>Google Workspace data:</strong> With your permission, Ally may access Gmail, Calendar,
            Drive, Docs, Sheets, and related Google APIs to complete tasks you request. We process this
            data to respond to you; we do not sell your Google data.
          </li>
          <li>
            <strong>Billing information:</strong> If you subscribe, payment processing is handled by
            Stripe. We receive subscription status and plan identifiers from Stripe, not full card
            numbers.
          </li>
          <li>
            <strong>Usage and technical data:</strong> Basic logs (IP address, browser type, errors) to
            operate, secure, and improve the service.
          </li>
        </ul>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-use">
        <h2 id="privacy-use" className="alm-subpage__h2">
          How we use information
        </h2>
        <ul className="alm-subpage__list">
          <li>Provide, maintain, and improve Ally&apos;s features.</li>
          <li>Authenticate you and connect to Google services you approve.</li>
          <li>Send SMS messages you request or that are part of your plan (e.g., proactive updates on Pro).</li>
          <li>Process subscriptions and manage billing through Stripe.</li>
          <li>Detect abuse, fraud, and security issues.</li>
          <li>Comply with legal obligations and enforce our Terms of Service.</li>
        </ul>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-ai">
        <h2 id="privacy-ai" className="alm-subpage__h2">
          AI processing
        </h2>
        <p className="alm-subpage__p">
          Ally uses third-party AI providers (such as Anthropic) to generate responses and complete
          tasks. Content you submit may be sent to these providers under their terms and privacy
          policies. We configure services to minimize unnecessary data retention where supported.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-share">
        <h2 id="privacy-share" className="alm-subpage__h2">
          How we share information
        </h2>
        <p className="alm-subpage__p">We do not sell your personal information. We may share data with:</p>
        <ul className="alm-subpage__list">
          <li>
            <strong>Service providers</strong> that help us run Ally (hosting, SMS, payments, AI, meeting
            bots, browser automation), only as needed to perform their function.
          </li>
          <li>
            <strong>Google</strong> when you use Google sign-in or authorize Workspace access, under
            Google&apos;s policies.
          </li>
          <li>
            <strong>Legal authorities</strong> when required by law or to protect rights, safety, and
            security.
          </li>
          <li>
            <strong>Business transfers</strong> in connection with a merger, acquisition, or sale of assets,
            with notice where required.
          </li>
        </ul>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-retention">
        <h2 id="privacy-retention" className="alm-subpage__h2">
          Retention
        </h2>
        <p className="alm-subpage__p">
          We retain account and conversation data while your account is active and as needed to provide
          the service, comply with law, resolve disputes, and enforce agreements. You may request deletion
          by contacting us; some data may be retained in backups or logs for a limited period.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-security">
        <h2 id="privacy-security" className="alm-subpage__h2">
          Security
        </h2>
        <p className="alm-subpage__p">
          We use industry-standard measures such as encryption in transit (HTTPS), secured credentials,
          and access controls. No method of transmission or storage is 100% secure; we cannot guarantee
          absolute security.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-rights">
        <h2 id="privacy-rights" className="alm-subpage__h2">
          Your choices and rights
        </h2>
        <ul className="alm-subpage__list">
          <li>Revoke Google access anytime in your Google Account security settings.</li>
          <li>Manage or cancel subscriptions through Stripe Customer Portal or account settings.</li>
          <li>Request access, correction, or deletion of personal data by emailing us.</li>
          <li>Depending on where you live, you may have additional rights under applicable privacy laws.</li>
        </ul>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-children">
        <h2 id="privacy-children" className="alm-subpage__h2">
          Children
        </h2>
        <p className="alm-subpage__p">
          Ally is not directed to children under 13 (or the minimum age in your jurisdiction). We do not
          knowingly collect personal information from children.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-changes">
        <h2 id="privacy-changes" className="alm-subpage__h2">
          Changes
        </h2>
        <p className="alm-subpage__p">
          We may update this policy from time to time. We will post the revised version on this page and
          update the &quot;Last updated&quot; date. Continued use after changes means you accept the
          updated policy.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-contact">
        <h2 id="privacy-contact" className="alm-subpage__h2">
          Contact
        </h2>
        <p className="alm-subpage__p">
          Questions about this Privacy Policy:{" "}
          <a href="mailto:support@yourfriendally.com">support@yourfriendally.com</a>
        </p>
      </section>
    </LegalPageLayout>
  );
}
