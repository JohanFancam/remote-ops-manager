import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, X, Link2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const DEFAULT_LINKED_TEAMS = ['Reds', 'Red Sox', 'Rangers'];

export default function AutoAssignSettings({ appSettings, allUsers = [] }) {
  const queryClient = useQueryClient();
  const [linkedTeams, setLinkedTeams] = useState([]);
  const [eligibleUsers, setEligibleUsers] = useState([]);
  const [windowHours, setWindowHours] = useState(2);
  const [newTeam, setNewTeam] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const teamsRaw = appSettings.find(s => s.key === 'auto_assign_teams')?.value;
    const usersRaw = appSettings.find(s => s.key === 'auto_assign_users')?.value;
    const windowRaw = appSettings.find(s => s.key === 'auto_assign_window_hours')?.value;

    setLinkedTeams(teamsRaw ? JSON.parse(teamsRaw) : DEFAULT_LINKED_TEAMS);
    setEligibleUsers(usersRaw ? JSON.parse(usersRaw) : []);
    setWindowHours(windowRaw ? Number(windowRaw) : 2);
  }, [appSettings]);

  const save = async (teamsOverride, usersOverride, windowOverride) => {
    const t = teamsOverride ?? linkedTeams;
    const u = usersOverride ?? eligibleUsers;
    const w = windowOverride ?? windowHours;
    const pairs = [
      { key: 'auto_assign_teams', value: JSON.stringify(t), description: 'Teams that trigger auto-assignment' },
      { key: 'auto_assign_users', value: JSON.stringify(u), description: 'Users eligible for auto-assignment (empty = all users)' },
      { key: 'auto_assign_window_hours', value: String(w), description: 'Hours within which linked shoots are auto-assigned' },
    ];
    for (const pair of pairs) {
      const existing = appSettings.find(s => s.key === pair.key);
      if (existing) {
        await base44.entities.AppSettings.update(existing.id, { value: pair.value });
      } else {
        await base44.entities.AppSettings.create(pair);
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

  const addTeam = () => {
    const t = newTeam.trim();
    if (!t || linkedTeams.includes(t)) return;
    setLinkedTeams(prev => [...prev, t]);
    setNewTeam('');
  };

  const removeTeam = (team) => setLinkedTeams(prev => prev.filter(t => t !== team));

  const toggleUser = (email) => {
    setEligibleUsers(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  // Show all non-admin, non-inactive users (remote operators + standby)
  const operators = allUsers.filter(u => u.role !== 'admin' && !u.inactive);

  return (
    <Card className="bg-slate-900 border-slate-800 mb-6">
      <CardHeader className="border-b border-slate-800 pb-4">
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Link2 className="h-5 w-5 text-purple-400" /> Auto-Assignment Rules
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-5">
        <p className="text-xs text-slate-500">
          When an eligible user assigns themselves to any shoot, the system will automatically assign them to any linked-team shoot on the same day within the time window.
          Auto-assigned shoots do <strong className="text-slate-400">not</strong> count toward the 6-game pre-approval limit (3 pairs).
        </p>

        {/* Time window */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">Time window (hours)</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0.5"
              max="6"
              step="0.5"
              value={windowHours}
              onChange={e => setWindowHours(Number(e.target.value))}
              className="bg-slate-800 border-slate-800 text-slate-100 w-24"
            />
            <span className="text-xs text-slate-500">hours between game times</span>
          </div>
        </div>

        {/* Linked teams */}
        <div>
          <label className="text-xs text-slate-400 block mb-2">Linked teams (any two of these on the same day = auto-pair)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {linkedTeams.map(team => (
              <Badge key={team} className="bg-purple-900/40 text-purple-300 border border-purple-700/50 flex items-center gap-1 pr-1">
                {team}
                <button onClick={() => removeTeam(team)} className="ml-1 hover:text-slate-100">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTeam}
              onChange={e => setNewTeam(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTeam()}
              placeholder="e.g. Mariners"
              className="bg-slate-800 border-slate-800 text-slate-100 text-sm w-48"
            />
            <Button size="sm" onClick={addTeam} className="bg-purple-700 hover:bg-purple-600 gap-1">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>

        {/* Eligible users */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">
            Apply to users {eligibleUsers.length === 0 && <span className="text-yellow-500">(currently: ALL operators)</span>}
          </label>
          <p className="text-xs text-gray-600 mb-2">Select specific users, or leave empty to apply to all operators.</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {operators.map(u => (
              <label key={u.email} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 px-2 py-1.5 rounded-lg">
                <input
                  type="checkbox"
                  checked={eligibleUsers.includes(u.email)}
                  onChange={() => toggleUser(u.email)}
                  className="accent-purple-500"
                />
                <span className="text-sm text-slate-400">{u.full_name || u.email}</span>
                <span className="text-xs text-gray-600">{u.email}</span>
                <span className={`text-xs ml-auto px-1.5 py-0.5 rounded-full ${u.role === 'standby' ? 'bg-yellow-900/40 text-amber-400' : 'bg-green-900/40 text-emerald-400'}`}>
                  {u.role === 'standby' ? 'Op / Standby' : 'Remote'}
                </span>
              </label>
            ))}
            {operators.length === 0 && <p className="text-xs text-gray-600 px-2">No operators found.</p>}
          </div>
        </div>

        <Button onClick={() => save()} className="bg-purple-700 hover:bg-purple-600 gap-2">
          <Save className="h-4 w-4" /> {saved ? '✓ Saved!' : 'Save Auto-Assignment Rules'}
        </Button>
      </CardContent>
    </Card>
  );
}