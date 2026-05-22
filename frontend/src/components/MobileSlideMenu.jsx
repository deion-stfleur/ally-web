import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Full-screen slide-in panel via portal (fixes iOS Safari when ancestors use transform/overflow).
 */
export default function MobileSlideMenu({
  open,
  onClose,
  ariaLabel = "Menu",
  children,
  footer = null,
  panelClassName = "",
}) {
  const handleBackdrop = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className={`mobile-slide-menu__backdrop${open ? " is-open" : ""}`}
        aria-hidden={!open}
        onClick={onClose}
        onTouchEnd={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
      <div
        className={`mobile-slide-menu__panel${open ? " is-open" : ""} ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-hidden={!open}
      >
        {children}
        {footer}
      </div>
    </>,
    document.body
  );
}
