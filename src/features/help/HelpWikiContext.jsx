import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { HelpWikiOverlay } from "./HelpWikiOverlay.jsx";

const HelpWikiContext = createContext(null);

export function HelpWikiProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [pageId, setPageId] = useState("Home");

  const openWiki = useCallback((id = "Home") => {
    setPageId(id || "Home");
    setOpen(true);
  }, []);

  const closeWiki = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, pageId, openWiki, closeWiki, setPageId }),
    [open, pageId, openWiki, closeWiki]
  );

  return (
    <HelpWikiContext.Provider value={value}>
      {children}
      <HelpWikiOverlay />
    </HelpWikiContext.Provider>
  );
}

export function useHelpWiki() {
  const ctx = useContext(HelpWikiContext);
  if (!ctx) {
    throw new Error("useHelpWiki must be used inside HelpWikiProvider");
  }
  return ctx;
}
