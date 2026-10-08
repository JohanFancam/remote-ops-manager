import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Link2, Link2Off, RefreshCw, Save } from 'lucide-react';

export default function GoogleCalendarSettings() {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [savingOauth, setSavingOauth] = useState(false);
  const [dataCalendarId, setDataCalendarId] = useState('');
  const [fancamCalendarId, setFancamCalendarId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
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
    if (status?.dataCalendarId) setDataCalendarId(status.dataCalendarId);
    else if (status?.calendarId) setDataCalendarId(status.calendarId);
    if (status?.fancamCalendarId) setFancamCalendarId(status.fancamCalendarId);
  }, [status?.dataCalendarId, status?.calendarId, status?.fancamCalendarId]);

  useEffect(() => {
    if (!status) return;
    if (status.clientId) setClientId((prev) => prev || status.clientId);
    setRedirectUri((prev) => prev || status.redirectUri || status.suggestedRedirectUri || '');
  }, [status]);

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

  const displayRedirect = redirectUri || status?.suggestedRedirectUri || status?.redirectUri || '';

  const handleCopyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(displayRedirect);
      setMessage('Redirect URI copied');
    } catch {
      setError('Could not copy — select the URI manually');
    }
  };

  const handleSaveOauth = async () => {
    setSavingOauth(true);
    setError('');
    try {
      await base44.google.saveOAuth({
        clientId,
        clientSecret,
        redirectUri: displayRedirect,
      });
      setClientSecret('');
      setMessage('Google credentials saved. You can connect the calendar now.');
      queryClient.invalidateQueries({ queryKey: ['googleStatus'] });
    } catch (err) {
      setError(err.message || 'Could not save Google credentials');
    } finally {
      setSavingOauth(false);
    }
  };

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
      await base44.google.saveSettings({ dataCalendarId, fancamCalendarId });
      setMessage('Data and Fancam calendars saved');
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
        `Synced Data + Fancam: ${result.created} new, ${result.updated} updated, ${result.cancelled} cancelled (${result.fetched} events). Google was not changed.`
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
          <CalendarDays className="h-5 w-5 text-orange-400" /> Google Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-xs text-slate-500">
          Connect Google once, then pick your Data and Fancam calendars. Sync pulls both at the same time into the app
          calendar format (South Africa time). A time or date change on Google updates that same app entry; a game that
          is not on the app calendar is created. Edits in this app never write back to Google.
        </p>
        <p className="text-xs text-slate-500">
          After they are connected, both calendars auto-sync at{' '}
          <span className="text-slate-300">06:00, 13:00 and 20:00 SAST</span> every day. You can still press Sync any time.
        </p>

        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2 text-xs text-slate-400">
          <p className="text-slate-200 font-medium">Create the Google login (once)</p>
          <ol className="list-decimal pl-4 space-y-1.5">
            <li>
              Open{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-blue-300 hover:underline"
              >
                Google Cloud → APIs &amp; Services → Credentials
              </a>
            </li>
            <li>Create or pick a project, then enable the <span className="text-slate-200">Google Calendar API</span>.</li>
            <li>
              Create credentials → <span className="text-slate-200">OAuth client ID</span> → Application type{' '}
              <span className="text-slate-200">Web application</span>.
            </li>
            <li>
              Under Authorized redirect URIs, add this exact value (no slash at the end):
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="text-blue-300 break-all flex-1">{displayRedirect || 'https://your-domain/api/google/callback'}</code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8"
                  onClick={handleCopyRedirect}
                >
                  Copy
                </Button>
              </div>
            </li>
            <li>Create, then paste the Client ID and Client secret below and Save. After that, click Connect Google Calendar.</li>
          </ol>
        </div>

        <div className="grid gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Client ID</label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxxxx.apps.googleusercontent.com"
              className="bg-slate-800 border-slate-800 text-slate-100 h-9 text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Client secret {status?.hasSecret ? '(leave blank to keep the saved secret)' : ''}
            </label>
            <Input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={status?.hasSecret ? '••••••••' : 'GOCSPX-…'}
              className="bg-slate-800 border-slate-800 text-slate-100 h-9 text-xs"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Redirect URI (must match Google Cloud)</label>
            <Input
              value={displayRedirect}
              onChange={(e) => setRedirectUri(e.target.value)}
              className="bg-slate-800 border-slate-800 text-slate-100 h-9 text-xs"
            />
          </div>
          <Button
            onClick={handleSaveOauth}
            disabled={savingOauth || !clientId}
            className="bg-orange-500 hover:bg-orange-400 gap-2 w-fit"
          >
            <Save className="h-4 w-4" />
            {savingOauth ? 'Saving…' : 'Save Google credentials'}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Checking connection…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs px-2 py-1 rounded border ${
                  status?.configured
                    ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                    : 'border-amber-500/40 text-amber-200 bg-amber-500/10'
                }`}
              >
                {status?.configured ? 'Credentials saved' : 'Credentials not saved yet'}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded border ${
                  status?.connected
                    ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                    : 'border-slate-700 text-slate-400 bg-slate-800'
                }`}
              >
                {status?.connected ? 'Calendar connected' : 'Calendar not connected'}
              </span>
              {lastSync && <span className="text-xs text-slate-500">Last sync: {lastSync}</span>}
            </div>

            {status?.configured && !status.connected && (
              <Button onClick={handleConnect} disabled={connecting} className="bg-orange-500 hover:bg-orange-400 gap-2">
                <Link2 className="h-4 w-4" />
                {connecting ? 'Opening Google…' : 'Connect Google Calendar'}
              </Button>
            )}

            {status?.connected && (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Data calendar</label>
                    <Select value={dataCalendarId || undefined} onValueChange={setDataCalendarId}>
                      <SelectTrigger className="bg-slate-800 border-slate-800 text-slate-100">
                        <SelectValue placeholder="Select Data calendar" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                        {(calendars.length ? calendars : [{ id: dataCalendarId || 'primary', summary: dataCalendarId || 'primary' }]).map((c) => (
                          <SelectItem key={`data-${c.id}`} value={c.id}>
                            {c.summary || c.id}{c.primary ? ' (primary)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Fancam calendar</label>
                    <Select value={fancamCalendarId || undefined} onValueChange={setFancamCalendarId}>
                      <SelectTrigger className="bg-slate-800 border-slate-800 text-slate-100">
                        <SelectValue placeholder="Select Fancam calendar" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                        {(calendars.length ? calendars : [{ id: fancamCalendarId || 'primary', summary: fancamCalendarId || 'primary' }]).map((c) => (
                          <SelectItem key={`fancam-${c.id}`} value={c.id}>
                            {c.summary || c.id}{c.primary ? ' (primary)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleSaveCalendar}
                  disabled={savingCalendar || (!dataCalendarId && !fancamCalendarId)}
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-2"
                >
                  <Save className="h-4 w-4" />
                  {savingCalendar ? 'Saving…' : 'Save calendars'}
                </Button>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSync} disabled={syncing} className="bg-orange-500 hover:bg-orange-400 gap-2">
                    <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing…' : 'Sync Data + Fancam'}
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

                {(status?.lastSyncChanges || []).length > 0 && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1.5">Last sync changes</p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {status.lastSyncChanges.slice(0, 20).map((item, index) => (
                        <li key={`${item.title}-${item.date}-${index}`} className="text-xs text-slate-300">
                          <span className="text-blue-300">{item.calendar || 'Google'}</span>
                          {' · '}
                          <span className="text-slate-400">{item.action}</span>
                          {' · '}
                          {item.title}
                          {item.date ? ` · ${item.date}${item.time ? ` ${item.time}` : ''}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
