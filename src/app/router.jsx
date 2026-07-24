import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { MatchBriefPage } from "../features/events/MatchBriefPage.jsx";
import { LineUpPage } from "../features/lineup/LineUpPage.jsx";
import { RecordsPage } from "../features/records/MatchHistoryPanel.jsx";
import { CalendarPage } from "../features/calendar/CalendarPage.jsx";
import { TeamPage } from "../features/team/TeamPage.jsx";
import { ManagementPage } from "../features/management/ManagementPage.jsx";
import { StratsPage } from "../features/strats/browser/StratsPage.jsx";
import { StratEditorPage } from "../features/strats/editor/StratEditorPage.jsx";
import { StratmakerPage } from "../features/strats/editor/StratmakerPage.jsx";
import { RouteplannerEntryPage } from "../features/routeplanner/RouteplannerEntryPage.jsx";
import { RouteplannerPage } from "../features/routeplanner/RouteplannerPage.jsx";
import { MicroPrepEntryPage } from "../features/micro-prep/MicroPrepEntryPage.jsx";
import { MicroPrepPage } from "../features/micro-prep/MicroPrepPage.jsx";
import { useAuth } from "../features/auth/AuthGate.jsx";
import { HubLayout } from "../features/home/HubLayout.jsx";
import { HomePage } from "../features/home/HomePage.jsx";
import { NotFoundPage } from "../features/home/NotFoundPage.jsx";
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
    <StaffGate title="Website Admin">
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

function ManagementLegacyRedirect() {
  const { hash } = useLocation();
  return <Navigate to={`/management${hash || ""}`} replace />;
}

function RouteplannerEditorRoute() {
  const { id } = useParams();
  return <RouteplannerPage planId={id} />;
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
          <Route path="records" element={<RecordsPage />} />
          <Route path="events/:eventId" element={<MatchBriefPage />} />
          <Route path="lineups/:id" element={<LineUpPage />} />
          <Route path="team" element={<StaffOnlyTeamPage hub />} />
          <Route path="management" element={<StaffOnlyManagementPage />} />
          <Route path="home/management" element={<ManagementLegacyRedirect />} />
          <Route path="strats" element={<StratsPage hub />} />
        </Route>
        <Route element={<EditorShell />}>
          <Route path="tool/stratmaker" element={<StratmakerPage />} />
          <Route path="strats/:id" element={<StratEditorPage />} />
          <Route path="tool/routeplanner" element={<RouteplannerEntryPage />} />
          <Route path="routeplanner/:id" element={<RouteplannerEditorRoute />} />
          <Route path="tool/micro-prep" element={<MicroPrepEntryPage />} />
          <Route path="micro-prep/:id" element={<MicroPrepPage />} />
        </Route>
        <Route path="micro-prep" element={<Navigate to="/tool/micro-prep" replace />} />
        <Route element={<HubLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
