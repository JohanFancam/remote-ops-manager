import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, CheckSquare, Settings2, SunMedium } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/', label: 'Today', icon: SunMedium, end: true },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/settings', label: 'Settings', icon: Settings2 },
]

export default function AppShell() {
  const location = useLocation()

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 safe-pt">
      <header className="flex items-end justify-between pb-2 pt-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-sea">
            Personal OS
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            The Assistant
          </h1>
        </div>
        <div
          className="mb-1 h-10 w-10 rounded-2xl bg-ink shadow-lg shadow-ink/20"
          aria-hidden
        >
          <div className="flex h-full w-full items-center justify-center">
            <span className="h-2.5 w-2.5 rounded-full bg-sun animate-soft-pulse" />
          </div>
        </div>
      </header>

      <main className="relative flex-1 overflow-x-hidden pb-28 pt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 safe-pb">
        <div className="mx-auto max-w-lg px-4 pb-3">
          <div className="flex items-center justify-between rounded-2xl border border-white/50 bg-paper/90 px-2 py-2 shadow-xl shadow-ink/10 backdrop-blur-md">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-w-[4.25rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[0.7rem] font-semibold transition-colors',
                    isActive ? 'bg-ink text-paper' : 'text-ink/55 hover:text-ink'
                  )
                }
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}
