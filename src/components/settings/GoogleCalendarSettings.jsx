import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Link2, Link2Off, RefreshCw, Save } from 'lucide-react';

export default function GoogleCalendarSettings() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [calendarId, setCalendarId] = useState('primary');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: status, isLoading } = useQuery({
    queryKey: ['googleStatus'],
    queryFn: () => base44.google.status(),
  });

  const { data: calendarsData } = useQuery({
    queryKey: ['googleCalendars'],
    queryFn: () => base44.google.calendars(),
    enabled: !!status?.connected,
  });

  useEffect(() => {
    if (status?.calendarId) setCalendarId(status.calendarId);
  }, [status?.calendarId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');
    if (!google) return;
    if (google === 'connected') {
      setMessage('Google Calendar connected. Pick a calendar and press Sync.');
      queryClient.invalidateQueries({ queryKey: ['googleStatus'] });
      queryClient.invalidateQueries({ queryKey: ['googleCalendars'] });
    } else if (google === 'error') {
      setError(params.get('message') || 'Google connection failed');
    }
    params.delete('google');
    params.delete('message');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', next);
  }, [queryClient]);

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const { url } = await base44.google.authUrl();
      window.location.href = url;
    } catch (err) {
      setError(err.message || 'Could not start Google connect');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError('');
    try {
      await base44.google.disconnect();
      setMessage('Google Calendar disconnected');
      queryClient.invalidateQueries({ queryKey: ['googleStatus'] });
      queryClient.invalidateQueries({ queryKey: ['googleCalendars'] });
    } catch (err) {
      setError(err.message || 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveCalendar = async () => {
    setSavingCalendar(true);
    setError('');
    try {
      await base44.google.saveSettings({ calendarId });
      setMessage('Calendar saved');
      queryClient.invalidateQueries({ queryKey: ['googleStatus'] });
    } catch (err) {
      setError(err.message || 'Could not save calendar');
    } finally {
      setSavingCalendar(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const result = await base44.google.sync();
      setMessage(
        `Synced: ${result.created} new, ${result.updated} updated, ${result.cancelled} cancelled (${result.fetched} events)`
      );
      queryClient.invalidateQueries({ queryKey: ['googleStatus'] });
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
    } catch (err) {
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const calendars = calendarsData?.calendars || [];
  const lastSync = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })
    : null;

  return (
    <Card className="bg-slate-900 border-slate-800 mb-6">
      <CardHeader className="border-b border-slate-800 pb-4">
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-400" /> Google Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-xs text-slate-500">
          Pull title, date, and time from Google into the app calendar format. Assignments, rates, and phases stay in the app.
          Use Sync after Google changes (also available on the Calendar page).
        </p>

        {status?.redirectUri && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2">
            <p className="text-xs text-slate-400">
              In Google Cloud → Credentials → your OAuth client → <span className="text-slate-200">Authorized redirect URIs</span>,
              add this exact URI (no trailing slash, no query string):
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-xs text-blue-300 break-all flex-1">{status.redirectUri}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(status.redirectUri);
                    setMessage('Redirect URI copied');
                  } catch {
                    setError('Could not copy — select the URI manually');
                  }
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              If Google shows <code className="text-slate-400">redirect_uri_mismatch</code> or{' '}
              <code className="text-slate-400">flowName=GeneralOAuthLite</code>, the URI in Cloud Console does not match this one.
            </p>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Checking connection…</p>
        ) : !status?.configured ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-2">
            <p>Google OAuth is not configured on the server yet.</p>
            <p>
              Set <code className="text-amber-100">GOOGLE_CLIENT_ID</code>,{' '}
              <code className="text-amber-100">GOOGLE_CLIENT_SECRET</code>, and{' '}
              <code className="text-amber-100">GOOGLE_REDIRECT_URI</code> (same value as above), then restart the API.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs px-2 py-1 rounded border ${
                  status.connected
                    ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                    : 'border-slate-700 text-slate-400 bg-slate-800'
                }`}
              >
                {status.connected ? 'Connected' : 'Not connected'}
              </span>
              {lastSync && <span className="text-xs text-slate-500">Last sync: {lastSync}</span>}
            </div>

            {!status.connected ? (
              <Button onClick={handleConnect} disabled={connecting} className="bg-blue-600 hover:bg-blue-500 gap-2">
                <Link2 className="h-4 w-4" />
                {connecting ? 'Opening Google…' : 'Connect Google Calendar'}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] flex-1">
                    <label className="text-xs text-slate-400 block mb-1">Calendar to sync</label>
                    <Select value={calendarId} onValueChange={setCalendarId}>
                      <SelectTrigger className="bg-slate-800 border-slate-800 text-slate-100">
                        <SelectValue placeholder="Select calendar" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                        {(calendars.length ? calendars : [{ id: calendarId || 'primary', summary: calendarId || 'primary' }]).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.summary || c.id}{c.primary ? ' (primary)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleSaveCalendar}
                    disabled={savingCalendar}
                    variant="outline"
                    className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {savingCalendar ? 'Saving…' : 'Save'}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSync} disabled={syncing} className="bg-blue-600 hover:bg-blue-500 gap-2">
                    <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing…' : 'Sync now'}
                  </Button>
                  <Button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    variant="outline"
                    className="border-slate-700 text-slate-400 hover:bg-slate-800 gap-2"
                  >
                    <Link2Off className="h-4 w-4" />
                    {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {message && <p className="text-xs text-emerald-400">{message}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </CardContent>
    </Card>
  );
}
