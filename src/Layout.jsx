import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav';
import { createPageUrl } from './utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AppProvider, useApp } from './components/AppContext';
import {
  LayoutDashboard, Calendar, Clock, BarChart2, Settings,
  Wrench, LogOut, Wifi, RefreshCw, DollarSign, BookOpen, FlaskConical, Receipt,
} from 'lucide-react';
import ShootNotifications from './components/dashboard/ShootNotifications';
import ShootChangePopup from './components/dashboard/ShootChangePopup';
import TutorialOverlay, { TutorialReopenButton } from './components/TutorialOverlay';
import RefreshReminder from './components/RefreshReminder';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSE_WIDTH = 1400;

function roleLabel(isAdmin, isStandby, isAccounts) {
  if (isAdmin) return 'Admin';
  if (isStandby) return 'Standby';
  if (isAccounts) return 'Accounts';
  return 'Operator';
}

function LayoutContent({ children, currentPageName }) {
  const { user, isAdmin, isStandby, isAccounts, isLoading } = useApp();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < SIDEBAR_COLLAPSE_WIDTH
  );
  const navigate = useNavigate();
  const didRedirect = useRef(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${SIDEBAR_COLLAPSE_WIDTH - 1}px)`);
    const handleChange = (e) => setCollapsed(e.matches);
    handleChange(mql);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!isLoading && isAccounts && !didRedirect.current && (currentPageName === 'Dashboard' || currentPageName === null)) {
      didRedirect.current = true;
      navigate('/AccountsDashboard', { replace: true });
    }
  }, [isLoading, isAccounts, currentPageName, navigate]);

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const tutorialAdminEnabled = appSettings.find(s => s.key === 'tutorial_admin')?.value !== 'false';
  const tutorialRemoteEnabled = appSettings.find(s => s.key === 'tutorial_remote')?.value !== 'false';

  const { data: myShoots = [] } = useQuery({
    queryKey: ['myShoots', user?.email],
    queryFn: () => base44.entities.Shoot.list('-date', 200),
    enabled: !!user,
  });
  const notifyHours = Number(appSettings.find(s => s.key === 'notify_hours_before')?.value || 5);
  const logoUrl = appSettings.find(s => s.key === 'app_logo_url')?.value;

  const adminNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Shoot Duration', icon: Clock, page: 'ShootDuration' },
    { name: 'Rigs', icon: Wrench, page: 'Rigs' },
    { name: 'Reports', icon: BarChart2, page: 'Reports' },
    { name: 'Pending / Approve', icon: DollarSign, page: 'Accounts' },
    { name: 'Rig Test Log', icon: FlaskConical, page: 'RigTestLog' },
    { name: 'Reference Guide', icon: BookOpen, page: 'ReferenceGuide' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const remoteNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Reference Guide', icon: BookOpen, page: 'ReferenceGuide' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const standbyNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Rig Test Log', icon: FlaskConical, page: 'RigTestLog' },
    { name: 'Reference Guide', icon: BookOpen, page: 'ReferenceGuide' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const accountsNav = [
    { name: 'Dashboard', icon: Receipt, page: 'AccountsDashboard' },
  ];

  const navItems = isAdmin ? adminNav : isStandby ? standbyNav : isAccounts ? accountsNav : remoteNav;

  const handleLogout = () => base44.auth.logout();

  return (
    <div className="min-h-screen flex">
      <TooltipProvider delayDuration={200}>
        <aside
          className={cn(
            "hidden md:flex flex-col bg-slate-950/90 backdrop-blur-md border-r border-slate-800/80 fixed h-full transition-all duration-300 ease-out overflow-hidden z-30",
            collapsed ? "w-[72px]" : "w-60"
          )}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className={cn("border-b border-slate-800", collapsed ? "p-3" : "px-5 py-5")}>
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  : <Wifi className="h-4 w-4 text-white" />
                }
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-slate-100 font-semibold text-[15px] leading-tight tracking-tight whitespace-nowrap">
                    Remote Ops
                  </p>
                  <p className="text-slate-500 text-xs whitespace-nowrap">Manager</p>
                </div>
              )}
            </div>
          </div>

          {!collapsed && (
            <div className="px-5 py-3">
              <span className={cn(
                "inline-flex text-[11px] px-2 py-0.5 rounded-md font-medium tracking-wide",
                isAdmin ? "bg-blue-950/40 text-blue-300" :
                isStandby ? "bg-sky-950/50 text-sky-300" :
                isAccounts ? "bg-indigo-950/50 text-indigo-300" :
                "bg-slate-800 text-slate-400"
              )}>
                {roleLabel(isAdmin, isStandby, isAccounts)}
              </span>
            </div>
          )}

          <nav className={cn("flex-1 space-y-0.5 overflow-y-auto", collapsed ? "p-2" : "px-3 pb-3")}>
            {navItems.map(item => {
              const active = currentPageName === item.page;
              const link = (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={cn(
                    "flex items-center rounded-lg text-[13px] font-medium transition-colors select-none",
                    collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
                    active
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
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

          {!collapsed && (
            <div className="px-3 pb-1">
              <TutorialReopenButton
                isAdmin={isAdmin}
                tutorialEnabled={isAdmin ? tutorialAdminEnabled : tutorialRemoteEnabled}
              />
            </div>
          )}

          <div className={cn("pb-2", collapsed ? "px-2 flex justify-center" : "px-3")}>
            <ShootNotifications shoots={myShoots} user={user} notifyHours={notifyHours} />
          </div>

          <div className={cn("border-t border-slate-800", collapsed ? "p-2" : "p-4")}>
            <div className={cn("flex items-center", collapsed ? "justify-center mb-2" : "gap-3 mb-3")}>
              <div className="w-8 h-8 bg-slate-800 text-slate-300 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto text-slate-500 hover:text-slate-100 hover:bg-slate-800" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Sign Out</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto text-slate-500 hover:text-slate-100 hover:bg-slate-800" onClick={() => window.location.reload()}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Refresh</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="flex-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 justify-start" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-100 hover:bg-slate-800" onClick={() => window.location.reload()} title="Refresh">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </aside>
      </TooltipProvider>

      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 flex items-center px-4"
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              : <Wifi className="h-3.5 w-3.5 text-white" />
            }
          </div>
          <span className="text-slate-100 font-semibold text-sm tracking-tight">Remote Ops</span>
        </div>
      </div>

      <RefreshReminder />
      {user && <ShootChangePopup userEmail={user.email} isAdmin={isAdmin} />}

      {!isLoading && user && (
        <TutorialOverlay
          isAdmin={isAdmin}
          tutorialEnabled={isAdmin ? tutorialAdminEnabled : tutorialRemoteEnabled}
        />
      )}

      <MobileBottomNav />

      <main
        className={cn(
          "flex-1 pb-20 md:pb-0 min-h-screen transition-all duration-300 ease-out pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-0",
          collapsed ? "md:ml-[72px]" : "md:ml-60"
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
