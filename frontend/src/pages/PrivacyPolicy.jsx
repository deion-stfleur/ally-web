import LegalPageLayout from "../components/LegalPageLayout";
import { APP_NAME, ASSISTANT_NAME } from "../constants/brand";
import "./ally-lp.css";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated="July 8, 2026"
      description="How Your Friend Ally (yourfriendally) collects, uses, stores, and shares information — including Google user data accessed through OAuth."
    >
      <section className="alm-subpage__section">
        <p className="alm-subpage__p">
          Your Friend Ally (&quot;{APP_NAME}&quot;, &quot;{ASSISTANT_NAME},&quot; &quot;we,&quot; &quot;us,&quot; or
          &quot;our&quot;) operates{" "}
          <a href="https://yourfriendally.com">yourfriendally.com</a> and related services, including our
          web application and optional SMS features. This Privacy Policy explains how we collect, use,
          share, store, and protect information when you use {ASSISTANT_NAME}.
        </p>
        <p className="alm-subpage__p">
          {ASSISTANT_NAME} uses Google OAuth so you can sign in and authorize access to Google
          Workspace services (Gmail, Calendar, Drive, Docs, Sheets, and Slides). The sections below
          describe our practices in detail, including how we handle Google user data, as required by
          the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          .
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-google">
        <h2 id="privacy-google" className="alm-subpage__h2">
          Google user data
        </h2>
        <p className="alm-subpage__p">
          This section applies specifically to data we access from Google when you sign in with Google
          and grant OAuth permissions. We access Google user data <strong>only</strong> to provide
          features you request. We do <strong>not</strong> use Google user data for advertising,
          sell Google user data, or use it to train generalized AI models unrelated to your account.
        </p>

        <h3 className="alm-subpage__h3">Data accessed</h3>
        <p className="alm-subpage__p">
          When you connect your Google account, you may authorize {ASSISTANT_NAME} to access the
          following categories of Google user data:
        </p>
        <ul className="alm-subpage__list">
          <li>
            <strong>Basic profile (Google Sign-In):</strong> Your Google account email address, name,
            and profile picture — used to create and identify your {APP_NAME} account.
          </li>
          <li>
            <strong>Gmail (gmail.readonly, gmail.send):</strong> Email messages, headers, and metadata
            in mailboxes you authorize — used to read and search your inbox when you ask Ally for help;
            gmail.send is used only to send email on your behalf when you explicitly request it. We do not
            modify labels, archive, or delete mail.
          </li>
          <li>
            <strong>Google Calendar (calendar):</strong> Calendar events and related metadata — used to
            view, create, update, or summarize events when you request calendar assistance.
          </li>
          <li>
            <strong>Google Drive (drive.readonly, drive.file):</strong> Files and folders you authorize
            — used to list, read, or attach files Ally creates or that you explicitly reference in a
            request.
          </li>
          <li>
            <strong>Google Docs (documents):</strong> Document content and metadata — used to read or
            update Docs when you request document tasks.
          </li>
          <li>
            <strong>Google Sheets (spreadsheets):</strong> Spreadsheet content and metadata — used to
            read or update Sheets when you request spreadsheet tasks.
          </li>
          <li>
            <strong>Google Slides (presentations):</strong> Presentation content and metadata — used
            when you request Slides-related tasks.
          </li>
          <li>
            <strong>OAuth tokens:</strong> Access and refresh tokens issued by Google — stored securely
            so Ally can act on your behalf until you revoke access or delete your account.
          </li>
        </ul>
        <p className="alm-subpage__p">
          We request only the scopes shown on Google&apos;s OAuth consent screen at sign-in. You can
          review and revoke these permissions at any time in your{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Account permissions
          </a>
          .
        </p>

        <h3 className="alm-subpage__h3">How we use Google user data</h3>
        <p className="alm-subpage__p">We use Google user data solely to:</p>
        <ul className="alm-subpage__list">
          <li>Authenticate you and link your Google identity to your {APP_NAME} account.</li>
          <li>
            Complete tasks you initiate in chat or SMS (e.g., send an email, check your calendar, update
            a spreadsheet, find a file).
          </li>
          <li>
            Run background jobs or scheduled actions you explicitly request (e.g., send a reminder,
            queue research, watch for inbox changes on eligible plans).
          </li>
          <li>
            Generate AI-assisted responses and summaries related to your requests (see &quot;AI
            processing&quot; below).
          </li>
          <li>Operate, secure, debug, and improve the service.</li>
          <li>Comply with applicable law and enforce our Terms of Service.</li>
        </ul>
        <p className="alm-subpage__p">
          We do <strong>not</strong> use Google user data for targeted advertising, creditworthiness
          decisions, or unrelated profiling. Human access to Google user data is limited to what is
          necessary for support, security, or legal compliance.
        </p>

        <h3 className="alm-subpage__h3">How we share Google user data</h3>
        <p className="alm-subpage__p">
          We do <strong>not</strong> sell Google user data. We may share Google user data with the
          following categories of service providers, <strong>only</strong> as needed to operate{" "}
          {ASSISTANT_NAME}:
        </p>
        <ul className="alm-subpage__list">
          <li>
            <strong>AI providers (e.g., Anthropic):</strong> Relevant portions of your messages and
            Google content needed to generate a response or complete a task you requested. Providers
            process data under their terms; we do not authorize them to use your Google data for their
            own unrelated purposes.
          </li>
          <li>
            <strong>Cloud hosting and database providers:</strong> To store account data, conversation
            history, encrypted OAuth tokens, and job metadata on secure infrastructure.
          </li>
          <li>
            <strong>SMS and communications providers:</strong> To deliver text messages when you use SMS
            features; message content may reference task results derived from Google data.
          </li>
          <li>
            <strong>Payment processors (Stripe):</strong> Billing is separate from Google data; we do
            not share Gmail or Drive content with Stripe.
          </li>
          <li>
            <strong>Analytics (PostHog):</strong> Product usage events on our website and app (e.g.,
            page views, button clicks). We do not send Gmail bodies, Drive file contents, or other
            sensitive Google Workspace data to analytics tools.
          </li>
          <li>
            <strong>Legal and safety:</strong> When required by law, valid legal process, or to protect
            rights, safety, and security.
          </li>
        </ul>
        <p className="alm-subpage__p">
          When you use Google Sign-In, your interaction with Google is also subject to{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google&apos;s Privacy Policy
          </a>
          .
        </p>

        <h3 className="alm-subpage__h3">Storage and protection of Google user data</h3>
        <ul className="alm-subpage__list">
          <li>
            Data in transit between your browser, our servers, and Google APIs is encrypted using HTTPS
            (TLS).
          </li>
          <li>
            Google OAuth refresh tokens and other sensitive credentials are encrypted at rest and stored
            in our database with access limited to production systems that need them to run your tasks.
          </li>
          <li>
            Conversation history and task metadata are stored in a managed PostgreSQL database hosted on
            secure cloud infrastructure.
          </li>
          <li>
            We apply access controls, logging, and industry-standard security practices. No method of
            transmission or storage is 100% secure; we cannot guarantee absolute security.
          </li>
        </ul>

        <h3 className="alm-subpage__h3">Retention and deletion of Google user data</h3>
        <ul className="alm-subpage__list">
          <li>
            We retain Google-related account data, OAuth tokens, and conversation history while your
            account is active and as needed to provide the service.
          </li>
          <li>
            When you delete your {APP_NAME} account (via Account settings in the app), we delete your
            profile, conversations, stored tokens, and associated data from our primary systems, subject
            to limited backup and log retention described below.
          </li>
          <li>
            You can revoke {APP_NAME}&apos;s access to your Google account at any time at{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account permissions
            </a>
            . Revoking access stops new Google API calls; you may still delete your Ally account to remove
            data we already stored.
          </li>
          <li>
            To request deletion or export of personal data, email{" "}
            <a href="mailto:support@yourfriendally.com">support@yourfriendally.com</a> from the address
            associated with your account. We respond within a reasonable timeframe.
          </li>
          <li>
            Backup copies and server logs may persist for a limited period (typically up to 30 days)
            before automatic purging.
          </li>
        </ul>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-info">
        <h2 id="privacy-info" className="alm-subpage__h2">
          Other information we collect
        </h2>
        <ul className="alm-subpage__list">
          <li>
            <strong>Phone number:</strong> If you link a mobile number, we store it in E.164 format and
            use it to verify your account and deliver SMS messages.
          </li>
          <li>
            <strong>Conversation data:</strong> Messages you send in the web app or by SMS, plus related
            metadata (timestamps, conversation identifiers) needed to provide the service.
          </li>
          <li>
            <strong>Billing information:</strong> If you subscribe, payment processing is handled by
            Stripe. We receive subscription status and plan identifiers from Stripe, not full card
            numbers.
          </li>
          <li>
            <strong>Usage and technical data:</strong> Basic logs and analytics (IP address, browser
            type, page interactions, errors) to operate, secure, and improve the service.
          </li>
        </ul>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-ai">
        <h2 id="privacy-ai" className="alm-subpage__h2">
          AI processing
        </h2>
        <p className="alm-subpage__p">
          {ASSISTANT_NAME} uses third-party AI providers (such as Anthropic) to generate responses and
          complete tasks. Content you submit — including relevant Google Workspace data needed for your
          request — may be sent to these providers under their terms and privacy policies. We configure
          services to minimize unnecessary data retention where supported.
        </p>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-rights">
        <h2 id="privacy-rights" className="alm-subpage__h2">
          Your choices and rights
        </h2>
        <ul className="alm-subpage__list">
          <li>
            Revoke Google access anytime in{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account security settings
            </a>
            .
          </li>
          <li>Delete your Ally account in Account settings within the app.</li>
          <li>Manage or cancel subscriptions through Stripe Customer Portal or account settings.</li>
          <li>
            Request access, correction, or deletion of personal data by emailing{" "}
            <a href="mailto:support@yourfriendally.com">support@yourfriendally.com</a>.
          </li>
          <li>Depending on where you live, you may have additional rights under applicable privacy laws.</li>
        </ul>
      </section>

      <section className="alm-subpage__section" aria-labelledby="privacy-children">
        <h2 id="privacy-children" className="alm-subpage__h2">
          Children
        </h2>
        <p className="alm-subpage__p">
          {ASSISTANT_NAME} is not directed to children under 13 (or the minimum age in your jurisdiction).
          We do not knowingly collect personal information from children.
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
          Questions about this Privacy Policy or Google user data practices:{" "}
          <a href="mailto:support@yourfriendally.com">support@yourfriendally.com</a>
        </p>
      </section>
    </LegalPageLayout>
  );
}
