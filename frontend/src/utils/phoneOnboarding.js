export const PENDING_PHONE_KEY = "ally_pending_phone";
export const SHOW_SMS_HANDOFF_KEY = "ally_show_sms_handoff";

export function getPendingPhone() {
  try {
    return window.localStorage.getItem(PENDING_PHONE_KEY) || "";
  } catch {
    return "";
  }
}

export function setPendingPhone(phone) {
  try {
    window.localStorage.setItem(PENDING_PHONE_KEY, phone);
  } catch {
    /* ignore */
  }
}

export function clearPendingPhone() {
  try {
    window.localStorage.removeItem(PENDING_PHONE_KEY);
  } catch {
    /* ignore */
  }
}

export function markShowSmsHandoff() {
  try {
    window.localStorage.setItem(SHOW_SMS_HANDOFF_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeShowSmsHandoff() {
  try {
    const v = window.localStorage.getItem(SHOW_SMS_HANDOFF_KEY);
    if (v) window.localStorage.removeItem(SHOW_SMS_HANDOFF_KEY);
    return Boolean(v);
  } catch {
    return false;
  }
}
