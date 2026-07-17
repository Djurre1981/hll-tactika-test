import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useHub } from "../home/HubContext.jsx";
import { ManagementNav, MANAGEMENT_SECTIONS } from "./ManagementNav.jsx";
import { FoldersSection } from "./sections/FoldersSection.jsx";
import { RosterSection } from "./sections/RosterSection.jsx";

function sectionFromHash(hash) {
  const id = String(hash || "").replace(/^#/, "");
  return MANAGEMENT_SECTIONS.some((section) => section.id === id) ? id : "roster";
}

export function ManagementPage() {
  const location = useLocation();
  const { setRail, showToast } = useHub();
  const [activeSection, setActiveSection] = useState(() => sectionFromHash(location.hash));

  useEffect(() => {
    setActiveSection(sectionFromHash(location.hash));
  }, [location.hash]);

  function selectSection(id) {
    setActiveSection(id);
    if (window.location.hash !== `#${id}`) {
      window.history.replaceState(null, "", `#${id}`);
    }
  }

  useEffect(() => {
    setRail(
      <ManagementNav
        activeSection={activeSection}
        onSelect={selectSection}
        onPlaceholder={(label) => showToast(`${label} — coming soon`)}
      />,
    );
    return () => setRail(null);
  }, [activeSection, setRail, showToast]);

  const index = Math.max(
    0,
    MANAGEMENT_SECTIONS.findIndex((section) => section.id === activeSection),
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" data-hub-fill>
      <div className="relative min-h-[28rem] flex-1 overflow-hidden md:min-h-0">
        <div
          className="absolute inset-0 transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] max-md:relative max-md:inset-auto"
          style={{ transform: `translateY(-${index * 100}%)` }}
        >
          <div className="h-full overflow-auto px-1 pb-2 pt-1.5 box-border">
            <RosterSection />
          </div>
          <div className="h-full overflow-auto px-1 pb-2 pt-1.5 box-border">
            <FoldersSection />
          </div>
        </div>
      </div>
    </div>
  );
}
