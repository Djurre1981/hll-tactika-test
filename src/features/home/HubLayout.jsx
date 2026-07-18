import { Outlet } from "react-router-dom";
import { HubChrome } from "./HubChrome.jsx";
import { HubProvider, HubToast, useHub } from "./HubContext.jsx";
import { HubUserMenu } from "./HubUserMenu.jsx";

function HubMain() {
  const { rail } = useHub();

  return (
    <div
      className="relative z-[1] mx-auto flex h-[min(82vh,870px)] w-[min(1520px,94vw)] max-w-full flex-col items-center gap-3 md:block"
    >
      {rail ? (
        <aside className="relative z-[2] shrink-0 md:absolute md:right-full md:top-1/2 md:mr-4 md:-translate-y-1/2">
          {rail}
        </aside>
      ) : null}
      <div className="glass-panel flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(22,22,26,0.42)] px-7 py-6 shadow-glass animate-[hub-shell-enter_0.65s_cubic-bezier(0.22,1,0.36,1)_both]">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
        <HubToast />
      </div>
    </div>
  );
}

export function HubLayout() {
  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center overflow-auto px-[max(2vw,4.25rem)] pb-6 pt-[5.25rem]"
      aria-label="Hub"
    >
      <div className="hub-page-bg pointer-events-none fixed inset-0 -z-[1] overflow-hidden bg-[#0a0a0c]" aria-hidden="true" />
      <HubProvider>
        <HubChrome />
        <HubUserMenu />
        <HubMain />
      </HubProvider>
    </div>
  );
}
