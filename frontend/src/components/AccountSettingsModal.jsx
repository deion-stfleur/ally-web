import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import AccountSettingsPanel from "./AccountSettingsPanel";

/**
 * Center settings modal (desktop / wide screens).
 */
export default function AccountSettingsModal({
  open,
  onClose,
  user,
  onLogout,
  onDeleteAccount,
  onDeleted,
  onViewPlans,
}) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="relative flex max-h-[min(90vh,640px)] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close settings"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <AccountSettingsPanel
          variant="modal"
          user={user}
          onLogout={onLogout}
          onDeleteAccount={onDeleteAccount}
          onDeleted={onDeleted}
          onViewPlans={onViewPlans}
          onClose={handleClose}
        />
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
