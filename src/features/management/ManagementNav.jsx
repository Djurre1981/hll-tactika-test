const NAV_ITEMS = [
  { id: "roster", label: "Roster", icon: "people" },
  { id: "folders", label: "Folders", icon: "folders" },
  { id: "analytics", label: "Analytics", icon: "chart", placeholder: true },
  { id: "schedule", label: "Schedule", icon: "timer", placeholder: true },
  { id: "settings", label: "Settings", icon: "settings", placeholder: true },
];

export const MANAGEMENT_SECTIONS = NAV_ITEMS.filter((item) => !item.placeholder);

function NavIcon({ name }) {
  const svgClass = "h-[1.1rem] w-[1.1rem]";
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

  if (name === "folders") {
    return (
      <svg className={svgClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 8.5A2.5 2.5 0 0 1 6.5 6H10l1.5 1.8H17.5A2.5 2.5 0 0 1 20 10.3v5.2A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-7Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

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

  if (name === "timer") {
    return (
      <svg className={svgClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="13" r="7" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 13V9.5M10 4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={svgClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 4.5v1.6M12 17.9v1.6M4.5 12h1.6M17.9 12h1.6M6.4 6.4l1.1 1.1M16.5 16.5l1.1 1.1M17.6 6.4l-1.1 1.1M7.5 16.5l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ManagementNav({ activeSection, onSelect, onPlaceholder }) {
  return (
    <nav
      className="flex flex-row items-center justify-center gap-1.5 rounded-full border border-white/12 bg-[rgba(20,22,26,0.72)] px-1.5 py-1 shadow-glass backdrop-blur-[18px] backdrop-saturate-150 md:flex-col md:px-1.5 md:py-2"
      aria-label="Management sections"
    >
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={[
            "grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-white/70 transition hover:bg-white/[0.08] hover:text-white",
            activeSection === item.id ? "bg-white/15 text-white" : "",
            item.placeholder ? "opacity-55" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={item.label}
          aria-current={activeSection === item.id ? "page" : undefined}
          onClick={() => {
            if (item.placeholder) {
              onPlaceholder?.(item.label);
              return;
            }
            onSelect(item.id);
          }}
        >
          <NavIcon name={item.icon} />
        </button>
      ))}
    </nav>
  );
}
