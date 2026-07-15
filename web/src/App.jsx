import { Navigate, NavLink, Outlet, useLocation, Routes, Route } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import Today from './pages/Today.jsx';
import Board from './pages/Board.jsx';
import Pay from './pages/Pay.jsx';
import BrandMark from './components/BrandMark.jsx';

function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const showPay = user.role !== 'standby';

  return (
    <div className="rom-atmosphere rom-grain min-h-dvh">
      <div
        className="rom-content mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6"
        style={{ paddingBottom: 'calc(5.5rem + var(--safe-bottom))' }}
      >
        <header className="mb-5 flex items-center justify-between gap-3 md:mb-6">
          <div className="min-w-0">
            {location.pathname !== '/' && <BrandMark size="sm" />}
            <p className="truncate text-xs text-mist-muted">
              {user.fullName} · {user.role}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="touch-target rounded-sm border border-ink-600 px-3 py-2 text-xs uppercase tracking-wider text-mist-muted transition hover:border-lime/40 hover:text-mist"
          >
            Sign out
          </button>
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-700/80 bg-ink-950/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="mx-auto flex max-w-6xl items-stretch justify-around px-1 py-1.5">
          <Tab to="/" label="Today" />
          <Tab to="/board" label="Board" />
          {showPay && <Tab to="/pay" label="Pay" />}
        </div>
      </nav>

      {/* Desktop nav */}
      <nav className="rom-content mx-auto hidden max-w-6xl px-6 pb-8 md:block">
        <div className="flex gap-2 border-t border-ink-700/60 pt-6">
          <Tab to="/" label="Today" />
          <Tab to="/board" label="Board" />
          {showPay && <Tab to="/pay" label="Pay" />}
        </div>
      </nav>
    </div>
  );
}

function Tab({ to, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `touch-target flex flex-1 items-center justify-center rounded-sm px-4 py-3 text-center font-display text-sm font-semibold tracking-wide transition md:flex-none ${
          isActive
            ? 'bg-lime text-ink-950'
            : 'text-mist-muted hover:bg-ink-800 hover:text-mist active:bg-ink-800'
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
      <div className="rom-atmosphere flex min-h-dvh items-center justify-center">
        <BrandMark size="loading" className="animate-pulse-glow" />
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
