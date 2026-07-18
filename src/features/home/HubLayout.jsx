import { Outlet } from "react-router-dom";
import { HubChrome } from "./HubChrome.jsx";
import { HubProvider, HubToast, useHub } from "./HubContext.jsx";
import { HubUserMenu } from "./HubUserMenu.jsx";

function HubMain() {
  const { rail } = useHub();

  return (
    <div
      className={`relative z-[1] flex w-[min(calc(1520px+5.5rem),98vw)] max-w-full items-center justify-center gap-4 ${
        rail ? "h-[min(82vh,870px)] items-stretch" : ""
      }`}
    >
      {rail ? (
        <aside className="relative z-[2] flex shrink-0 items-center self-center">{rail}</aside>
      ) : null}
      <div
        className={`glass-panel flex min-h-[min(82vh,870px)] w-[min(1520px,94vw)] flex-col gap-4 rounded-[2rem] border border-white/10 bg-[rgba(22,22,26,0.42)] px-7 py-6 shadow-glass animate-[hub-shell-enter_0.65s_cubic-bezier(0.22,1,0.36,1)_both] ${
          rail ? "m-0 h-full min-h-0 min-w-0 flex-1" : "mx-auto"
        }`}
      >
        <Outlet />
        <HubToast />
      </div>
    </div>
  );
}

export function HubLayout() {
  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center overflow-auto px-[2vw] pb-6 pt-[5.25rem]"
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
