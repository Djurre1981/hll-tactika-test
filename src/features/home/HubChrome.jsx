import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useHub } from "./HubContext.jsx";

const HUB_TABS = [
  { id: "home", label: "Dashboard", to: "/home" },
  { id: "strats", label: "My Strats", to: "/strats" },
  { id: "management", label: "Management", to: "/management" },
  { id: "calendar", label: "Calendar", to: "/calendar" },
];

function activeTab(pathname) {
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/management")) return "management";
  if (pathname.startsWith("/strats")) return "strats";
  return "home";
}

export function HubChrome() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useHub();
  const current = activeTab(location.pathname);
  const [peekIndex, setPeekIndex] = useState(null);
  const peekTimerRef = useRef(null);
  const hubIndex = peekIndex ?? HUB_TABS.findIndex((tab) => tab.id === current);

  useEffect(
    () => () => {
      if (peekTimerRef.current) {
        window.clearTimeout(peekTimerRef.current);
      }
    },
    [],
  );

  function handleTabClick(tab) {
    if (tab.placeholder) {
      const index = HUB_TABS.findIndex((item) => item.id === tab.id);
      if (peekTimerRef.current) {
        window.clearTimeout(peekTimerRef.current);
      }
      setPeekIndex(index);
      showToast("Coming soon");
      peekTimerRef.current = window.setTimeout(() => {
        setPeekIndex(null);
        peekTimerRef.current = null;
      }, 480);
      return;
    }
    if (tab.to) {
      navigate(tab.to);
    }
  }

  return (
    <div className="hub-chrome">
      <Link className="hub-chrome__logo" to="/home" aria-label="Tactika home">
        <img src="/assets/logos/tactika-rectangle-logo.svg" alt="" width={44} height={44} />
      </Link>
      <nav
        className="hub-nav mode-switch"
        data-hub-index={hubIndex}
        aria-label="Hub navigation"
      >
        <div className="mode-switch__surface glass-surface hub-nav__surface" role="tablist">
          {HUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="mode-switch__tab"
              role="tab"
              data-hub={tab.id}
              aria-selected={current === tab.id}
              onClick={() => handleTabClick(tab)}
            >
              {tab.label}
            </button>
          ))}
          <span className="mode-switch__thumb hub-nav__thumb" aria-hidden="true" />
        </div>
      </nav>
    </div>
  );
}
