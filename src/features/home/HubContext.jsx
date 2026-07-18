import { createContext, useCallback, useContext, useRef, useState } from "react";

const HubContext = createContext(null);

export function useHub() {
  const value = useContext(HubContext);
  if (!value) {
    throw new Error("useHub must be used inside HubLayout");
  }
  return value;
}

export function HubToast() {
  const { toast } = useHub();

  return (
    <p
      className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-[0.78rem] tracking-wide text-white/90 shadow-glass backdrop-blur-md"
      role="status"
      aria-live="polite"
      hidden={!toast.visible}
    >
      {toast.message}
    </p>
  );
}

export function HubProvider({ children }) {
  const [toast, setToast] = useState({ visible: false, message: "" });
  const [rail, setRail] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((message) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    setToast({ visible: true, message });
    timerRef.current = window.setTimeout(() => {
      setToast({ visible: false, message: "" });
      timerRef.current = null;
    }, 2200);
  }, []);

  return (
    <HubContext.Provider value={{ toast, showToast, rail, setRail }}>
      {children}
    </HubContext.Provider>
  );
}
