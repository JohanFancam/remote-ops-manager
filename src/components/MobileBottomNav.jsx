import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, BarChart2, DollarSign, TrendingUp, Wifi, X,
  Clock, Wrench, Settings, BookOpen, FlaskConical, Receipt, LogOut } from 'lucide-react';
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
  { label: 'Shoot Duration', icon: Clock, path: '/ShootDuration' },
  { label: 'Rigs', icon: Wrench, path: '/Rigs' },
  { label: 'Reports', icon: BarChart2, path: '/Reports' },
  { label: 'Pending/Approve', icon: DollarSign, path: '/Accounts' },
  { label: 'Rig Test Log', icon: FlaskConical, path: '/RigTestLog' },
  { label: 'Reference Guide', icon: BookOpen, path: '/ReferenceGuide' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const allRemoteMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Earnings', icon: TrendingUp, path: '/Earnings' },
  { label: 'Reference Guide', icon: BookOpen, path: '/ReferenceGuide' },
  { label: 'Settings', icon: Settings, path: '/Settings' },
];

const allStandbyMenuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Rig Test Log', icon: FlaskConical, path: '/RigTestLog' },
  { label: 'Reference Guide', icon: BookOpen, path: '/ReferenceGuide' },
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
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Wifi className="h-4 w-4 text-white" />
              </div>
              <span className="text-white font-bold">Remote Ops</span>
            </div>
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
                'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors select-none',
                isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}

        {/* Center App Icon */}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex-none w-16 flex flex-col items-center justify-center gap-1 -mt-4 select-none"
        >
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/40">
            <Wifi className="h-6 w-6 text-white" />
          </div>
        </button>

        {rightItems.map(item => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors select-none',
                isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}