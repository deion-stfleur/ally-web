import { useEffect, useState } from "react";
import FadeInSection from "../components/FadeInSection";
import LandingTextLoop from "../components/LandingTextLoop";
import LandingTestimonials from "../components/LandingTestimonials";
import LandingUniqueAdvantage from "../components/LandingUniqueAdvantage";
import LandingCompareTable from "../components/LandingCompareTable";
import LandingProofPoints from "../components/LandingProofPoints";
import LandingFaq from "../components/LandingFaq";
import LandingPricing from "../components/LandingPricing";
import MarketingFooter from "../components/MarketingFooter";
import MarketingNav from "../components/MarketingNav";
import HeroInteractivePhone from "../components/HeroInteractivePhone";
import WaitlistCta from "../components/WaitlistCta";
import { APP_NAME, APP_TAGLINE, ASSISTANT_NAME } from "../constants/brand";
import { WAITLIST_MODE } from "../constants/waitlist";
import {
  IconAndroid,
  IconApple,
  IconGmail,
  IconGoogle,
  IconGoogleCalendar,
  IconGoogleSheets,
} from "./IntegrationIcons";
import "./ally-lp.css";

const INTEGRATIONS = [
  { label: "Google", Icon: IconGoogle },
  { label: "Gmail", Icon: IconGmail },
  { label: "Sheets", Icon: IconGoogleSheets },
  { label: "Calendar", Icon: IconGoogleCalendar },
  { label: "Apple", Icon: IconApple },
  { label: "Android", Icon: IconAndroid },
];

const HERO_TITLE_PREFIX = `Meet ${APP_NAME}. `;
const HERO_TITLE_BODY = APP_TAGLINE;
const HERO_LEAD =
  `You text once. ${ASSISTANT_NAME} stays on it and pings you when something moves.`;

const HERO_TRUST = [
  "Works with Google Workspace",
  "SMS & iMessage",
  "Background tasks & watches",
];

export default function Landing() {
  const [heroMotion, setHeroMotion] = useState(true);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) setHeroMotion(false);
  }, []);

  const fadeClass = (step) =>
    ["alm-hero-fade-up", heroMotion ? `alm-hero-fade-up--${step}` : "alm-hero-fade-up--static"]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="alm alm--landing">
      <main className="alm-main">
        <section className="alm-hero alm-hero--split">
          <div className="alm-hero__stage">
            <MarketingNav overlay dark />
            <div className="alm-hero__grid">
              <div className="alm-hero__copy">
                <h1 className={`alm-hero__title ${fadeClass(1)}`}>
                  <strong className="alm-hero__title-strong">{HERO_TITLE_PREFIX}</strong>
                  <span className="alm-hero__title-body">{HERO_TITLE_BODY}</span>
                </h1>
                <p className={`alm-hero__lead ${fadeClass(2)}`}>{HERO_LEAD}</p>
                <div className={`alm-hero__actions ${fadeClass(3)}`}>
                  <WaitlistCta
                    source="landing-hero"
                    className="alm-hero__cta alm-hero__cta--primary"
                  >
                    {WAITLIST_MODE ? "Join waitlist" : `Text ${ASSISTANT_NAME}`}
                  </WaitlistCta>
                </div>
                <ul className={`alm-hero__trust ${fadeClass(3)}`} aria-label="Highlights">
                  {HERO_TRUST.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="alm-hero__visual alm-hero-fade-up--static">
                <div className="alm-hero__visual-glow" aria-hidden />
                <div className="alm-hero__phone">
                  <HeroInteractivePhone />
                </div>
              </div>
            </div>
          </div>
        </section>

        <FadeInSection as="div" className="alm-reveal-block">
        <footer className="alm-integ" id="integrations">
          <p className="alm-integ__label">Integrates with</p>
          <div className="alm-integ__row">
            {INTEGRATIONS.map(({ label, Icon }) => (
              <div key={label} className="alm-integ__item">
                <span className="alm-integ__icon-wrap">
                  <Icon />
                </span>
                <span className="alm-integ__name">{label}</span>
              </div>
            ))}
          </div>
        </footer>
        </FadeInSection>

        <FadeInSection as="div" className="alm-reveal-block">
          <LandingTextLoop />
        </FadeInSection>

        <FadeInSection as="div" className="alm-reveal-block">
          <LandingTestimonials />
        </FadeInSection>

        <FadeInSection as="div" className="alm-reveal-block alm-reveal-block--bleed">
          <LandingUniqueAdvantage />
        </FadeInSection>

        <FadeInSection as="div" className="alm-reveal-block">
          <LandingCompareTable />
        </FadeInSection>

        <FadeInSection as="div" className="alm-reveal-block alm-reveal-block--bleed">
          <LandingProofPoints />
        </FadeInSection>

        <FadeInSection as="div" className="alm-reveal-block">
          <LandingFaq />
        </FadeInSection>

        {!WAITLIST_MODE ? (
          <FadeInSection as="div" className="alm-reveal-block">
            <LandingPricing />
          </FadeInSection>
        ) : null}
      </main>
      <MarketingFooter />
    </div>
  );
}
