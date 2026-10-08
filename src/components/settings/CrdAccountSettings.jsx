import React, { useEffect, useState } from 'react';
import { Monitor, Save } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { pickSettingValue } from '@/utils/appSettings';
import { CRD_GOOGLE_ACCOUNT_KEY, normalizeCrdAccount } from '@/utils/remoteRigs';

export default function CrdAccountSettings({ appSettings = [] }) {
  const queryClient = useQueryClient();
  const { refreshPublicSettings } = useAuth();
  const saved = pickSettingValue(appSettings, CRD_GOOGLE_ACCOUNT_KEY, '');
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(saved);
  }, [saved]);

  const persist = async () => {
    const email = String(draft || '').trim().toLowerCase();
    if (email && !normalizeCrdAccount(email)) {
      setError('Enter a full Google account email, or leave it blank.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const existing = appSettings.find((row) => row.key === CRD_GOOGLE_ACCOUNT_KEY);
      if (existing) {
        await base44.entities.AppSettings.update(existing.id, { value: email });
      } else {
        await base44.entities.AppSettings.create({
          key: CRD_GOOGLE_ACCOUNT_KEY,
          value: email,
          description: 'Google account Chrome Remote Desktop remotes are registered to',
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      await refreshPublicSettings();
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (err) {
      setError(err.message || 'Could not save the Google account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="border-b border-slate-800 pb-4">
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-orange-400" /> Chrome Remote Desktop
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className="text-xs text-slate-500">
          On a phone the dashboard buttons open the Chrome Remote Desktop app. On a computer they
          are a normal Chrome link to remotedesktop.google.com — Chrome 139+ then launches the
          installed Chrome Remote Desktop <span className="text-slate-300">app window</span>, not a
          browser tab. If it still opens as a webpage: in Chrome go to{' '}
          <a
            href="https://remotedesktop.google.com/access"
            target="_blank"
            rel="noopener"
            className="text-orange-300 hover:text-orange-200 underline"
          >
            remotedesktop.google.com/access
          </a>
          , use the install / Open app icon, and choose Always. The Windows/Mac “Chrome Remote
          Desktop” download is only the host for sharing a PC, not the viewer.
        </p>
        <label className="block">
          <span className="text-xs text-slate-400 block mb-1">Registered Google account</span>
          <Input
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="ops@fancam.com"
            className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500"
          />
        </label>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <Button type="button" onClick={persist} disabled={saving} className="bg-green-700 hover:bg-green-600 gap-2">
          <Save className="h-4 w-4" /> {savedOk ? '✓ Saved!' : saving ? 'Saving…' : 'Save account'}
        </Button>
      </CardContent>
    </Card>
  );
}
