import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { LayoutDashboard, Calculator, Menu, X, Settings, LogOut, ShoppingCart } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEME_COLORS = {
  slate: {
    primary: 'bg-slate-800',
    primaryHover: 'hover:bg-slate-700',
    accent: 'bg-slate-600',
    text: 'text-slate-800',
    border: 'border-slate-200',
    activeBg: 'bg-slate-100',
  },
  blue: {
    primary: 'bg-blue-700',
    primaryHover: 'hover:bg-blue-600',
    accent: 'bg-blue-500',
    text: 'text-blue-700',
    border: 'border-blue-200',
    activeBg: 'bg-blue-50',
  },
  green: {
    primary: 'bg-emerald-700',
    primaryHover: 'hover:bg-emerald-600',
    accent: 'bg-emerald-500',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    activeBg: 'bg-emerald-50',
  },
  purple: {
    primary: 'bg-purple-700',
    primaryHover: 'hover:bg-purple-600',
    accent: 'bg-purple-500',
    text: 'text-purple-700',
    border: 'border-purple-200',
    activeBg: 'bg-purple-50',
  },
  rose: {
    primary: 'bg-rose-700',
    primaryHover: 'hover:bg-rose-600',
    accent: 'bg-rose-500',
    text: 'text-rose-700',
    border: 'border-rose-200',
    activeBg: 'bg-rose-50',
  },
};

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  
  const { data: households = [] } = useQuery({
    queryKey: ['households'],
    queryFn: () => base44.entities.Household.list(),
  });
  
  const household = households.find(h => 
    h.owner_email === user?.email || h.shared_with?.includes(user?.email)
  );
  
  const theme = THEME_COLORS[household?.theme] || THEME_COLORS.slate;
  const householdName = household?.name || 'Brits Household Budget';
  
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Budget', icon: Calculator, page: 'Budget' },
    { name: 'Purchases', icon: ShoppingCart, page: 'Purchases' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];
  
  const handleLogout = () => {
    base44.auth.logout();
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className={cn("text-white sticky top-0 z-50", theme.primary)}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {/* Logo */}
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg viewBox="0 0 40 40" className="w-7 h-7">
                  <circle cx="20" cy="20" r="16" fill="white" fillOpacity="0.9"/>
                  <path d="M12 20 L20 12 L28 20 L20 28 Z" fill="currentColor" className={theme.text}/>
                  <circle cx="20" cy="20" r="4" fill="white"/>
                </svg>
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
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="ml-2 text-white/80 hover:text-white hover:bg-white/10">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {user?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
            
            {/* Mobile menu button */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden text-white hover:bg-white/10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
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