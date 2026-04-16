"""Normalize phone numbers to E.164-style +digits (US-friendly defaults)."""


def normalize_e164(raw: str) -> str:
    s = (raw or "").strip()
    digits = "".join(c for c in s if c.isdigit())
    if not digits:
        return ""
    if s.strip().startswith("+"):
        return "+" + digits
    if len(digits) == 10:
        return "+1" + digits
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits
    return "+" + digits
