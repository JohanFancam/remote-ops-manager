import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { parseScanCSV, normalizeRigType, isTeamMatch } from './scanCsv';
import CalendarScanResultItem from './CalendarScanResultItem';

const MONTHS = [
  ['01', 'January'], ['02', 'February'], ['03', 'March'], ['04', 'April'],
  ['05', 'May'], ['06', 'June'], ['07', 'July'], ['08', 'August'],
  ['09', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
];

export default function CalendarScanModal({ open, onClose, shoots, onImported }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - 2 + i));

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setError(''); }
  };

  const handleScan = async () => {
    if (!file) { setError('Please select a CSV file.'); return; }
    setScanning(true);
    setError('');
    try {
      const text = await file.text();
      const rows = parseScanCSV(text);
      const monthPrefix = `${year}-${month}`;

      const events = rows
        .filter(r => r.date && r.date.startsWith(monthPrefix))
        .map(r => ({
          team: r.team,
          opponent: r.opponent || '',
          date: r.date,
          time: r.time || '',
          venue: r.venue || '',
          rigType: normalizeRigType(r.type || r.rig_type || r.format),
        }));

      const monthShoots = (shoots || []).filter(s => s.date && s.date.startsWith(monthPrefix));

      const items = events
        .map(evt => {
          const matched = monthShoots.find(s => isTeamMatch(evt, s));
          const title = evt.opponent ? `${evt.team} vs ${evt.opponent}` : evt.team;

          if (!matched) {
            return {
              key: `new-${evt.date}-${title}`,
              type: 'new',
              event: evt,
              shoot: null,
              form: { title, date: evt.date, game_time: evt.time, location: evt.venue, rigType: evt.rigType },
              status: 'pending',
            };
          }
          const changed = matched.date !== evt.date || (matched.game_time || '') !== (evt.time || '');
          if (!changed) return { key: matched.id, type: 'matched', status: 'ok' };
          return {
            key: matched.id,
            type: 'changed',
            event: evt,
            shoot: matched,
            form: { title: matched.title, date: evt.date, game_time: evt.time, location: matched.location, rigType: evt.rigType },
            status: 'pending',
          };
        })
        .filter(i => i.type !== 'matched');

      setResults(items);
    } catch {
      setError('Could not parse the CSV file.');
    } finally {
      setScanning(false);
    }
  };

  const updateItemForm = (key, field, value) => {
    setResults(prev => prev.map(i => i.key === key ? { ...i, form: { ...i.form, [field]: value } } : i));
  };

  const handleAdd = async (item) => {
    await base44.entities.Shoot.create({
      title: item.form.title,
      client: item.form.title,
      location: item.form.location || '',
      date: item.form.date,
      game_time: item.form.game_time || '',
      status: 'upcoming',
      ...(item.form.rigType ? { rig_type_override: item.form.rigType } : {}),
    });
    setResults(prev => prev.map(i => i.key === item.key ? { ...i, status: 'done' } : i));
    onImported?.();
  };

  const handleUpdate = async (item) => {
    await base44.entities.Shoot.update(item.shoot.id, {
      date: item.form.date,
      game_time: item.form.game_time || '',
      ...(item.form.rigType ? { rig_type_override: item.form.rigType } : {}),
    });
    setResults(prev => prev.map(i => i.key === item.key ? { ...i, status: 'done' } : i));
    onImported?.();
  };

  const handleSkip = (item) => {
    setResults(prev => prev.map(i => i.key === item.key ? { ...i, status: 'skipped' } : i));
  };

  const reset = () => { setFile(null); setResults(null); setError(''); };
  const pendingCount = results?.filter(i => i.status === 'pending').length || 0;

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Scan Calendar CSV</DialogTitle>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Upload a CSV and pick the month to compare against the app calendar. Matching is done by team vs opponent, date and time. Nothing is created or changed until you review and confirm each item.
            </p>

            <div className="text-sm text-gray-400 bg-gray-800 rounded-lg p-3">
              <p className="font-semibold text-gray-300 mb-1">Expected CSV columns:</p>
              <code className="text-xs text-blue-300">team, opponent, date (YYYY-MM-DD), time (HH:MM), venue, type (Data / Fancam / Data/Fancam)</code>
            </div>

            <div className="flex gap-3">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="bg-gray-950 border-gray-700 text-white flex-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  {MONTHS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="bg-gray-950 border-gray-700 text-white w-28"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors
              ${file ? 'border-blue-600 bg-blue-950/20' : 'border-gray-700 hover:border-gray-600'}`}>
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
              {file ? (
                <><FileText className="h-10 w-10 text-blue-400" /><p className="text-white font-medium">{file.name}</p></>
              ) : (
                <><Upload className="h-10 w-10 text-gray-600" /><p className="text-gray-400">Click to select your calendar CSV export</p></>
              )}
            </label>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={handleScan} disabled={!file || scanning} className="bg-blue-600 hover:bg-blue-700 flex-1">
                {scanning ? 'Scanning...' : 'Scan'}
              </Button>
              <Button variant="outline" onClick={() => { reset(); onClose(); }} className="border-gray-700 text-gray-300 hover:bg-gray-800">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {results.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-14 w-14 text-green-400 mx-auto mb-4" />
                <p className="text-white font-medium">Everything matches — no new or changed games found.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-400">Found {results.length} item{results.length !== 1 ? 's' : ''} to review. {pendingCount} pending.</p>
                <div className="space-y-3">
                  {results.map(item => (
                    <CalendarScanResultItem
                      key={item.key}
                      item={item}
                      onChange={updateItemForm}
                      onAdd={handleAdd}
                      onUpdate={handleUpdate}
                      onSkip={handleSkip}
                    />
                  ))}
                </div>
              </>
            )}
            <Button variant="outline" onClick={() => { reset(); onClose(); }} className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}