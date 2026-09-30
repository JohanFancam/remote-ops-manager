import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, BarChart2, DollarSign, TrendingUp, X,
  Wrench, Settings, LogOut, Bell, AlertTriangle, BookOpen, CheckSquare } from 'lucide-react';
import { useApp } from './AppContext';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Notifications', icon: Bell, path: '/Notifications' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const remoteNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Notifications', icon: Bell, path: '/Notifications' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const standbyNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Notifications', icon: Bell, path: '/Notifications' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const analyticsNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Notifications', icon: Bell, path: '/Notifications' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const viewerNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Notifications', icon: Bell, path: '/Notifications' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const allAdminMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Rigs', icon: Wrench, path: '/Rigs' },
  { label: 'Rig Checks', icon: CheckSquare, path: '/RigChecks' },
  { label: 'Notifications', icon: Bell, path: '/Notifications' },
  { label: 'Reports', icon: BarChart2, path: '/Reports' },
  { label: 'App Faults', icon: AlertTriangle, path: '/AppFaults' },
  { label: 'Pending/Approve', icon: DollarSign, path: '/Accounts' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const allRemoteMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Notifications', icon: Bell, path: '/Notifications' },
  { label: 'App Faults', icon: AlertTriangle, path: '/AppFaults' },
  { label: 'Guide', icon: BookOpen, path: '/OperatorGuide' },
  { label: 'Earnings', icon: TrendingUp, path: '/Earnings' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const allStandbyMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Notifications', icon: Bell, path: '/Notifications' },
  { label: 'App Faults', icon: AlertTriangle, path: '/AppFaults' },
  { label: 'Guide', icon: BookOpen, path: '/OperatorGuide' },
  { label: 'Earnings', icon: TrendingUp, path: '/Earnings' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const accountsNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/AccountsDashboard' },
];

const allAccountsMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/AccountsDashboard' },
  { label: 'App Faults', icon: AlertTriangle, path: '/AppFaults' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const allAnalyticsMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Notifications', icon: Bell, path: '/Notifications' },
  { label: 'Rig Checks', icon: CheckSquare, path: '/RigChecks' },
  { label: 'App Faults', icon: AlertTriangle, path: '/AppFaults' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const allViewerMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Notifications', icon: Bell, path: '/Notifications' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const { isAdmin, isStandby, isAccounts, isAnalytics, isViewer, isLoading, user } = useApp();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (isLoading) return null;

  const navItems = isAdmin ? adminNavItems
    : isAccounts ? accountsNavItems
    : isAnalytics ? analyticsNavItems
    : isViewer ? viewerNavItems
    : isStandby ? standbyNavItems
    : remoteNavItems;
  const allMenuItems = isAdmin ? allAdminMenuItems
    : isAccounts ? allAccountsMenuItems
    : isAnalytics ? allAnalyticsMenuItems
    : isViewer ? allViewerMenuItems
    : isStandby ? allStandbyMenuItems
    : allRemoteMenuItems;

  // Split nav items: first half before center, second half after
  const half = Math.ceil(navItems.length / 2);
  const leftItems = navItems.slice(0, half);
  const rightItems = navItems.slice(half);

  return (
    <>
      {/* Full Menu Drawer */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[90] bg-[#080e1d] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center justify-end px-4 py-3 border-b border-[color:var(--rom-line)]">
            <button onClick={() => setMenuOpen(false)} className="text-slate-400 hover:text-slate-100 p-2">
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {allMenuItems.map(item => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    'rom-nav-item gap-3 px-4 py-3',
                    isActive ? 'rom-nav-item-active' : 'rom-nav-item-idle'
                  )}
                >
                  <item.icon className={cn('h-5 w-5', isActive && 'text-blue-300')} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-[color:var(--rom-line)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-700/40 text-blue-100 flex items-center justify-center text-sm font-semibold ring-1 ring-blue-400/20">
                {user?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{user?.full_name || 'User'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => logout(true)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-white/5 w-full"
            >
              <LogOut className="h-5 w-5" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[80] border-t border-[color:var(--rom-line)] bg-[#080e1d]/95 backdrop-blur-xl flex items-stretch" style={{ height: 'calc(4rem + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {leftItems.map(item => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex-1 flex flex-col items-center justify-center transition-colors select-none',
                isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <item.icon className="h-5 w-5" />
            </Link>
          );
        })}

        {/* Center Grid Menu Button */}
        <button
          onClick={() => setMenuOpen(true)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center transition-colors select-none',
            menuOpen ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
          )}
        >
          <div className="grid grid-cols-3 gap-[3px]">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={cn('w-[5px] h-[5px] rounded-[1px]', menuOpen ? 'bg-blue-600' : 'bg-slate-400')} />
            ))}
          </div>
        </button>

        {rightItems.map(item => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex-1 flex flex-col items-center justify-center transition-colors select-none',
                isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <item.icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>
    </>
  );
}