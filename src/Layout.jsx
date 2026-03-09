import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AppProvider, useApp } from './components/AppContext';
import {
  LayoutDashboard, Calendar, Clock, BarChart2, Settings,
  Wrench, Menu, X, LogOut, ChevronRight, Wifi, Bell
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function LayoutContent({ children, currentPageName }) {
  const { user, isAdmin, isLevel1Admin, adminLevel, isLoading } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const seenRef = useRef(new Set());

  // Real-time: admins get notified when remote users request assignment
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = base44.entities.Shoot.subscribe((event) => {
      if (event.type === 'update' && event.data?.pending_operators?.length > 0) {
        const shoot = event.data;
        shoot.pending_operators.forEach(email => {
          const key = `${shoot.id}_${email}`;
          if (!seenRef.current.has(key)) {
            seenRef.current.add(key);
            setNotifications(prev => [{
              id: key,
              message: `${email} requested assignment to "${shoot.title}"`,
              time: new Date(),
            }, ...prev].slice(0, 20));
          }
        });
      }
    });
    return unsub;
  }, [isAdmin]);

  const unreadCount = notifications.length;

  const adminNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Timesheets', icon: Clock, page: 'Timesheets' },
    { name: 'Rigs', icon: Wrench, page: 'Rigs' },
    { name: 'Reports', icon: BarChart2, page: 'Reports' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const remoteNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const navItems = isAdmin ? adminNav : remoteNav;

  const handleLogout = () => base44.auth.logout();

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-gray-900 border-r border-gray-800 fixed h-full">
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Wifi className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Remote Ops</p>
              <p className="text-gray-500 text-xs">Manager</p>
            </div>
          </div>
        </div>

        {/* Role badge */}
        <div className="px-4 py-3 border-b border-gray-800">
          <span className={cn(
            "text-xs px-2.5 py-1 rounded-full font-medium",
            isAdmin ? "bg-blue-600/20 text-blue-400" : "bg-gray-700 text-gray-400"
          )}>
            {isAdmin ? `⚡ Admin ${adminLevel === 2 ? 'L2' : 'L1'}` : '📡 Remote Operator'}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                currentPageName === item.page
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.name}
              {currentPageName === item.page && <ChevronRight className="h-3 w-3 ml-auto" />}
            </Link>
          ))}
        </nav>

        {/* Notification bell — admin only */}
        {isAdmin && (
          <div className="px-3 pb-2 relative">
            <button
              onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) setNotifications([]); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4" /> Notifications
              </span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifs && (
              <div className="absolute bottom-12 left-3 right-3 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
                <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-300">Notifications</span>
                  <button onClick={() => setNotifications([])} className="text-xs text-gray-500 hover:text-white">Clear all</button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-gray-500 p-4 text-center">No new notifications</p>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="px-3 py-2.5 border-b border-gray-700/50 last:border-0">
                      <p className="text-xs text-gray-200 leading-relaxed">{n.message}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.time.toLocaleTimeString()}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* User footer */}
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
          <Button variant="ghost" size="sm" className="w-full text-gray-500 hover:text-white hover:bg-gray-800 justify-start" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Wifi className="h-4 w-4 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Remote Ops</span>
        </div>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-gray-900 pt-14">
          <nav className="p-3 space-y-1">
            {navItems.map(item => (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  currentPageName === item.page ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-gray-800 w-full"
            >
              <LogOut className="h-5 w-5" /> Sign Out
            </button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 min-h-screen">
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-screen">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : children}
      </main>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <AppProvider>
      <LayoutContent currentPageName={currentPageName}>
        {children}
      </LayoutContent>
    </AppProvider>
  );
}