import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { CalendarPage } from "../features/calendar/CalendarPage.jsx";
import { TeamPage } from "../features/team/TeamPage.jsx";
import { ManagementPage } from "../features/management/ManagementPage.jsx";
import { StratsPage } from "../features/strats/browser/StratsPage.jsx";
import { StratEditorPage } from "../features/strats/editor/StratEditorPage.jsx";
import { StratmakerPage } from "../features/strats/editor/StratmakerPage.jsx";
import { MicroPrepPage } from "../features/micro-prep/MicroPrepPage.jsx";
import { useAuth } from "../features/auth/AuthGate.jsx";
import { UserMenu } from "../features/auth/UserMenu.jsx";
import { HubLayout } from "../features/home/HubLayout.jsx";
import { HomePage } from "../features/home/HomePage.jsx";

const NAV = [
  { to: "/home", label: "Home" },
  { to: "/calendar", label: "Calendar" },
  { to: "/team", label: "Team" },
  { to: "/strats", label: "Strats" },
  { to: "/micro-prep", label: "Micro-prep" },
];

function canViewTeam(role) {
  return role === "admin" || role === "owner";
}

function AppShell() {
  const user = useAuth();
  const nav = NAV.filter((item) => item.to !== "/team" || canViewTeam(user.role));

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4">
          <span className="text-lg font-medium tracking-[0.18em]">TACTIKA</span>
          <nav className="flex flex-wrap gap-3 text-sm">
            {nav.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? "text-accent" : "text-muted transition hover:text-text"
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

/** Full-bleed shell for map editor (no max-width main). */
function EditorShell() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0f0f0f] text-text">
      <div className="absolute inset-0">
        <Outlet />
      </div>
    </div>
  );
}

function StaffGate({ hub = false, title, children }) {
  const user = useAuth();

  if (!canViewTeam(user.role)) {
    return (
      <section className={hub ? "hub-admin-shell" : undefined}>
        <h1 className="dashboard-page__greeting">{title}</h1>
        <p className="dashboard-page__tagline">Comp Admins only.</p>
      </section>
    );
  }

  return children;
}

function StaffOnlyTeamPage({ hub = false }) {
  return (
    <StaffGate hub={hub} title="Admin Panel">
      <TeamPage hub={hub} />
    </StaffGate>
  );
}

function StaffOnlyManagementPage() {
  return (
    <StaffGate hub title="Management">
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
        </Route>
        <Route element={<AppShell />}>
          <Route path="micro-prep" element={<MicroPrepPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
