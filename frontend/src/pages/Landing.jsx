import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FadeInSection from "../components/FadeInSection";
import LandingTextLoop from "../components/LandingTextLoop";
import LandingTestimonials from "../components/LandingTestimonials";
import LandingCompareTable from "../components/LandingCompareTable";
import LandingFaq from "../components/LandingFaq";
import LandingPricing from "../components/LandingPricing";
import MarketingFooter from "../components/MarketingFooter";
import MarketingNav from "../components/MarketingNav";
import HeroInteractivePhone from "../components/HeroInteractivePhone";
import {
  IconAndroid,
  IconApple,
  IconGmail,
  IconGoogle,
  IconGoogleCalendar,
  IconGoogleSheets,
} from "./IntegrationIcons";
import heroMountains from "../assets/hero-mountains.png";
import "./ally-lp.css";

const INTEGRATIONS = [
  { label: "Google", Icon: IconGoogle },
  { label: "Gmail", Icon: IconGmail },
  { label: "Sheets", Icon: IconGoogleSheets },
  { label: "Calendar", Icon: IconGoogleCalendar },
  { label: "Apple", Icon: IconApple },
  { label: "Android", Icon: IconAndroid },
];

const HERO_TITLE_PREFIX = "Meet Ally. ";
const HERO_TITLE_BODY = "Like texting a friend who actually follows through.";

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
        <section className="alm-hero">
          <div
            className="alm-hero__stage"
            style={{ "--alm-hero-bg-image": `url(${heroMountains})` }}
          >
            <MarketingNav overlay />
            <div className="alm-hero__copy">
              <h1 className="alm-hero__title">
                <strong className={`alm-hero__title-strong ${fadeClass(1)}`}>
                  {HERO_TITLE_PREFIX}
                </strong>
                <span className={`alm-hero__title-body ${fadeClass(1)}`}>
                  {HERO_TITLE_BODY}
                </span>
              </h1>
              <p className={`alm-hero__lead ${fadeClass(2)}`}>
                You text once. Ally stays on it and pings you when something moves.
              </p>
              <Link to="/login" className={`alm-hero__cta ${fadeClass(3)}`}>
                Text Ally
              </Link>
              <div className="alm-hero__phone">
                <div className={fadeClass(4)}>
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

        <FadeInSection as="div" className="alm-reveal-block">
          <LandingCompareTable />
        </FadeInSection>

        <FadeInSection as="div" className="alm-reveal-block">
          <LandingFaq />
        </FadeInSection>

        <FadeInSection as="div" className="alm-reveal-block">
          <LandingPricing />
        </FadeInSection>
      </main>
      <MarketingFooter />
    </div>
  );
}
