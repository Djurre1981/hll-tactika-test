const ADMIN_NAV = [
  { id: "overview", label: "Overview", icon: "chart" },
  { id: "members", label: "Members", icon: "people" },
  { id: "feedback", label: "Feedback", icon: "feedback" },
];

const OWNER_NAV = [
  { id: "metrics", label: "Metrics", icon: "pulse" },
  { id: "tools", label: "Tools", icon: "tools" },
];

export function navItemsForPanel(panel) {
  return panel === "owner" ? OWNER_NAV : ADMIN_NAV;
}

export function sectionsForPanel(panel) {
  return navItemsForPanel(panel).map((item) => item.id);
}

function NavIcon({ name }) {
  const svgClass = "h-[1.1rem] w-[1.1rem]";

  if (name === "chart") {
    return (
      <svg className={svgClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 19h16M7 16V10M12 16V6M17 16v-3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === "people") {
    return (
      <svg className={svgClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M15.2 14.2c1.7.4 3.2 1.6 3.8 4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (name === "feedback") {
    return (
      <svg className={svgClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H12l-4 3.5V15H7.5A2.5 2.5 0 0 1 5 12.5v-6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "pulse") {
    return (
      <svg className={svgClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 12h4l2-5 3 10 2-5h7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg className={svgClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.5 4.5 19.5 9.5M5 14.5l4.2-.8 8.3-8.3a1.8 1.8 0 0 1 2.5 2.5L11.7 16.3 5 14.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 19.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function AdminNav({ panel, activeSection, onSelect }) {
  const items = navItemsForPanel(panel);

  return (
    <nav
      className="flex flex-row items-center justify-center gap-1.5 rounded-full border border-white/10 bg-[rgba(20,22,26,0.72)] px-1.5 py-1 shadow-glass backdrop-blur-[18px] backdrop-saturate-150 md:flex-col md:px-1.5 md:py-2"
      aria-label={panel === "owner" ? "Owner panel sections" : "Admin panel sections"}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={[
            "grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-white/70 transition hover:bg-white/[0.08] hover:text-white",
            activeSection === item.id ? "bg-white/15 text-white" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={item.label}
          aria-current={activeSection === item.id ? "page" : undefined}
          onClick={() => onSelect(item.id)}
        >
          <NavIcon name={item.icon} />
        </button>
      ))}
    </nav>
  );
}
