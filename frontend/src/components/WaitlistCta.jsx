import { Link } from "react-router-dom";
import { captureEvent } from "../analytics/posthog";
import { WAITLIST_MODE } from "../constants/waitlist";
import { useWaitlist } from "../contexts/WaitlistContext";

/**
 * Primary marketing CTA — opens waitlist modal in waitlist mode, otherwise links to login.
 */
export default function WaitlistCta({
  to = "/login",
  source = "site",
  className,
  children = "Join waitlist",
  onClick,
  ...rest
}) {
  const { openWaitlist } = useWaitlist();

  if (!WAITLIST_MODE) {
    return (
      <Link
        to={to}
        className={className}
        onClick={(e) => {
          captureEvent("cta_clicked", {
            source,
            label: typeof children === "string" ? children : "cta",
            type: "link",
            destination: to,
          });
          onClick?.(e);
        }}
        {...rest}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        captureEvent("cta_clicked", {
          source,
          label: typeof children === "string" ? children : "cta",
          type: "waitlist",
        });
        onClick?.(e);
        if (!e.defaultPrevented) openWaitlist(source);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
