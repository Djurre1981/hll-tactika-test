import { Outlet } from "react-router-dom";
import "../../styles/home.css";
import { HubChrome } from "./HubChrome.jsx";
import { HubProvider, HubToast } from "./HubContext.jsx";
import { LegacyUserMenu } from "./LegacyUserMenu.jsx";

export function HubLayout() {
  return (
    <div className="dashboard-page" aria-label="Hub">
      <div className="dashboard-page__bg" aria-hidden="true" />
      <HubProvider>
        <HubChrome />
        <LegacyUserMenu />
        <div className="dashboard-page__shell glass-panel">
          <Outlet />
          <HubToast />
        </div>
      </HubProvider>
    </div>
  );
}
