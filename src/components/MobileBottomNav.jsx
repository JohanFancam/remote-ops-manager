import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, BarChart2, DollarSign, TrendingUp, Wifi, X,
  Wrench, Settings, Receipt, LogOut } from 'lucide-react';
import { useApp } from './AppContext';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

const adminNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Reports', icon: BarChart2, path: '/Reports' },
  { label: 'Pending/Approve', icon: DollarSign, path: '/Accounts' },
];

const remoteNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Earnings', icon: TrendingUp, path: '/Earnings' },
];

const standbyNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
];

const allAdminMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Rigs', icon: Wrench, path: '/Rigs' },
  { label: 'Reports', icon: BarChart2, path: '/Reports' },
  { label: 'Pending/Approve', icon: DollarSign, path: '/Accounts' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const allRemoteMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Earnings', icon: TrendingUp, path: '/Earnings' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const allStandbyMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const { isAdmin, isStandby, isLoading, user } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  if (isLoading) return null;

  const navItems = isAdmin ? adminNavItems : isStandby ? standbyNavItems : remoteNavItems;
  const allMenuItems = isAdmin ? allAdminMenuItems : isStandby ? allStandbyMenuItems : allRemoteMenuItems;

  // Split nav items: first half before center, second half after
  const half = Math.ceil(navItems.length / 2);
  const leftItems = navItems.slice(0, half);
  const rightItems = navItems.slice(half);

  return (
    <>
      {/* Full Menu Drawer */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-gray-900 flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center justify-end px-4 py-3 border-b border-gray-800">
            <button onClick={() => setMenuOpen(false)} className="text-gray-400 hover:text-white p-2">
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
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-white">
                {user?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.full_name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => base44.auth.logout()}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-gray-800 w-full"
            >
              <LogOut className="h-5 w-5" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 flex items-stretch" style={{ height: 'calc(4rem + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {leftItems.map(item => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex-1 flex flex-col items-center justify-center transition-colors select-none',
                isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
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
            menuOpen ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
          )}
        >
          <div className="grid grid-cols-3 gap-[3px]">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={cn('w-[5px] h-[5px] rounded-[1px]', menuOpen ? 'bg-blue-400' : 'bg-gray-500')} />
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
                isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
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