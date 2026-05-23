const MOBILE_MAX = 1023;

export function isMobileAccountLayout() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
}

/** Mobile → /account page; desktop → open settings modal. */
export function openAccountSettings(navigate, openModal) {
  if (isMobileAccountLayout()) {
    navigate("/account");
    return;
  }
  openModal?.();
}
