import AllyHomeLink from "./AllyHomeLink";
import AppShellAccountAvatar from "./AppShellAccountAvatar";

/**
 * Signed-in app top bar: ✳ ally (home → /home) on the left, optional back + title.
 */
export default function AppShellHeader({
  title,
  showBack = false,
  onBack,
  backLabel = "Back",
  right = null,
  user = null,
  showAccountAvatar = true,
  className = "",
}) {
  return (
    <header className={`app-shell-header ${className}`.trim()}>
      <div className="app-shell-header__left">
        <AllyHomeLink />
        {showBack ? (
          <button type="button" className="app-shell-header__back" onClick={onBack}>
            <svg className="app-shell-header__back-icon" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {backLabel}
          </button>
        ) : null}
      </div>
      {title ? (
        <h1 className="app-shell-header__title">{title}</h1>
      ) : (
        <span className="app-shell-header__title-spacer" aria-hidden />
      )}
      <div className="app-shell-header__right">
        {right}
        {user && showAccountAvatar ? <AppShellAccountAvatar user={user} /> : null}
      </div>
    </header>
  );
}
