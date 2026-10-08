import React, { useState } from 'react';
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  pushSupported,
  enablePushNotifications,
  disablePushNotifications,
  isPushEnabledLocally,
  registerServiceWorker,
} from '@/lib/pushNotifications';

export default function EnablePushCard() {
  const [enabled, setEnabled] = useState(() => isPushEnabledLocally());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const supported = pushSupported();

  React.useEffect(() => {
    registerServiceWorker();
  }, []);

  const onEnable = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await enablePushNotifications();
      setEnabled(true);
      setMessage('Notifications on. They still pop up if you close the app or the browser tab.');
    } catch (err) {
      setError(err.message || 'Could not enable notifications');
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    setBusy(true);
    setError('');
    try {
      await disablePushNotifications();
      setEnabled(false);
      setMessage('Push notifications turned off on this device');
    } catch (err) {
      setError(err.message || 'Could not disable notifications');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-blue-500/10 p-2 text-blue-300">
          <Smartphone className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-100">Phone & desktop alerts</p>
          <p className="text-xs text-slate-500 mt-1">
            Enable push so alerts pop on this phone or desktop even when the app is closed or the tab is gone.
            On iPhone / iPad use <span className="text-slate-300">Add to Home Screen</span> first (Safari 16.4+).
            Android and desktop Chrome / Edge can enable directly.
          </p>
        </div>
      </div>

      {!supported ? (
        <p className="text-xs text-amber-300">
          This browser does not support Web Push. Use Chrome / Edge on Android or desktop, or Safari on iOS 16.4+ with the app added to the Home Screen.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!enabled ? (
            <Button onClick={onEnable} disabled={busy} className="bg-orange-500 hover:bg-orange-400 gap-2">
              <Bell className="h-4 w-4" />
              {busy ? 'Enabling…' : 'Enable notifications'}
            </Button>
          ) : (
            <Button
              onClick={onDisable}
              disabled={busy}
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2"
            >
              <BellOff className="h-4 w-4" />
              {busy ? 'Updating…' : 'Disable on this device'}
            </Button>
          )}
        </div>
      )}

      {message && <p className="text-xs text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
