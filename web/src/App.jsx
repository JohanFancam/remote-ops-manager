import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import Today from './pages/Today.jsx';
import Board from './pages/Board.jsx';
import Pay from './pages/Pay.jsx';
import { Routes, Route } from 'react-router-dom';

function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const showPay = user.role !== 'standby';

  return (
    <div className="cue-atmosphere cue-grain min-h-screen">
      <div className="cue-content mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-24 pt-4 md:px-6 md:pb-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {location.pathname !== '/' && (
              <p className="font-display text-sm font-bold tracking-[0.18em] text-lime">
                CUEBOARD
              </p>
            )}
            <p className="truncate text-xs text-mist-muted">
              {user.fullName} · {user.role}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-sm border border-ink-600 px-3 py-1.5 text-xs uppercase tracking-wider text-mist-muted transition hover:border-lime/40 hover:text-mist"
          >
            Sign out
          </button>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-700/80 bg-ink-950/90 backdrop-blur-md md:static md:mt-8 md:border-0 md:bg-transparent md:backdrop-blur-none">
          <div className="mx-auto flex max-w-6xl items-stretch justify-around px-2 py-2 md:justify-start md:gap-2 md:px-0">
            <Tab to="/" label="Today" />
            <Tab to="/board" label="Board" />
            {showPay && <Tab to="/pay" label="Pay" />}
          </div>
        </nav>
      </div>
    </div>
  );
}

function Tab({ to, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex-1 rounded-sm px-4 py-3 text-center font-display text-sm font-semibold tracking-wide transition md:flex-none ${
          isActive
            ? 'bg-lime text-ink-950'
            : 'text-mist-muted hover:bg-ink-800 hover:text-mist'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="cue-atmosphere flex min-h-screen items-center justify-center">
        <p className="animate-pulse-glow font-display text-lime tracking-[0.2em]">CUEBOARD</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Today />} />
        <Route path="/board" element={<Board />} />
        <Route path="/pay" element={<Pay />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
