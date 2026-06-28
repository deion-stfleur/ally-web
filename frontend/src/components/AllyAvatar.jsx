import { ALLY_AVATAR_URL } from "../constants/brand";

/** Ally mascot — use in phone/SMS UI, login, and anywhere Ally should feel like a person. */
export default function AllyAvatar({
  className = "ally-avatar",
  alt = "Ally",
  decorative = false,
  ...props
}) {
  return (
    <img
      src={ALLY_AVATAR_URL}
      alt={decorative ? "" : alt}
      className={className}
      decoding="async"
      {...(decorative ? { "aria-hidden": true } : {})}
      {...props}
    />
  );
}
