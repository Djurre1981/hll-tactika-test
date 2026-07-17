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
    <p className="dashboard-toast" role="status" aria-live="polite" hidden={!toast.visible}>
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
