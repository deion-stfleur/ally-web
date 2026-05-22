/** First outbound from Ally often requires the user to text this line first (Sendblue). */
export const DEFAULT_FIRST_SMS_BODY = "Hi Ally";

/**
 * @param {string | null | undefined} e164 e.g. +16452468277
 * @param {string} [body]
 * @returns {string | null}
 */
export function buildSmsDeepLink(e164, body = DEFAULT_FIRST_SMS_BODY) {
  if (!e164) return null;
  const digits = String(e164).replace(/\D/g, "");
  if (!digits) return null;
  const q = encodeURIComponent(body);
  return `sms:+${digits}${q ? `?body=${q}` : ""}`;
}

/**
 * @param {string | null | undefined} e164
 * @returns {string}
 */
export function formatPhoneDisplay(e164) {
  if (!e164) return "";
  const d = String(e164).replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}
