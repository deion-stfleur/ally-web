import { formatPlanPrice } from "../constants/plans";

/**
 * Sale price + strikethrough compare-at, shared across pricing cards and modal.
 */
export default function PlanPriceDisplay({
  plan,
  priceClassName = "alm-pricing__price",
  compareClassName = "alm-pricing__price-compare",
  currentClassName = "alm-pricing__price-current",
  unitClassName = "alm-pricing__price-unit",
}) {
  const compareAt = plan.compareAtPrice;

  return (
    <p className={priceClassName}>
      <span className={currentClassName}>${formatPlanPrice(plan.price)}</span>
      <span className={unitClassName}>/month</span>
      {compareAt != null ? (
        <span className={compareClassName} aria-hidden="true">
          ${formatPlanPrice(compareAt)}
        </span>
      ) : null}
    </p>
  );
}
