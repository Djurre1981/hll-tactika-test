import { Outlet } from "react-router-dom";
import "../../styles/home.css";
import { HubChrome } from "./HubChrome.jsx";
import { HubProvider, HubToast, useHub } from "./HubContext.jsx";
import { LegacyUserMenu } from "./LegacyUserMenu.jsx";

function HubMain() {
  const { rail } = useHub();

  return (
    <div className={`dashboard-page__main${rail ? " has-rail" : ""}`}>
      {rail ? <aside className="dashboard-page__rail">{rail}</aside> : null}
      <div className="dashboard-page__shell glass-panel">
        <Outlet />
        <HubToast />
      </div>
    </div>
  );
}

export function HubLayout() {
  return (
    <div className="dashboard-page" aria-label="Hub">
      <div className="dashboard-page__bg" aria-hidden="true" />
      <HubProvider>
        <HubChrome />
        <LegacyUserMenu />
        <HubMain />
      </HubProvider>
    </div>
  );
}
