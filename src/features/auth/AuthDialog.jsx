import { useEffect, useRef } from "react";

const DEFAULT_TITLE = "CIRCLE COMP LOGIN";
const DEFAULT_MESSAGE =
  "Sign in with your Hell Let Loose Steam account to access the platform. Only approved Circle members can have access.";

const STEAM_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 2.64.85 5.08 2.29 7.07L.1 24l5.08-1.33A11.94 11.94 0 0012 24c6.63 0 12-5.37 12-12S18.63 0 12 0zm6.49 7.38l-1.81 5.25-5.31-.09-4.12 3.81-.64-3.88 4.43-3.52 6-3.07z" />
  </svg>
);

export function AuthDialog({
  open,
  onClose,
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
  showLogin = true,
}) {
  const dialogRef = useRef(null);
  const steamBtnRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onCancel = (e) => {
      e.preventDefault();
      onClose?.();
    };
    const onClick = (e) => {
      // Click on the dialog backdrop (the dialog element itself, outside the card).
      if (e.target === dialog) onClose?.();
    };

    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("click", onClick);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("click", onClick);
    };
  }, [onClose]);

  useEffect(() => {
    const btn = steamBtnRef.current;
    if (!open || !btn) return;

    const onMove = (e) => {
      const rect = btn.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      btn.style.setProperty("--mirror-x", `${x}%`);
      btn.style.setProperty("--mirror-y", `${y}%`);
      btn.style.setProperty("--mirror-opacity", "1");
    };
    const onLeave = () => btn.style.setProperty("--mirror-opacity", "0");

    btn.addEventListener("pointermove", onMove);
    btn.addEventListener("pointerleave", onLeave);
    return () => {
      btn.removeEventListener("pointermove", onMove);
      btn.removeEventListener("pointerleave", onLeave);
    };
  }, [open, showLogin]);

  return (
    <dialog ref={dialogRef} className="auth-gate" aria-labelledby="auth-gate-title">
      <div className="auth-gate__card">
        <button type="button" className="auth-gate__close" onClick={onClose} aria-label="Close">
          &times;
        </button>
        <h2 id="auth-gate-title">{title}</h2>
        <p className="auth-gate__message">{message}</p>
        {showLogin ? (
          <a ref={steamBtnRef} href="/api/auth/steam" className="btn--steam">
            <span className="btn--steam__icon">{STEAM_ICON}</span>
            <span className="btn--steam__label">Sign in with Steam</span>
          </a>
        ) : null}
      </div>
    </dialog>
  );
}
