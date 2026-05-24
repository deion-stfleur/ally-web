import { Link, useLocation } from "react-router-dom";

function initialsFromUser(user) {
  const name = String(user?.name || "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const email = String(user?.email || "").trim();
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

export default function AppShellAccountAvatar({ user }) {
  const location = useLocation();
  const picture = user?.picture;
  const label = user?.name || user?.email || "Account";

  return (
    <Link
      to="/account"
      state={{ from: location.pathname }}
      className="app-shell-account-avatar"
      aria-label="Account settings"
      title={label}
    >
      {picture ? (
        <img src={picture} alt="" className="app-shell-account-avatar__img" referrerPolicy="no-referrer" />
      ) : (
        <span className="app-shell-account-avatar__initials" aria-hidden>
          {initialsFromUser(user)}
        </span>
      )}
    </Link>
  );
}
