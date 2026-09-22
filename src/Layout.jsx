import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav';
import { createPageUrl } from './utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AppProvider, useApp } from './components/AppContext';
import {
  LayoutDashboard, Calendar, BarChart2, Settings,
  Wrench, LogOut, Wifi, RefreshCw, DollarSign, TrendingUp, Bell,
} from 'lucide-react';
import ShootChangePopup from './components/dashboard/ShootChangePopup';
import ShootCompleteReminder from './components/dashboard/ShootCompleteReminder';
import {
  NotificationProvider,
  NotificationPopups,
  NotificationInbox,
} from './components/dashboard/ShootNotifications';
import TutorialOverlay, { TutorialReopenButton } from './components/TutorialOverlay';
import RefreshReminder from './components/RefreshReminder';
import { registerServiceWorker } from './lib/pushNotifications';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSE_WIDTH = 1400;

function roleLabel(isAdmin, isStandby, isAccounts) {
  if (isAdmin) return 'Admin';
  if (isStandby) return 'Operator / Standby';
  if (isAccounts) return 'Accounts';
  return 'Remote Operator';
}

function LayoutContent({ children, currentPageName }) {
  const { user, isAdmin, isStandby, isAccounts, isLoading } = useApp();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < SIDEBAR_COLLAPSE_WIDTH
  );
  const navigate = useNavigate();

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${SIDEBAR_COLLAPSE_WIDTH - 1}px)`);
    const handleChange = (e) => setCollapsed(e.matches);
    handleChange(mql);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (isLoading || !isAccounts) return;
    const page = currentPageName || 'Dashboard';
    if (page !== 'AccountsDashboard' && page !== 'Settings') {
      navigate('/AccountsDashboard', { replace: true });
    }
  }, [isLoading, isAccounts, currentPageName, navigate]);

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
    enabled: !!user && !isAccounts,
  });

  const notifyHours = Number(appSettings.find((s) => s.key === 'notify_hours_before')?.value) || 5;

  const tutorialAdminEnabled = appSettings.find(s => s.key === 'tutorial_admin')?.value !== 'false';
  const tutorialRemoteEnabled = appSettings.find(s => s.key === 'tutorial_remote')?.value !== 'false';
  const logoUrl = appSettings.find(s => s.key === 'app_logo_url')?.value;

  const adminNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Rigs', icon: Wrench, page: 'Rigs' },
    { name: 'Notifications', icon: Bell, page: 'Notifications' },
    { name: 'Reports', icon: BarChart2, page: 'Reports' },
    { name: 'Pending / Approve', icon: DollarSign, page: 'Accounts' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const remoteNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Notifications', icon: Bell, page: 'Notifications' },
    { name: 'Earnings', icon: TrendingUp, page: 'Earnings' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  // Operator / Standby gets the operator pages plus standby coverage on the calendar
  const standbyNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Notifications', icon: Bell, page: 'Notifications' },
    { name: 'Earnings', icon: TrendingUp, page: 'Earnings' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const accountsNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'AccountsDashboard' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const navItems = isAdmin ? adminNav : isStandby ? standbyNav : isAccounts ? accountsNav : remoteNav;

  const handleLogout = () => base44.auth.logout();

  return (
    <NotificationProvider
      shoots={shoots}
      user={user}
      notifyHours={notifyHours}
      enabled={!!user && !isAccounts}
    >
    <div className="min-h-screen flex">
      <TooltipProvider delayDuration={200}>
        <aside
          className={cn(
            "hidden md:flex flex-col fixed h-[calc(100%-1.25rem)] top-2.5 left-2.5 z-30 overflow-hidden rounded-2xl border border-[color:var(--rom-line)] bg-[#080e1d]/92 backdrop-blur-xl transition-all duration-300 ease-out",
            collapsed ? "w-[72px]" : "w-[15.5rem]"
          )}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className={cn(collapsed ? "p-3" : "px-4 pt-5 pb-4")}>
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
              <div className="rom-mark h-9 w-9 flex-shrink-0">
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  : <Wifi className="h-4 w-4" />
                }
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="rom-brand text-[15px] text-slate-50 leading-tight whitespace-nowrap">
                    Remote Ops
                  </p>
                  <p className="text-[11px] text-slate-500 tracking-wide whitespace-nowrap">Signal desk</p>
                </div>
              )}
            </div>
          </div>

          {!collapsed && (
            <div className="px-4 pb-3 space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-[color:var(--rom-line)] bg-white/[0.03] px-2.5 py-2">
                <span className="rom-live-dot" />
                <span className="text-[11px] font-medium text-slate-300">{roleLabel(isAdmin, isStandby, isAccounts)}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-600">live</span>
              </div>
            </div>
          )}

          <nav className={cn("flex-1 space-y-0.5 overflow-y-auto", collapsed ? "p-2" : "px-2.5 pb-3")}>
            {navItems.map(item => {
              const active = currentPageName === item.page;
              const link = (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={cn(
                    "rom-nav-item",
                    collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                    active ? "rom-nav-item-active" : "rom-nav-item-idle"
                  )}
                >
                  {active && !collapsed && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-400" />
                  )}
                  <item.icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-blue-300" : "")} />
                  {!collapsed && <span className="whitespace-nowrap">{item.name}</span>}
                </Link>
              );
              if (!collapsed) return link;
              return (
                <Tooltip key={item.page}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.name}</TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {!collapsed && !isAccounts && (
            <div className="px-2.5 pb-1">
              <TutorialReopenButton
                isAdmin={isAdmin}
                tutorialEnabled={isAdmin ? tutorialAdminEnabled : tutorialRemoteEnabled}
              />
            </div>
          )}

          <div className={cn("border-t border-[color:var(--rom-line)]", collapsed ? "p-2" : "p-3")}>
            <div className={cn("flex items-center", collapsed ? "justify-center mb-2" : "gap-3 mb-3")}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-700/40 text-blue-100 flex items-center justify-center text-sm font-semibold flex-shrink-0 ring-1 ring-blue-400/20">
                {user?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">{user?.full_name || 'User'}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
              )}
            </div>
            <div className={cn("flex gap-1", collapsed && "flex-col")}>
              {collapsed ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto text-slate-500 hover:text-slate-100 hover:bg-white/5" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Sign Out</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto text-slate-500 hover:text-slate-100 hover:bg-white/5" onClick={() => window.location.reload()}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Refresh</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="flex-1 text-slate-400 hover:text-slate-100 hover:bg-white/5 justify-start" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-100 hover:bg-white/5" onClick={() => window.location.reload()} title="Refresh">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </aside>
      </TooltipProvider>

      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 border-b border-[color:var(--rom-line)] bg-[#080e1d]/92 backdrop-blur-xl flex items-center px-4"
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="rom-mark h-7 w-7">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              : <Wifi className="h-3.5 w-3.5" />
            }
          </div>
          <span className="rom-brand text-sm text-slate-50">Remote Ops</span>
        </div>
        {user && !isAccounts && (
          <div className="ml-auto">
            <NotificationInbox drop="down" />
          </div>
        )}
      </div>

      <RefreshReminder />
      {user && !isAccounts && <NotificationPopups />}
      {user && !isAccounts && <ShootCompleteReminder user={user} />}
      {user && !isAccounts && <ShootChangePopup userEmail={user.email} isAdmin={isAdmin} />}

      {!isLoading && user && !isAccounts && (
        <TutorialOverlay
          isAdmin={isAdmin}
          tutorialEnabled={isAdmin ? tutorialAdminEnabled : tutorialRemoteEnabled}
        />
      )}

      <MobileBottomNav />

      <main
        className={cn(
          "flex-1 pb-20 md:pb-0 min-h-screen transition-all duration-300 ease-out pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-0",
          collapsed ? "md:ml-[84px]" : "md:ml-[17rem]"
        )}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-screen">
            <div className="w-7 h-7 border-2 border-slate-800 border-t-blue-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="rom-enter">{children}</div>
        )}
      </main>
    </div>
    </NotificationProvider>
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
