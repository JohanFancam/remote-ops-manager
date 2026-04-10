import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, BarChart2, DollarSign, TrendingUp } from 'lucide-react';
import { useApp } from './AppContext';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Reports', icon: BarChart2, path: '/Reports' },
  { label: 'Accounts', icon: DollarSign, path: '/Accounts' },
];

const remoteNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Calendar', icon: Calendar, path: '/Calendar' },
  { label: 'Earnings', icon: TrendingUp, path: '/Earnings' },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const { isAdmin, isAccounts, isLoading } = useApp();

  if (isLoading || isAccounts) return null;

  const navItems = isAdmin ? adminNavItems : remoteNavItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 flex items-stretch h-16">
      {navItems.map(item => {
        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}