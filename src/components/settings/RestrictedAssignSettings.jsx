import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Plus, X, Save } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { parseRestrictedAssignTeams, RESTRICTED_ASSIGN_TEAMS_KEY } from '@/utils/restrictedAssign';

export default function RestrictedAssignSettings({ appSettings = [] }) {
  const queryClient = useQueryClient();
  const [teams, setTeams] = useState([]);
  const [newTeam, setNewTeam] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTeams(parseRestrictedAssignTeams(appSettings));
  }, [appSettings]);

  const save = async (next = teams) => {
    const payload = {
      key: RESTRICTED_ASSIGN_TEAMS_KEY,
      value: JSON.stringify(next),
      description: 'Games remotes cannot assign themselves to',
    };
    const existing = appSettings.find((item) => item.key === RESTRICTED_ASSIGN_TEAMS_KEY);
    if (existing) {
      await base44.entities.AppSettings.update(existing.id, { value: payload.value });
    } else {
      await base44.entities.AppSettings.create(payload);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

  const addTeam = () => {
    const name = newTeam.trim();
    if (!name || teams.some((team) => team.toLowerCase() === name.toLowerCase())) return;
    const next = [...teams, name];
    setTeams(next);
    setNewTeam('');
    save(next);
  };

  const removeTeam = (name) => {
    const next = teams.filter((team) => team !== name);
    setTeams(next);
    save(next);
  };

  return (
    <Card className="bg-slate-900 border-slate-800 mb-6">
      <CardHeader className="border-b border-slate-800 pb-4">
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-400" /> Restricted assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-xs text-slate-500">
          Remote operators cannot assign themselves to these games. Admins and Operator / Standby still can.
          Titles that include <span className="text-slate-300">Manual</span> stay locked for everyone.
          Match is on the shoot title or client — e.g. <span className="text-slate-300">PSG</span> covers “PSG vs Lyon”.
        </p>
        <div className="flex flex-wrap gap-2">
          {teams.map((team) => (
            <Badge key={team} className="bg-amber-950/40 text-amber-200 border border-amber-800/50 flex items-center gap-1 pr-1">
              {team}
              <button type="button" onClick={() => removeTeam(team)} className="ml-1 hover:text-slate-100" aria-label={`Remove ${team}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {teams.length === 0 && <p className="text-xs text-slate-600">None yet — remotes can still assign to every non-Manual game.</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTeam()}
            placeholder="e.g. PSG"
            className="bg-slate-800 border-slate-800 text-slate-100 text-sm w-48"
          />
          <Button size="sm" onClick={addTeam} className="bg-amber-700 hover:bg-amber-600 gap-1">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
          <Button size="sm" variant="outline" onClick={() => save()} className="border-slate-700 text-slate-200 hover:bg-slate-800 gap-1">
            <Save className="h-3.5 w-3.5" /> {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
