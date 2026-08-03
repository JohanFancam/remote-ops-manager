import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { parseCSV, normalizeRigType, normalizeTime, buildTitle, isDuplicateRow } from './csvMatch';

export default function CSVImportModal({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError('');
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result);
        setPreview(rows.slice(0, 8));
      } catch {
        setError('Could not parse CSV file.');
      }
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const text = await file.text();
      const rows = parseCSV(text);

      // Fetch existing shoots to detect duplicates.
      const existing = await base44.entities.Shoot.list('-date', 500);

      let success = 0, skipped = 0, failed = 0;
      const batchSeen = new Set();

      for (const row of rows) {
        if (!row.team || !row.date) { failed++; continue; }

        const title = buildTitle(row);
        const gameTime = normalizeTime(row.time || '');
        const rigType = normalizeRigType(row.type || row.rig_type || row.format);

        // Duplicate against existing calendar records (same title + date + time).
        if (isDuplicateRow({ ...row, time: gameTime }, existing)) { skipped++; continue; }

        // Duplicate within this same CSV batch.
        const batchKey = `${title.toLowerCase()}|${row.date}|${gameTime}`;
        if (batchSeen.has(batchKey)) { skipped++; continue; }
        batchSeen.add(batchKey);

        try {
          await base44.entities.Shoot.create({
            title,
            client: row.team || '',
            location: row.stadium || row.venue || '',
            date: row.date,
            game_time: gameTime,
            status: 'upcoming',
            ...(rigType ? { rig_type_override: rigType } : {}),
            ...(row.calendar ? { calendar_source: row.calendar } : {}),
          });
          success++;
        } catch { failed++; }
      }

      setResult({ success, skipped, failed });
      if (success > 0) onImported?.();
    } catch {
      setError('Failed to import file.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setFile(null); setPreview([]); setResult(null); setError(''); };

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Import Shoots from CSV</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-gray-400 bg-gray-800 rounded-lg p-3 mb-4 space-y-2">
          <p className="font-semibold text-gray-300">Expected CSV columns:</p>
          <code className="text-xs text-blue-300 block">team, opponent, date (YYYY-MM-DD), time (HH:MM), stadium, type, calendar</code>
          <ul className="text-xs text-gray-400 space-y-0.5 mt-1">
            <li><b>time</b> must be in South African time (SAST).</li>
            <li><b>stadium</b> is the stadium name only — no addresses.</li>
            <li><b>type</b> is Data, Fancam or Data/Fancam.</li>
            <li><b>calendar</b> is which calendar this game was loaded from.</li>
          </ul>
          <p className="text-xs text-gray-500 mt-1">Only games not already on the calendar are imported — duplicates are skipped automatically.</p>
        </div>

        {!result ? (
          <>
            <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors
              ${file ? 'border-blue-600 bg-blue-950/20' : 'border-gray-700 hover:border-gray-600'}`}>
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
              {file ? (
                <>
                  <FileText className="h-10 w-10 text-blue-400" />
                  <p className="text-white font-medium">{file.name}</p>
                  <p className="text-gray-400 text-sm">{preview.length} rows previewed</p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-gray-600" />
                  <p className="text-gray-400">Click to select a CSV file</p>
                </>
              )}
            </label>

            {preview.length > 0 && (
              <div className="overflow-x-auto">
                <p className="text-xs text-gray-500 mb-2">Preview (first {preview.length} rows):</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="text-left pb-1 pr-3">Team</th>
                      <th className="text-left pb-1 pr-3">Opponent</th>
                      <th className="text-left pb-1 pr-3">Date</th>
                      <th className="text-left pb-1 pr-3">Time</th>
                      <th className="text-left pb-1 pr-3">Stadium</th>
                      <th className="text-left pb-1 pr-3">Type</th>
                      <th className="text-left pb-1">Calendar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {preview.map((row, i) => (
                      <tr key={i} className="text-gray-300">
                        <td className="py-1.5 pr-3">{row.team}</td>
                        <td className="py-1.5 pr-3">{row.opponent}</td>
                        <td className="py-1.5 pr-3">{row.date}</td>
                        <td className="py-1.5 pr-3">{row.time || '—'}</td>
                        <td className="py-1.5 pr-3">{row.stadium || row.venue || '—'}</td>
                        <td className="py-1.5 pr-3">{row.type || '—'}</td>
                        <td className="py-1.5">{row.calendar || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <Button onClick={handleImport} disabled={!file || loading} className="bg-blue-600 hover:bg-blue-700 flex-1">
                {loading ? 'Importing...' : 'Import Shoots'}
              </Button>
              <Button variant="outline" onClick={() => { reset(); onClose(); }} className="border-gray-700 text-gray-300 hover:bg-gray-800">
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <CheckCircle2 className="h-14 w-14 text-green-400 mx-auto mb-4" />
            <p className="text-xl font-bold text-white mb-1">{result.success} shoots imported</p>
            {result.skipped > 0 && <p className="text-yellow-400 text-sm">{result.skipped} skipped as duplicates</p>}
            {result.failed > 0 && <p className="text-red-400 text-sm">{result.failed} rows failed (missing team or date)</p>}
            <Button onClick={() => { reset(); onClose(); }} className="mt-6 bg-blue-600 hover:bg-blue-700">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}