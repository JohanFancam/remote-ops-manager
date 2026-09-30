import React, { createContext, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const AppContext = createContext(null);

// How long without a heartbeat before considered offline (ms)
const OFFLINE_THRESHOLD = 3 * 60 * 1000; // 3 minutes (heartbeat is 1 min, allow 2 missed)
const HEARTBEAT_INTERVAL = 60 * 1000; // 1 minute

export { OFFLINE_THRESHOLD };

export function AppProvider({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const isLoading = isLoadingAuth;

  const presenceIdRef = useRef(null);

  const isAdmin = user?.role === 'admin';
  // "Operator / Standby": shoots like a remote operator and also covers standby
  const isStandby = user?.role === 'standby';
  const isAccounts = user?.role === 'accounts';
  const isAnalytics = user?.role === 'analytics';
  const isViewer = user?.role === 'viewer';
  // Anyone who takes shoots and earns from them
  const isOperator = user?.role === 'user' || isStandby;
  const adminLevel = null; // removed admin levels
  const isLevel1Admin = isAdmin; // all admins have full access now
  const isLevel2Admin = false;

  // Write/update presence record when user loads
  useEffect(() => {
    if (!user?.email) return;

    const upsertPresence = async () => {
      const now = new Date().toISOString();
      try {
        const existing = await base44.entities.UserPresence.filter({ user_email: user.email });
        if (existing?.length > 0) {
          presenceIdRef.current = existing[0].id;
          await base44.entities.UserPresence.update(existing[0].id, {
            last_seen: now,
            is_online: true,
            user_name: user.full_name || user.email,
            user_role: user.role || 'user',
          });
        } else {
          const created = await base44.entities.UserPresence.create({
            user_email: user.email,
            user_name: user.full_name || user.email,
            user_role: user.role || 'user',
            last_seen: now,
            is_online: true,
          });
          presenceIdRef.current = created.id;
        }
      } catch (e) { /* ignore */ }
    };

    upsertPresence();

    // Heartbeat
    const interval = setInterval(async () => {
      if (!presenceIdRef.current) return;
      try {
        await base44.entities.UserPresence.update(presenceIdRef.current, {
          last_seen: new Date().toISOString(),
          is_online: true,
        });
      } catch (e) { /* ignore */ }
    }, HEARTBEAT_INTERVAL);

    // Mark offline on unload
    const handleUnload = () => {
      if (!presenceIdRef.current) return;
      navigator.sendBeacon && base44.entities.UserPresence.update(presenceIdRef.current, { is_online: false });
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [user?.email]);

  return (
    <AppContext.Provider value={{ user, isAdmin, isStandby, isAccounts, isAnalytics, isViewer, isOperator, isLevel1Admin, isLevel2Admin, adminLevel, isLoading }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}