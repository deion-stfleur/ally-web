/** When true, marketing CTAs open the waitlist modal instead of login/pricing. */
export const WAITLIST_MODE =
  String(process.env.REACT_APP_WAITLIST_MODE || "").trim().toLowerCase() === "true";
