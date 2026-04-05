import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AppProvider, useApp, OFFLINE_THRESHOLD } from './components/AppContext';
import {
  LayoutDashboard, Calendar, Clock, BarChart2, Settings,
  Wrench, Menu, X, LogOut, ChevronRight, Wifi, Bell, RefreshCw, DollarSign, Users
} from 'lucide-react';
import ShootNotifications from './components/dashboard/ShootNotifications';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function LayoutContent({ children, currentPageName }) {
  const { user, isAdmin, isAccounts, isLevel1Admin, adminLevel, isLoading } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showOnline, setShowOnline] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const seenRef = useRef(new Set());

  const playNotifSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) { /* silently fail if audio not available */ }
  };

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const { data: myShoots = [] } = useQuery({
    queryKey: ['myShoots', user?.email],
    queryFn: () => base44.entities.Shoot.list('-date', 200),
    enabled: !!user && !isAdmin,
  });
  const notifyHours = Number(appSettings.find(s => s.key === 'notify_hours_before')?.value || 5);
  const logoUrl = appSettings.find(s => s.key === 'app_logo_url')?.value;

  // Real-time: admins get notified for all shoot updates from remote users
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = base44.entities.Shoot.subscribe((event) => {
      if (event.type === 'update') {
        const shoot = event.data;
        // Pending assignment requests
        if (shoot.pending_operators?.length > 0) {
          shoot.pending_operators.forEach(email => {
            const key = `req_${shoot.id}_${email}`;
            if (!seenRef.current.has(key)) {
              seenRef.current.add(key);
              playNotifSound();
              setUnread(prev => prev + 1);
              setNotifications(prev => [{
                id: key,
                message: `${email} requested assignment to "${shoot.title}"`,
                time: new Date(),
              }, ...prev].slice(0, 50));
            }
          });
        }
        // Phase updates
        const phases = shoot.phase_status || {};
        const phaseLabels = {
          setup_complete: 'Setup Complete',
          pre_shoot_started: 'Pre-Shoot Started',
          attention_started: 'Attention Started',
          sound_started: 'Sound Started',
          shoot_complete: 'Shoot Complete',
        };
        Object.entries(phases).forEach(([key, ts]) => {
          if (!ts) return;
          const notifKey = `phase_${shoot.id}_${key}`;
          if (!seenRef.current.has(notifKey)) {
            seenRef.current.add(notifKey);
            playNotifSound();
            setUnread(prev => prev + 1);
            setNotifications(prev => [{
              id: notifKey,
              message: `"${shoot.title}" — ${phaseLabels[key] || key}`,
              time: new Date(ts),
            }, ...prev].slice(0, 50));
          }
        });
      }
    });
    return unsub;
  }, [isAdmin]);

  // Load initial online users and subscribe to presence changes (admin only)
  useEffect(() => {
    if (!isAdmin) return;

    const loadOnline = async () => {
      const all = await base44.entities.UserPresence.list();
      const now = Date.now();
      const online = all.filter(p =>
        p.is_online && p.last_seen && (now - new Date(p.last_seen).getTime()) < OFFLINE_THRESHOLD
      );
      setOnlineUsers(online);
    };

    loadOnline();

    const unsub = base44.entities.UserPresence.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        const p = event.data;
        const isRecent = p.last_seen && (Date.now() - new Date(p.last_seen).getTime()) < OFFLINE_THRESHOLD;
        const isOnline = p.is_online && isRecent;

        setOnlineUsers(prev => {
          const filtered = prev.filter(u => u.user_email !== p.user_email);
          return isOnline ? [...filtered, p] : filtered;
        });

        // Notify admin when someone comes online (not self)
        if (event.type === 'update' && isOnline && p.user_email !== user?.email) {
          const key = `online_${p.user_email}_${Math.floor(Date.now() / 60000)}`; // once per minute
          if (!seenRef.current.has(key)) {
            seenRef.current.add(key);
            playNotifSound();
            setUnread(prev => prev + 1);
            setNotifications(prev => [{
              id: key,
              message: `${p.user_name || p.user_email} is now online`,
              time: new Date(),
            }, ...prev].slice(0, 50));
          }
        }
      }
    });

    return unsub;
  }, [isAdmin, user?.email]);

  const unreadCount = unread;

  const adminNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Rigs', icon: Wrench, page: 'Rigs' },
    { name: 'Reports', icon: BarChart2, page: 'Reports' },
    { name: 'Accounts', icon: DollarSign, page: 'Accounts' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const remoteNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const accountsNav = [
    { name: 'Accounts', icon: DollarSign, page: 'Accounts' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const navItems = isAdmin ? adminNav : isAccounts ? accountsNav : remoteNav;

  const handleLogout = () => base44.auth.logout();

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-gray-900 border-r border-gray-800 fixed h-full">
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              {logoUrl
                ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                : <Wifi className="h-5 w-5 text-white" />
              }
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

        {/* Online users panel — admin only */}
        {isAdmin && (
          <div className="px-3 pb-1 relative">
            <button
              onClick={() => setShowOnline(p => !p)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" /> Online Now
              </span>
              <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${onlineUsers.length > 0 ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                {onlineUsers.length}
              </span>
            </button>
            {showOnline && (
              <div className="absolute bottom-12 left-3 right-3 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                <div className="p-3 border-b border-gray-700">
                  <span className="text-xs font-medium text-gray-300">Currently Online</span>
                </div>
                {onlineUsers.length === 0 ? (
                  <p className="text-xs text-gray-500 p-4 text-center">No one online</p>
                ) : (
                  onlineUsers.map(u => (
                    <div key={u.user_email} className="px-3 py-2.5 border-b border-gray-700/50 last:border-0 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-200 font-medium">{u.user_name || u.user_email}</p>
                        <p className="text-xs text-gray-500">{u.user_role === 'admin' ? 'Admin' : 'Remote'} · {u.user_email}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Notification bell — admin only */}
        {isAdmin && (
          <div className="px-3 pb-2 relative">
            <button
              onClick={() => { setShowNotifs(p => !p); setUnread(0); }}
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
                  <button onClick={() => { setNotifications([]); setShowNotifs(false); }} className="text-xs text-gray-500 hover:text-white">Clear all</button>
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

        {/* Notification bell — remote users only */}
        {!isAdmin && (
          <div className="px-3 pb-2 flex justify-end">
            <ShootNotifications shoots={myShoots} user={user} notifyHours={notifyHours} />
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
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="flex-1 text-gray-500 hover:text-white hover:bg-gray-800 justify-start" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white hover:bg-gray-800" onClick={() => window.location.reload()} title="Refresh App">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
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