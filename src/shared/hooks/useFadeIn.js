import { useEffect, useState } from "react";

export function useFadeIn({ delay = 0, duration = 650, enabled = true } = {}) {
  const [style, setStyle] = useState({
    opacity: 0,
    transform: "translateY(14px)",
    transition: "none",
  });

  useEffect(() => {
    if (!enabled) {
      setStyle({ opacity: 1, transform: "translateY(0)", transition: "none" });
      return undefined;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setStyle({ opacity: 1, transform: "translateY(0)", transition: "none" });
      return undefined;
    }

    setStyle({
      opacity: 0,
      transform: "translateY(14px)",
      transition: "none",
    });

    const startTimer = window.setTimeout(() => {
      setStyle({
        opacity: 1,
        transform: "translateY(0)",
        transition: `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      });
    }, delay);

    return () => window.clearTimeout(startTimer);
  }, [delay, duration, enabled]);

  return style;
}
