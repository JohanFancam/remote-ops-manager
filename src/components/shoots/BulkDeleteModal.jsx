import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

export default function BulkDeleteModal({ open, onClose, onDeleted }) {
  const [team, setTeam] = useState('');
  const [mode, setMode] = useState('range'); // range | month
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(null);

  const reset = () => {
    setTeam(''); setMode('range'); setFromDate(''); setToDate('');
    setMonth(format(new Date(), 'yyyy-MM'));
    setMatches([]); setSearched(false); setDone(null);
  };

  useEffect(() => {
    if (open) {
      base44.entities.Shoot.list('-date', 1000)
        .then(all => setTeams([...new Set(all.map(s => (s.client || '').trim()).filter(Boolean))].sort()))
        .catch(() => setTeams([]));
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const findMatches = async () => {
    setSearching(true); setDone(null);
    try {
      const all = await base44.entities.Shoot.list('-date', 1000);
      const inRange = (s) => {
        const d = s.date || '';
        if (mode === 'month') return d.startsWith(month);
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      };
      const teamMatch = (s) => !team || (s.client || '').toLowerCase().trim() === team.toLowerCase().trim();
      setMatches(all.filter(s => teamMatch(s) && inRange(s)).sort((a, b) => (a.date || '').localeCompare(b.date || '')));
      setSearched(true);
    } catch {
      setMatches([]);
    }
    setSearching(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    let count = 0;
    for (const s of matches) {
      try { await base44.entities.Shoot.delete(s.id); count++; } catch { /* ignore */ }
    }
    setDeleting(false);
    setDone(count);
    setMatches([]);
    onDeleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-400" /> Bulk Delete Shoots
          </DialogTitle>
        </DialogHeader>

        {done == null ? (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Team (Client / home team)</label>
                <select value={team} onChange={e => setTeam(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 text-white rounded px-2 py-1.5 text-sm">
                  <option value="">All teams</option>
                  {teams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={() => setMode('range')}
                  className={mode === 'range' ? 'bg-blue-600 hover:bg-blue-700' : 'border border-gray-700 text-gray-300 hover:bg-gray-800'}
                  variant={mode === 'range' ? 'default' : 'outline'}>
                  Date Range
                </Button>
                <Button size="sm" onClick={() => setMode('month')}
                  className={mode === 'month' ? 'bg-blue-600 hover:bg-blue-700' : 'border border-gray-700 text-gray-300 hover:bg-gray-800'}
                  variant={mode === 'month' ? 'default' : 'outline'}>
                  Whole Month
                </Button>
              </div>

              {mode === 'range' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">From</label>
                    <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 text-white rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">To</label>
                    <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 text-white rounded px-2 py-1.5 text-sm" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Month</label>
                  <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 text-white rounded px-2 py-1.5 text-sm" />
                </div>
              )}

              <Button size="sm" variant="outline" onClick={findMatches} disabled={searching}
                className="border-gray-700 text-gray-300 hover:bg-gray-800">
                {searching ? 'Searching...' : 'Find Matches'}
              </Button>
            </div>

            {searched && matches.length === 0 && (
              <p className="text-xs text-gray-500">No matches found — adjust the filters and click Find Matches.</p>
            )}

            {matches.length > 0 && (
              <div className="border border-red-800/50 bg-red-950/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {matches.length} shoot(s) will be permanently deleted.
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-gray-800">
                      {matches.map(s => (
                        <tr key={s.id} className="text-gray-300">
                          <td className="py-1 pr-3 whitespace-nowrap">{s.date}</td>
                          <td className="py-1 truncate" title={s.title}>{s.title}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button size="sm" onClick={handleDelete} disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 w-full">
                  {deleting ? 'Deleting...' : `Delete ${matches.length} Shoot(s)`}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <Trash2 className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-xl font-bold text-white mb-1">{done} shoots deleted</p>
            <Button onClick={() => { reset(); onClose(); }} className="mt-6 bg-blue-600 hover:bg-blue-700">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}