import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { DashboardPage } from "../features/dashboard/DashboardPage.jsx";
import { CalendarPage } from "../features/calendar/CalendarPage.jsx";
import { TeamPage } from "../features/team/TeamPage.jsx";
import { StratsPage } from "../features/strats/browser/StratsPage.jsx";
import { StratEditorPage } from "../features/strats/editor/StratEditorPage.jsx";
import { MicroPrepPage } from "../features/micro-prep/MicroPrepPage.jsx";
import { useAuth } from "../features/auth/AuthGate.jsx";
import { UserMenu } from "../features/auth/UserMenu.jsx";
import dashboardBg from "../../assets/dashboard-bg.jpg";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/calendar", label: "Calendar" },
  { to: "/team", label: "Team" },
  { to: "/strats", label: "Strats" },
  { to: "/strats/demo", label: "Strat editor" },
  { to: "/micro-prep", label: "Micro-prep" },
];

function canViewTeam(role) {
  return role === "admin" || role === "owner";
}

function AppShell() {
  const user = useAuth();
  const location = useLocation();
  const nav = NAV.filter((item) => item.to !== "/team" || canViewTeam(user.role));
  const isHubRoute = location.pathname === "/dashboard" || location.pathname === "/calendar";

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-text">
      {isHubRoute ? (
        <div className="fixed inset-0 -z-10 bg-bg" aria-hidden="true">
          <div
            className="absolute inset-[-16px] scale-[1.03] bg-cover bg-center opacity-75 blur-sm saturate-100"
            style={{ backgroundImage: `url(${dashboardBg})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-bg/70 to-black/85" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(196,163,90,0.18),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(57,255,20,0.08),transparent_22%)]" />
        </div>
      ) : null}
      <header className={isHubRoute ? "px-4 pt-4" : "border-b border-border bg-surface px-4 py-3"}>
        <div
          className={
            isHubRoute
              ? "glass-panel mx-auto flex max-w-6xl flex-wrap items-center gap-4 rounded-full px-5 py-3"
              : "mx-auto flex max-w-5xl flex-wrap items-center gap-4"
          }
        >
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
      <main className={isHubRoute ? "mx-auto max-w-6xl px-4 py-8" : "mx-auto max-w-5xl px-4 py-8"}>
        <Outlet />
      </main>
    </div>
  );
}

function StaffOnlyTeamPage() {
  const user = useAuth();

  if (!canViewTeam(user.role)) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-2 text-muted">Comp Admins only.</p>
      </section>
    );
  }

  return <TeamPage />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="team" element={<StaffOnlyTeamPage />} />
          <Route path="strats" element={<StratsPage />} />
          <Route path="strats/:id" element={<StratEditorPage />} />
          <Route path="micro-prep" element={<MicroPrepPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
