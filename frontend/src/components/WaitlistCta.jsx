import { Link } from "react-router-dom";
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
      <Link to={to} className={className} onClick={onClick} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) openWaitlist(source);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
