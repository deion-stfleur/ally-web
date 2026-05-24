/** Always open full account settings page (no modal). */
export function openAccountSettings(navigate, fromPath = null) {
  const from =
    typeof fromPath === "string" && fromPath.startsWith("/") ? fromPath : null;
  navigate("/account", from ? { state: { from } } : undefined);
}
