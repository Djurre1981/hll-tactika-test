import { useEffect } from "react";
import { Button } from "./Button.jsx";

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="glass-panel my-4 flex w-full max-w-md max-h-[min(90vh,calc(100dvh-2rem))] flex-col p-5 sm:my-auto"
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          {children}
        </div>
      </div>
    </div>
  );
}
