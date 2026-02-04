import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  LayoutDashboard, Calculator, Menu, X, Settings, LogOut, ShoppingCart, 
  TrendingUp, HelpCircle, Home, Heart, Star, PiggyBank, Wallet, Moon, Sun,
  CreditCard, AlertTriangle, Activity, RefreshCw
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HouseholdProvider, useHousehold } from './components/HouseholdContext';
import { ThemeProvider, useTheme } from './components/ThemeProvider';
import BillNotifications from './components/common/BillNotifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LOGO_ICONS = {
  home: Home,
  heart: Heart,
  star: Star,
  piggy: PiggyBank,
  wallet: Wallet,
};

function LayoutContent({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { 
    user, household, showTutorial, toggleTutorial, 
    darkMode, toggleDarkMode, themeColors, logoUrl, logoIcon,
    features, householdId
  } = useHousehold();
  const theme = useTheme();
  const queryClient = useQueryClient();
  
  const householdName = household?.name || 'Household Budget';
  const LogoIcon = LOGO_ICONS[logoIcon] || Home;
  
  // Fetch expenses for notifications
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', householdId],
    queryFn: () => base44.entities.Expense.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  // Build navigation based on enabled features
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard', always: true },
    { name: 'Budget', icon: Calculator, page: 'Budget', always: true },
    { name: 'Purchases', icon: ShoppingCart, page: 'Purchases', always: true },
    { name: 'Debt', icon: CreditCard, page: 'Debt', feature: 'debt' },
    { name: 'Projections', icon: TrendingUp, page: 'Projections', feature: 'projections' },
    { name: 'Activity', icon: Activity, page: 'UserActivity', feature: 'user_activity' },
    { name: 'Settings', icon: Settings, page: 'Settings', always: true },
  ].filter(item => item.always || features[item.feature]);
  
  const handleLogout = () => {
    base44.auth.logout();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const profilePhotoUrl = user?.profile_photo_url;

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      {/* Header */}
      <header className={cn("text-white sticky top-0 z-50", theme.cardHeader)}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {/* Logo */}
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Household logo" className="w-full h-full object-cover" />
                ) : (
                  <LogoIcon className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-lg leading-tight">{householdName}</h1>
                <p className="text-xs text-white/70">Family Budget Tracker</p>
              </div>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    currentPageName === item.page 
                      ? "bg-white/20 text-white" 
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              ))}
              
              {/* Bill Notifications */}
              <BillNotifications expenses={expenses} />

              {/* Refresh Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white/80 hover:text-white hover:bg-white/10"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-5 w-5" />
              </Button>

              {/* Dark Mode Toggle */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white/80 hover:text-white hover:bg-white/10"
                onClick={toggleDarkMode}
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="ml-2 text-white/80 hover:text-white hover:bg-white/10">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                      {profilePhotoUrl ? (
                        <img src={profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium">
                          {user?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleTutorial}>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    {showTutorial ? 'Hide Tutorial' : 'Show Tutorial'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
            
            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-2">
              <BillNotifications expenses={expenses} />
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white/80 hover:text-white hover:bg-white/10"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white/80 hover:text-white hover:bg-white/10"
                onClick={toggleDarkMode}
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/10"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-white/5">
            <nav className="p-2">
              {navItems.map((item) => (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    currentPageName === item.page 
                      ? "bg-white/20 text-white" 
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              ))}
              <button
                onClick={toggleTutorial}
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 w-full"
              >
                <HelpCircle className="h-4 w-4" />
                {showTutorial ? 'Hide Tutorial' : 'Show Tutorial'}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-red-300 hover:bg-white/10 w-full"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </nav>
          </div>
        )}
      </header>
      
      {/* Main Content */}
      <main>
        {children}
      </main>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <HouseholdProvider>
      <LayoutContentWrapper currentPageName={currentPageName}>
        {children}
      </LayoutContentWrapper>
    </HouseholdProvider>
  );
}

function LayoutContentWrapper({ children, currentPageName }) {
  const { darkMode } = useHousehold();
  return (
    <ThemeProvider darkMode={darkMode}>
      <LayoutContent currentPageName={currentPageName}>
        {children}
      </LayoutContent>
    </ThemeProvider>
  );
}