import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav';
import { createPageUrl } from './utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AppProvider, useApp, OFFLINE_THRESHOLD } from './components/AppContext';
import {
  LayoutDashboard, Calendar, BarChart2, Settings,
  Wrench, Menu, X, LogOut, ChevronRight, Wifi, RefreshCw, DollarSign, Receipt,
} from 'lucide-react';
import ShootChangePopup from './components/dashboard/ShootChangePopup';
import TutorialOverlay, { TutorialReopenButton } from './components/TutorialOverlay';
import RefreshReminder from './components/RefreshReminder';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSE_WIDTH = 1400;

function LayoutContent({ children, currentPageName }) {
  const { user, isAdmin, isStandby, isAccounts, isLoading } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
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

  // Redirect accounts users to their dashboard if they land on "/"
  useEffect(() => {
    if (!isLoading && isAccounts && !didRedirect.current && (currentPageName === 'Dashboard' || currentPageName === null)) {
      didRedirect.current = true;
      navigate('/AccountsDashboard', { replace: true });
    }
  }, [isLoading, isAccounts, currentPageName]);
  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const tutorialAdminEnabled = appSettings.find(s => s.key === 'tutorial_admin')?.value !== 'false';
  const tutorialRemoteEnabled = appSettings.find(s => s.key === 'tutorial_remote')?.value !== 'false';

  // All admins see all features
  const showRigs = isAdmin;
  const showReports = isAdmin;
  const showAccounts = isAdmin;
  const showTutorialBtn = true;

  const logoUrl = appSettings.find(s => s.key === 'app_logo_url')?.value;

  const adminNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    showRigs && { name: 'Rigs', icon: Wrench, page: 'Rigs' },
    showReports && { name: 'Reports', icon: BarChart2, page: 'Reports' },
    showAccounts && { name: 'Pending / Approve', icon: DollarSign, page: 'Accounts' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ].filter(Boolean);

  const remoteNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const standbyNav = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Calendar', icon: Calendar, page: 'Calendar' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const accountsNav = [
    { name: 'Dashboard', icon: Receipt, page: 'AccountsDashboard' },
  ];

  const navItems = isAdmin ? adminNav : isStandby ? standbyNav : isAccounts ? accountsNav : remoteNav;

  const handleLogout = () => base44.auth.logout();

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar — desktop */}
      <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "hidden md:flex flex-col bg-gray-900 border-r border-gray-800 fixed h-full transition-all duration-300 ease-in-out overflow-hidden",
          collapsed ? "w-[76px]" : "w-64"
        )}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Logo */}
        <div className={cn("border-b border-gray-800", collapsed ? "p-4" : "p-6")}>
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              {logoUrl
                ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                : <Wifi className="h-5 w-5 text-white" />
              }
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-white font-bold text-sm leading-tight whitespace-nowrap">Remote Ops</p>
                <p className="text-gray-500 text-xs whitespace-nowrap">Manager</p>
              </div>
            )}
          </div>
        </div>

        {/* Role badge */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-gray-800">
            <span className={cn(
              "text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap",
              isAdmin ? "bg-blue-600/20 text-blue-400" : isStandby ? "bg-yellow-600/20 text-yellow-400" : isAccounts ? "bg-green-600/20 text-green-400" : "bg-gray-700 text-gray-400"
            )}>
              {isAdmin ? '⚡ Admin' : isStandby ? '🎯 Standby User' : isAccounts ? '💰 Accounts' : '📡 Remote Operator'}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-3")}>
          {navItems.map(item => {
            const link = (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors select-none",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  currentPageName === item.page
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="whitespace-nowrap">{item.name}</span>}
                {!collapsed && currentPageName === item.page && <ChevronRight className="h-3 w-3 ml-auto" />}
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

        {/* Tutorial reopen button */}
        {(isAdmin ? showTutorialBtn : true) && !collapsed && (
          <div className="px-3 pb-1">
            <TutorialReopenButton isAdmin={isAdmin} tutorialEnabled={isAdmin ? tutorialAdminEnabled : tutorialRemoteEnabled} />
          </div>
        )}

        {/* User footer */}
        <div className={cn("border-t border-gray-800", collapsed ? "p-2" : "p-4")}>
          <div className={cn("flex items-center", collapsed ? "justify-center mb-2" : "gap-3 mb-3")}>
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {user?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.full_name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>
          <div className={cn("flex gap-1", collapsed && "flex-col")}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto text-gray-500 hover:text-white hover:bg-gray-800" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            ) : (
              <Button variant="ghost" size="sm" className="flex-1 text-gray-500 hover:text-white hover:bg-gray-800 justify-start" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" /> Sign Out
              </Button>
            )}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto text-gray-500 hover:text-white hover:bg-gray-800" onClick={() => window.location.reload()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Refresh App</TooltipContent>
              </Tooltip>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white hover:bg-gray-800" onClick={() => window.location.reload()} title="Refresh App">
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>
      </TooltipProvider>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 h-14" style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              : <Wifi className="h-4 w-4 text-white" />
            }
          </div>
          <span className="text-white font-bold text-sm">Remote Ops</span>
        </div>

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

      <RefreshReminder />
      {user && <ShootChangePopup userEmail={user.email} isAdmin={isAdmin} />}

      {/* Tutorial overlay */}
      {!isLoading && user && (
        <TutorialOverlay
          isAdmin={isAdmin}
          tutorialEnabled={isAdmin ? tutorialAdminEnabled : tutorialRemoteEnabled}
        />
      )}

      {/* Mobile bottom nav */}
      <MobileBottomNav />

      {/* Main content */}
      <main
        className={cn(
          "flex-1 pb-16 md:pb-0 min-h-screen transition-all duration-300 ease-in-out",
          collapsed ? "md:ml-[76px]" : "md:ml-64"
        )}
        style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
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