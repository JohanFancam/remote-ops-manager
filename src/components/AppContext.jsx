import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const AppContext = createContext(null);

// How long without a heartbeat before considered offline (ms)
const OFFLINE_THRESHOLD = 3 * 60 * 1000; // 3 minutes (heartbeat is 1 min, allow 2 missed)
const HEARTBEAT_INTERVAL = 60 * 1000; // 1 minute

export { OFFLINE_THRESHOLD };

export function AppProvider({ children }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // PendingUser holds the admin-managed role (incl. standby / accounts / operator_standby),
  // which the platform User.role doesn't always reflect. Resolve the effective role from it.
  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: () => base44.entities.PendingUser.list(),
    staleTime: 60_000,
  });

  const presenceIdRef = useRef(null);

  const platformRole = user?.role;
  const pending = pendingUsers.find(p =>
    p.email?.toLowerCase().trim() === user?.email?.toLowerCase().trim()
  );
  const pendingRole = pending?.role;
  const effectiveRole = pendingRole || platformRole;

  // Admin is authoritative from either the platform role or the admin-managed PendingUser role.
  const isAdmin = platformRole === 'admin' || pendingRole === 'admin';
  const isStandby = !isAdmin && effectiveRole === 'standby';
  const isAccounts = !isAdmin && effectiveRole === 'accounts';
  const isOperatorStandby = !isAdmin && effectiveRole === 'operator_standby';
  // Anyone who can claim/swap standby coverage on the calendar.
  const canStandby = isAdmin || isStandby || isOperatorStandby;
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
    <AppContext.Provider value={{ user, isAdmin, isStandby, isAccounts, isOperatorStandby, canStandby, effectiveRole, isLevel1Admin, isLevel2Admin, adminLevel, isLoading }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}