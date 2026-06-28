import { ALLY_AVATAR_URL } from "../constants/brand";

/** Ally brand mark — mascot used in nav, footer, phone header, and chat chrome. */
export default function AllyMark({ className = "", alt = "" }) {
  return (
    <img
      src={ALLY_AVATAR_URL}
      alt={alt}
      className={className ? `ally-mark ${className}` : "ally-mark"}
      decoding="async"
      {...(alt ? {} : { "aria-hidden": true })}
    />
  );
}
