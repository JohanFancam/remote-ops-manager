import { Navigate, NavLink, Outlet, Routes, Route, useLocation } from 'react-router-dom';
import { useAuth, homePath, can } from './lib/auth.jsx';
import BrandMark, { BrandSubline } from './components/BrandMark.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AccountsPage from './pages/AccountsPage.jsx';
import AccessDenied from './pages/AccessDenied.jsx';
import EarningsPage from './pages/EarningsPage.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="rom-shell flex min-h-dvh items-center justify-center">
        <BrandMark size="loading" className="animate-pulse-soft" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequirePerm({ permission, children }) {
  const { user } = useAuth();
  if (!can(user, permission)) return <AccessDenied />;
  return children;
}

function OpsShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user.role === 'admin';
  const isOperator = user.role === 'operator';

  const nav = [
    { to: '/dashboard', label: 'Dashboard', show: true },
    { to: '/calendar', label: 'Calendar', show: true },
    { to: '/earnings', label: 'Earnings', show: isOperator },
    { to: '/users', label: 'Users', show: isAdmin },
    { to: '/settings', label: 'Settings', show: isAdmin },
    { to: '/accounts', label: 'Accounts', show: isAdmin },
  ].filter((n) => n.show);

  return (
    <div className="rom-shell rom-grain min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="relative z-10 hidden w-[var(--sidebar-w)] shrink-0 flex-col border-r border-ink-700/70 bg-ink-950/60 lg:flex">
        <div className="border-b border-ink-700/60 px-5 py-5">
          <BrandMark size="sm" />
          <BrandSubline className="mt-1" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map((n) => (
            <SideLink key={n.to} to={n.to} label={n.label} />
          ))}
        </nav>
        <div className="border-t border-ink-700/60 p-4">
          <p className="truncate text-xs text-mist-muted">{user.fullName}</p>
          <p className="text-[10px] uppercase tracking-wider text-mist-muted">{user.role}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 touch-target w-full border border-ink-600 px-3 py-2 text-xs text-mist-muted hover:border-blue/40"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Collapsed sidebar for md */}
      <aside className="relative z-10 hidden w-[var(--sidebar-collapsed)] shrink-0 flex-col border-r border-ink-700/70 bg-ink-950/60 md:flex lg:hidden">
        <div className="flex justify-center border-b border-ink-700/60 py-4">
          <BrandMark size="sm" />
        </div>
        <nav className="flex flex-1 flex-col items-center gap-2 p-2">
          {nav.map((n) => (
            <SideLink key={n.to} to={n.to} label={n.label[0]} title={n.label} collapsed />
          ))}
        </nav>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center justify-between gap-3 border-b border-ink-700/50 px-4 py-3 md:px-6"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div>
            {location.pathname !== '/dashboard' && (
              <p className="font-display text-xs font-bold tracking-[0.18em] text-blue-bright">ROM</p>
            )}
            <p className="text-xs text-mist-muted md:hidden">
              {user.fullName} · {user.role}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="touch-target border border-ink-600 px-3 py-2 text-xs uppercase tracking-wider text-mist-muted md:hidden"
          >
            Sign out
          </button>
        </header>

        <main
          className="flex-1 px-4 py-5 md:px-6"
          style={{ paddingBottom: 'calc(5.25rem + var(--safe-bottom))' }}
        >
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-700/80 bg-ink-950/95 backdrop-blur-md md:hidden"
          style={{ paddingBottom: 'var(--safe-bottom)' }}
        >
          <div className="flex justify-around px-1 py-1.5">
            {nav.slice(0, 4).map((n) => (
              <BottomLink key={n.to} to={n.to} label={n.label} />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function AccountsShell() {
  const { user, logout } = useAuth();
  return (
    <div className="rom-shell rom-grain min-h-dvh">
      <header
        className="flex items-center justify-between border-b border-ink-700/50 px-4 py-4"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div>
          <BrandMark size="sm" />
          <BrandSubline className="mt-1" />
        </div>
        <div className="text-right">
          <p className="text-xs text-mist-muted">{user.fullName}</p>
          <div className="mt-1 flex justify-end gap-3">
            {user.role === 'admin' && (
              <a href="/dashboard" className="text-xs text-blue-bright">
                Ops dashboard
              </a>
            )}
            <button type="button" onClick={logout} className="touch-target text-xs text-blue-bright">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6" style={{ paddingBottom: 'calc(4rem + var(--safe-bottom))' }}>
        <Outlet />
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 border-t border-ink-700/80 bg-ink-950/95 md:hidden"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="flex justify-center py-2">
          <BottomLink to="/accounts" label="Accounts" />
        </div>
      </nav>
    </div>
  );
}

function SideLink({ to, label, title, collapsed }) {
  return (
    <NavLink
      to={to}
      title={title || label}
      className={({ isActive }) =>
        `rounded-sm px-3 py-2.5 font-display text-sm font-semibold transition ${
          collapsed ? 'w-12 text-center' : ''
        } ${isActive ? 'bg-blue text-white' : 'text-mist-muted hover:bg-ink-800 hover:text-mist'}`
      }
    >
      {label}
    </NavLink>
  );
}

function BottomLink({ to, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/dashboard' || to === '/accounts'}
      className={({ isActive }) =>
        `touch-target flex-1 rounded-sm px-2 py-3 text-center font-display text-xs font-semibold ${
          isActive ? 'bg-blue text-white' : 'text-mist-muted'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePath(user)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/access-denied" element={<AccessDenied />} />
      <Route path="/" element={<RootRedirect />} />

      <Route
        element={
          <RequireAuth>
            <RequirePerm permission="dashboard:ops">
              <OpsShell />
            </RequirePerm>
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route
          path="/earnings"
          element={
            <RequirePerm permission="pay:view_own">
              <EarningsPage />
            </RequirePerm>
          }
        />
        <Route
          path="/users"
          element={
            <RequirePerm permission="user:manage">
              <UsersPage />
            </RequirePerm>
          }
        />
        <Route
          path="/settings"
          element={
            <RequirePerm permission="settings:manage">
              <SettingsPage />
            </RequirePerm>
          }
        />
      </Route>

      {/* Admin can also open accounts via ops shell link → separate guard */}
      <Route
        element={
          <RequireAuth>
            <RequirePerm permission="dashboard:accounts">
              <AccountsShell />
            </RequirePerm>
          </RequireAuth>
        }
      >
        <Route path="/accounts" element={<AccountsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
