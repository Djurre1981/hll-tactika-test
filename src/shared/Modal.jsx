import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button.jsx";

const MODAL_WIDTH = {
  default: "max-w-md",
  wide: "max-w-4xl",
};

export function Modal({ open, onClose, title, children, size = "default" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const widthClass = MODAL_WIDTH[size] || MODAL_WIDTH.default;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-hidden bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className={`glass-panel my-4 flex w-full ${widthClass} max-h-[min(90vh,calc(100dvh-2rem))] flex-col overflow-hidden p-5 sm:my-auto`}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>
        <div className="glass-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
