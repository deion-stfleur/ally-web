import { Link } from "react-router-dom";
const PLANS = [
  {
    id: "starter",
    tier: "Starter",
    name: "Ally",
    price: 10,
    tagline: "Text Ally when you need a hand.",
    features: [
      "Works with Gmail, Calendar, Drive, Sheets and more",
      "Handles tasks and searches web for you",
      "Keeps going until the job's done, then texts you",
      "Available on web and iMessage",
      "Learns your habits and preferences from chat",
    ],
    footnote: "$10/mo. cancel anytime.",
  },
  {
    id: "pro",
    tier: "Pro",
    name: "Ally Pro",
    price: 30,
    tagline: "Ally stays on it and texts you first.",
    featured: true,
    footnote: "cancel anytime. switch plans from your dashboard.",
    features: [
      "Everything in Starter",
      "Remembers your interests, schedule, and tasks across all chats",
      "Texts you automatically when there's an update",
      "Handles complex tasks until they're done, all in one thread",
      "Sends scheduled recaps, check-ins, and reminders",
      "Run 24/7 background tasks for you",
    ],
  },
];

export default function LandingPricing() {
  return (
    <section className="alm-landing-pricing" aria-labelledby="alm-landing-pricing-heading">
      <div className="alm-landing-pricing__inner">
        <div className="alm-pricing__head">
          <h2 id="alm-landing-pricing-heading" className="alm-pricing__title">
            Pick your plan
          </h2>
          <p className="alm-pricing__sub">
            Both plans include web and SMS. Pro adds proactive texts and deeper follow-through.
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
              <p className="alm-pricing__price">
                ${plan.price}
                <span className="alm-pricing__price-unit">/month</span>
              </p>
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
