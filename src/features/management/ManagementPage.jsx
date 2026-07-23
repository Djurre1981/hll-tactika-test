import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useHub } from "../home/HubContext.jsx";
import { ManagementNav, MANAGEMENT_SECTIONS } from "./ManagementNav.jsx";
import { FoldersSection } from "./sections/FoldersSection.jsx";
import { HistorySection } from "./sections/HistorySection.jsx";
import { AnalyticsSection } from "./sections/AnalyticsSection.jsx";
import { OverviewSection } from "./sections/OverviewSection.jsx";
import { RosterSection } from "./sections/RosterSection.jsx";

function sectionFromHash(hash) {
  const id = String(hash || "").replace(/^#/, "");
  return MANAGEMENT_SECTIONS.some((section) => section.id === id) ? id : "overview";
}

const SECTION_VIEWS = [
  { id: "overview", render: () => <OverviewSection /> },
  { id: "roster", render: () => <RosterSection /> },
  { id: "folders", render: () => <FoldersSection /> },
  { id: "history", render: () => <HistorySection /> },
  { id: "analytics", render: () => <AnalyticsSection /> },
];

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

  const activeIndex = Math.max(
    0,
    SECTION_VIEWS.findIndex((section) => section.id === activeSection),
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" data-hub-fill>
      {/*
        Each section is a full-height absolute slide. Transform % is relative to the
        slide itself (viewport), so panels never bleed into neighbouring sections.
      */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {SECTION_VIEWS.map((section, index) => {
          const offset = index - activeIndex;
          const isActive = offset === 0;
          return (
            <div
              key={section.id}
              className={[
                "absolute inset-0 flex min-h-0 flex-col transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                isActive ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
              style={{ transform: `translateY(${offset * 100}%)` }}
              aria-hidden={!isActive}
            >
              <div className="box-border flex h-full min-h-0 flex-col overflow-hidden">
                {section.render()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
