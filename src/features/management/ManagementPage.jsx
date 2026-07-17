import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useHub } from "../home/HubContext.jsx";
import { ManagementNav, MANAGEMENT_SECTIONS } from "./ManagementNav.jsx";
import { FoldersSection } from "./sections/FoldersSection.jsx";
import { RosterSection } from "./sections/RosterSection.jsx";
import "./management.css";

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
    <div className="mgmt-shell">
      <div className="mgmt-stage">
        <div
          className="mgmt-stage__track"
          style={{ transform: `translateY(-${index * 100}%)` }}
        >
          <div className="mgmt-stage__panel">
            <RosterSection />
          </div>
          <div className="mgmt-stage__panel">
            <FoldersSection />
          </div>
        </div>
      </div>
    </div>
  );
}
