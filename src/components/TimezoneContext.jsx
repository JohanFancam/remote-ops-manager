import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  DEFAULT_TIMEZONE,
  formatTimezoneAbbr,
  resolveTimezone,
  setDisplayTimeZone,
} from '@/utils/timezone';

const STORAGE_KEY = 'rom_timezone';
const TimezoneContext = createContext(null);

function readStoredTimezone() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeStoredTimezone(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function TimezoneProvider({ children }) {
  const { user, updateMe } = useAuth();
  const [storedTimezone, setStoredTimezone] = useState(() => readStoredTimezone() || DEFAULT_TIMEZONE);

  useEffect(() => {
    if (user?.timezone) {
      setStoredTimezone(user.timezone);
      writeStoredTimezone(user.timezone);
    }
  }, [user?.timezone]);

  const timeZone = useMemo(() => resolveTimezone(storedTimezone), [storedTimezone]);

  useEffect(() => {
    setDisplayTimeZone(timeZone);
  }, [timeZone]);

  const setTimezone = useCallback(async (value) => {
    const next = value || DEFAULT_TIMEZONE;
    setStoredTimezone(next);
    writeStoredTimezone(next);
    setDisplayTimeZone(resolveTimezone(next));
    if (updateMe) {
      try {
        await updateMe({ timezone: next });
      } catch {
        /* local value still applies */
      }
    }
  }, [updateMe]);

  const value = useMemo(() => ({
    timeZone,
    storedTimezone,
    setTimezone,
    abbr: formatTimezoneAbbr(timeZone),
    isDefault: resolveTimezone(storedTimezone) === DEFAULT_TIMEZONE && storedTimezone !== 'device',
  }), [timeZone, storedTimezone, setTimezone]);

  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const ctx = useContext(TimezoneContext);
  if (!ctx) {
    return {
      timeZone: DEFAULT_TIMEZONE,
      storedTimezone: DEFAULT_TIMEZONE,
      setTimezone: async () => {},
      abbr: formatTimezoneAbbr(DEFAULT_TIMEZONE),
      isDefault: true,
    };
  }
  return ctx;
}
