import { BrowserRouter, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { DashboardPage } from "../features/dashboard/DashboardPage.jsx";
import { CalendarPage } from "../features/calendar/CalendarPage.jsx";
import { TeamPage } from "../features/team/TeamPage.jsx";
import { StratsPage } from "../features/strats/browser/StratsPage.jsx";
import { StratEditorPage } from "../features/strats/editor/StratEditorPage.jsx";
import { MicroPrepPage } from "../features/micro-prep/MicroPrepPage.jsx";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/calendar", label: "Calendar" },
  { to: "/team", label: "Team" },
  { to: "/strats", label: "Strats" },
  { to: "/strats/demo", label: "Strat editor" },
  { to: "/micro-prep", label: "Micro-prep" },
];

function AppShell() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4">
          <span className="text-lg font-semibold tracking-wide">Tactika</span>
          <nav className="flex flex-wrap gap-3 text-sm">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? "text-accent" : "text-muted hover:text-text"
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function HomePage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Tactika v2</h1>
      <p className="mt-2 text-muted">Phase 1 placeholder — React shell is live.</p>
    </section>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="strats" element={<StratsPage />} />
          <Route path="strats/:id" element={<StratEditorPage />} />
          <Route path="micro-prep" element={<MicroPrepPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
