import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { CalendarPage } from "../features/calendar/CalendarPage.jsx";
import { TeamPage } from "../features/team/TeamPage.jsx";
import { ManagementPage } from "../features/management/ManagementPage.jsx";
import { StratsPage } from "../features/strats/browser/StratsPage.jsx";
import { StratEditorPage } from "../features/strats/editor/StratEditorPage.jsx";
import { StratmakerPage } from "../features/strats/editor/StratmakerPage.jsx";
import { MicroPrepEntryPage } from "../features/micro-prep/MicroPrepEntryPage.jsx";
import { MicroPrepPage } from "../features/micro-prep/MicroPrepPage.jsx";
import { useAuth } from "../features/auth/AuthGate.jsx";
import { HubLayout } from "../features/home/HubLayout.jsx";
import { HomePage } from "../features/home/HomePage.jsx";
import { canViewTeam } from "../lib/roles.js";

/** Full-bleed shell for map editor / whiteboard. */
function EditorShell() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0f0f0f] text-text">
      <div className="absolute inset-0">
        <Outlet />
      </div>
    </div>
  );
}

function StaffGate({ title, children }) {
  const user = useAuth();

  if (!canViewTeam(user.role)) {
    return (
      <section className="min-h-0 flex-1 overflow-auto">
        <h1 className="m-0 text-[clamp(1.55rem,2.2vw,2rem)] font-medium tracking-wide text-white">
          {title}
        </h1>
        <p className="m-0 max-w-xl text-[0.88rem] font-light tracking-wide text-white/50">
          Comp Admins only.
        </p>
      </section>
    );
  }

  return children;
}

function StaffOnlyTeamPage({ hub = false }) {
  return (
    <StaffGate title="Admin Panel">
      <TeamPage hub={hub} />
    </StaffGate>
  );
}

function StaffOnlyManagementPage() {
  return (
    <StaffGate title="Management">
      <ManagementPage />
    </StaffGate>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<HubLayout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="dashboard" element={<Navigate to="/home" replace />} />
          <Route path="calendar" element={<CalendarPage hub />} />
          <Route path="team" element={<StaffOnlyTeamPage hub />} />
          <Route path="management" element={<StaffOnlyManagementPage />} />
          <Route path="strats" element={<StratsPage hub />} />
        </Route>
        <Route element={<EditorShell />}>
          <Route path="tool/stratmaker" element={<StratmakerPage />} />
          <Route path="strats/:id" element={<StratEditorPage />} />
          <Route path="tool/micro-prep" element={<MicroPrepEntryPage />} />
          <Route path="micro-prep/:id" element={<MicroPrepPage />} />
        </Route>
        <Route path="micro-prep" element={<Navigate to="/tool/micro-prep" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
