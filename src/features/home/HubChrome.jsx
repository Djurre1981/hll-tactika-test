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
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40">
      <Link
        className="pointer-events-auto fixed left-6 top-[calc(1.5rem+1.25rem)] z-40 block -translate-y-1/2 animate-[hub-chrome-enter_0.6s_cubic-bezier(0.22,1,0.36,1)_both] hover:opacity-90"
        to="/home"
        aria-label="Tactika home"
      >
        <img
          src="/assets/logos/tactika-rectangle-logo.svg"
          alt=""
          width={40}
          height={40}
          className="block h-10 w-10 object-contain"
        />
      </Link>
      <nav
        className="hub-nav pointer-events-auto fixed left-1/2 top-6 z-40 min-w-[28rem] -translate-x-1/2 animate-[hub-chrome-enter_0.6s_cubic-bezier(0.22,1,0.36,1)_0.05s_both]"
        data-hub-index={hubIndex}
        aria-label="Hub navigation"
      >
        <div
          className="relative grid grid-cols-4 gap-0 rounded-full border border-white/10 bg-white/[0.065] p-0.5 shadow-glass backdrop-blur-xl"
          role="tablist"
        >
          {HUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="relative z-[1] cursor-pointer whitespace-nowrap rounded-full border-0 bg-transparent px-4 py-2 text-[0.72rem] font-light uppercase tracking-[0.14em] text-white/55 transition-colors hover:text-white/80 aria-selected:text-white"
              role="tab"
              data-hub={tab.id}
              aria-selected={current === tab.id}
              onClick={() => handleTabClick(tab)}
            >
              {tab.label}
            </button>
          ))}
          <span
            className="hub-nav-thumb pointer-events-none absolute left-0.5 top-0.5 h-[calc(100%-0.25rem)] rounded-full border border-white/15 bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            aria-hidden="true"
          />
        </div>
      </nav>
    </div>
  );
}
