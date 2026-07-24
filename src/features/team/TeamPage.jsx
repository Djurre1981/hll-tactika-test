import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthGate.jsx";
import { useHub } from "../home/HubContext.jsx";
import { AdminNav, sectionsForPanel } from "./AdminNav.jsx";
import { FeedbackSection } from "./sections/FeedbackSection.jsx";
import { MembersSection } from "./sections/MembersSection.jsx";
import { OverviewSection } from "./sections/OverviewSection.jsx";
import { OwnerMetricsSection } from "./sections/OwnerMetricsSection.jsx";
import { OwnerToolsSection } from "./sections/OwnerToolsSection.jsx";

const ADMIN_SECTIONS = sectionsForPanel("admin");
const OWNER_SECTIONS = sectionsForPanel("owner");
const ALL_SECTIONS = new Set([...ADMIN_SECTIONS, ...OWNER_SECTIONS]);

function panelFromHash(hash, isOwner) {
  const id = String(hash || "").replace(/^#/, "");
  if (OWNER_SECTIONS.includes(id)) {
    return isOwner ? "owner" : "admin";
  }
  return "admin";
}

function sectionFromHash(hash, panel, isOwner) {
  const id = String(hash || "").replace(/^#/, "");
  if (!ALL_SECTIONS.has(id)) {
    return panel === "owner" ? "metrics" : "overview";
  }
  if (OWNER_SECTIONS.includes(id) && !isOwner) {
    return "overview";
  }
  if (panel === "owner" && !OWNER_SECTIONS.includes(id)) {
    return "metrics";
  }
  if (panel === "admin" && !ADMIN_SECTIONS.includes(id)) {
    return "overview";
  }
  return id;
}

const SECTION_VIEWS = [
  { id: "overview", panel: "admin", render: (onPlaceholder) => <OverviewSection onPlaceholder={onPlaceholder} /> },
  { id: "members", panel: "admin", render: () => <MembersSection /> },
  { id: "feedback", panel: "admin", render: (onPlaceholder) => <FeedbackSection onPlaceholder={onPlaceholder} /> },
  { id: "metrics", panel: "owner", render: (onPlaceholder) => <OwnerMetricsSection onPlaceholder={onPlaceholder} /> },
  { id: "tools", panel: "owner", render: (onPlaceholder) => <OwnerToolsSection onPlaceholder={onPlaceholder} /> },
];

function PanelToggle({ panel, isOwner, onChange }) {
  if (!isOwner) {
    return null;
  }

  const index = panel === "owner" ? 1 : 0;

  return (
    <div
      className="relative grid w-full max-w-md grid-cols-2 gap-0 rounded-full border border-white/10 bg-white/[0.065] p-0.5 shadow-glass backdrop-blur-xl"
      role="tablist"
      aria-label="Website admin panel"
    >
      <button
        type="button"
        role="tab"
        aria-selected={panel === "admin"}
        className="relative z-[1] cursor-pointer rounded-full border-0 bg-transparent px-3 py-2 text-[0.68rem] font-light uppercase tracking-[0.1em] text-white/55 transition-colors hover:text-white/80 aria-selected:text-white sm:text-[0.72rem]"
        onClick={() => onChange("admin")}
      >
        Admin Panel
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={panel === "owner"}
        className="relative z-[1] cursor-pointer rounded-full border-0 bg-transparent px-3 py-2 text-[0.68rem] font-light uppercase tracking-[0.1em] text-white/55 transition-colors hover:text-white/80 aria-selected:text-white sm:text-[0.72rem]"
        onClick={() => onChange("owner")}
      >
        Owner Panel
      </button>
      <span
        className="pointer-events-none absolute left-0.5 top-0.5 h-[calc(100%-0.25rem)] w-[calc(50%-0.25rem)] rounded-full border border-white/15 bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(${index * 100}%)` }}
        aria-hidden="true"
      />
    </div>
  );
}

export function TeamPage({ hub = false }) {
  const currentUser = useAuth();
  const location = useLocation();
  const isOwner = currentUser.role === "owner";
  const { setRail, showToast } = useHub();
  const [panel, setPanel] = useState(() => panelFromHash(location.hash, isOwner));
  const [activeSection, setActiveSection] = useState(() =>
    sectionFromHash(location.hash, panelFromHash(location.hash, isOwner), isOwner),
  );

  useEffect(() => {
    const nextPanel = panelFromHash(location.hash, isOwner);
    const nextSection = sectionFromHash(location.hash, nextPanel, isOwner);
    setPanel(nextPanel);
    setActiveSection(nextSection);
  }, [location.hash, isOwner]);

  function writeHash(sectionId) {
    if (window.location.hash !== `#${sectionId}`) {
      window.history.replaceState(null, "", `#${sectionId}`);
    }
  }

  function selectPanel(nextPanel) {
    if (nextPanel === "owner" && !isOwner) return;
    const fallback = nextPanel === "owner" ? "metrics" : "overview";
    const keep =
      SECTION_VIEWS.find((view) => view.id === activeSection && view.panel === nextPanel)?.id ||
      fallback;
    setPanel(nextPanel);
    setActiveSection(keep);
    writeHash(keep);
  }

  useEffect(() => {
    function onSelect(id) {
      const allowed = sectionsForPanel(panel);
      if (!allowed.includes(id)) return;
      setActiveSection(id);
      writeHash(id);
    }

    setRail(
      <AdminNav panel={panel} activeSection={activeSection} onSelect={onSelect} />,
    );
    return () => setRail(null);
  }, [panel, activeSection, setRail]);

  const visibleViews = useMemo(
    () => SECTION_VIEWS.filter((view) => view.panel === panel && (view.panel !== "owner" || isOwner)),
    [panel, isOwner],
  );

  const activeIndex = Math.max(
    0,
    visibleViews.findIndex((view) => view.id === activeSection),
  );

  function onPlaceholder(label) {
    showToast(`${label} — coming soon`);
  }

  const content = (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" data-hub-fill>
      <div className="mb-3 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="m-0 text-[clamp(1.35rem,2vw,1.75rem)] font-medium tracking-wide text-white">
            Website Admin
          </h1>
          <p className="m-0 mt-1 text-[0.8rem] font-light tracking-wide text-white/45">
            {isOwner ? "Admin and owner controls" : "Comp Admin controls"}
          </p>
        </div>
        <PanelToggle panel={panel} isOwner={isOwner} onChange={selectPanel} />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {visibleViews.map((view, index) => {
          const offset = index - activeIndex;
          const isActive = offset === 0;
          return (
            <div
              key={view.id}
              className={[
                "absolute inset-0 flex min-h-0 flex-col transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                isActive ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
              style={{ transform: `translateY(${offset * 100}%)` }}
              aria-hidden={!isActive}
            >
              <div className="box-border flex h-full min-h-0 flex-col overflow-hidden">
                {view.render(onPlaceholder)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (hub) {
    return content;
  }

  return <section className="space-y-6">{content}</section>;
}
