import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FadeInSection from "../components/FadeInSection";
import LandingTextLoop from "../components/LandingTextLoop";
import LandingCompareTable from "../components/LandingCompareTable";
import LandingFaq from "../components/LandingFaq";
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
import "./ally-lp.css";

const INTEGRATIONS = [
  { label: "Google", Icon: IconGoogle },
  { label: "Gmail", Icon: IconGmail },
  { label: "Sheets", Icon: IconGoogleSheets },
  { label: "Calendar", Icon: IconGoogleCalendar },
  { label: "Apple", Icon: IconApple },
  { label: "Android", Icon: IconAndroid },
];

const HERO_TYPE_PREFIX = "Meet Ally. ";
const HERO_TYPE_BODY = "Like texting a friend who actually follows through.";
const HERO_TYPE_FULL = `${HERO_TYPE_PREFIX}${HERO_TYPE_BODY}`;

export default function Landing() {
  const [heroTypedLen, setHeroTypedLen] = useState(0);

  useEffect(() => {
    const full = HERO_TYPE_FULL;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setHeroTypedLen(full.length);
      return undefined;
    }
    let i = 0;
    const msPerChar = 58;
    const id = window.setInterval(() => {
      i += 1;
      if (i >= full.length) {
        setHeroTypedLen(full.length);
        window.clearInterval(id);
        return;
      }
      setHeroTypedLen(i);
    }, msPerChar);
    return () => window.clearInterval(id);
  }, []);

  const heroVisible = HERO_TYPE_FULL.slice(0, heroTypedLen);
  const heroPrefixLen = HERO_TYPE_PREFIX.length;
  const heroStrongText = heroVisible.length <= heroPrefixLen ? heroVisible : HERO_TYPE_PREFIX;
  const heroRestText = heroVisible.length <= heroPrefixLen ? "" : heroVisible.slice(heroPrefixLen);
  const heroTypingDone = heroTypedLen >= HERO_TYPE_FULL.length;

  return (
    <div className="alm">
      <FadeInSection className="alm-reveal-nav">
        <MarketingNav />
      </FadeInSection>

      <main className="alm-main">
        <FadeInSection as="div" className="alm-reveal-block">
        <section className="alm-hero">
          <h1 className="alm-hero__title" aria-label={heroTypingDone ? HERO_TYPE_FULL : undefined}>
            <span className="alm-hero__type-line">
              <strong className="alm-hero__type-strong">{heroStrongText}</strong>
              {heroRestText ? <span className="alm-hero__type-rest">{heroRestText}</span> : null}
              {!heroTypingDone ? <span className="alm-hero__type-cursor" aria-hidden /> : null}
            </span>
          </h1>
          <p className="alm-hero__lead">
            You text once. Ally stays on it and pings you when something moves.
          </p>
          <Link to="/login" className="alm-hero__cta">
            Start free trial
          </Link>
          <HeroInteractivePhone />
        </section>
        </FadeInSection>


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
          <LandingCompareTable />
        </FadeInSection>

        <FadeInSection as="div" className="alm-reveal-block">
          <LandingFaq />
        </FadeInSection>
      </main>
      <FadeInSection as="div" className="alm-reveal-footer">
        <MarketingFooter />
      </FadeInSection>
    </div>
  );
}
