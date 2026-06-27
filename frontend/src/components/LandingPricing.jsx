import { Link } from "react-router-dom";
import { PLANS } from "../constants/plans";
import PlanPriceDisplay from "./PlanPriceDisplay";

export default function LandingPricing() {
  return (
    <section className="alm-landing-pricing" aria-labelledby="alm-landing-pricing-heading">
      <div className="alm-landing-pricing__inner">
        <div className="alm-pricing__head">
          <h2 id="alm-landing-pricing-heading" className="alm-pricing__title">
            Pick your plan
          </h2>
          <p className="alm-pricing__sub">
            Task Runner is 3 jobs/day — no Gmail, no chat memory. Ally and Ally Pro are full assistants with Google tools.
          </p>
        </div>
        <div className="alm-pricing__grid">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`alm-pricing__card${plan.featured ? " alm-pricing__card--featured" : ""}`}
            >
              {plan.featured ? <p className="alm-pricing__badge">Most popular</p> : null}
              <h3 className="alm-pricing__plan-name">{plan.name}</h3>
              <p className="alm-pricing__plan-tag">{plan.tagline}</p>
              {plan.description ? (
                <p className="alm-pricing__plan-desc">{plan.description}</p>
              ) : null}
              <PlanPriceDisplay plan={plan} />
              <ul className="alm-pricing__features">
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className="alm-pricing__cta-wrap">
                <Link
                  to="/pricing"
                  className={`alm-pricing__cta${plan.featured ? " alm-pricing__cta--featured" : ""}`}
                >
                  Get {plan.tier}
                </Link>
                <p className="alm-pricing__footnote">{plan.footnote}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
