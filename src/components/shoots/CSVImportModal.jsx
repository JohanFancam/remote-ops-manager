import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map(line => {
    // Handle quoted fields
    const cols = [];
    let inQ = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
    return obj;
  });
}

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
        setPreview(rows.slice(0, 5));
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
      let success = 0, failed = 0;
      for (const row of rows) {
        if (!row.team || !row.date) { failed++; continue; }
        try {
          const title = row.opponent ? `${row.team} vs ${row.opponent}` : row.team;
          await base44.entities.Shoot.create({
            title,
            client: row.team || '',
            location: row.venue || '',
            date: row.date,
            game_time: row.time || '',
            status: 'upcoming',
          });
          success++;
        } catch { failed++; }
      }
      setResult({ success, failed });
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
      <DialogContent className="bg-white border-zinc-200 text-zinc-900 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-900">Import Shoots from CSV</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-zinc-500 bg-zinc-100 rounded-lg p-3 mb-4">
          <p className="font-semibold text-zinc-600 mb-1">Expected CSV columns:</p>
          <code className="text-xs text-teal-700">team, opponent, date (YYYY-MM-DD), time (HH:MM), venue</code>
        </div>

        {!result ? (
          <>
            <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors
              ${file ? 'border-teal-700 bg-teal-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
              {file ? (
                <>
                  <FileText className="h-10 w-10 text-teal-700" />
                  <p className="text-zinc-900 font-medium">{file.name}</p>
                  <p className="text-zinc-500 text-sm">{preview.length} rows previewed</p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-gray-600" />
                  <p className="text-zinc-500">Click to select a CSV file</p>
                </>
              )}
            </label>

            {preview.length > 0 && (
              <div className="overflow-x-auto">
                <p className="text-xs text-zinc-400 mb-2">Preview (first {preview.length} rows):</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-400 border-b border-zinc-200">
                      <th className="text-left pb-1 pr-3">Team</th>
                      <th className="text-left pb-1 pr-3">Opponent</th>
                      <th className="text-left pb-1 pr-3">Date</th>
                      <th className="text-left pb-1 pr-3">Time</th>
                      <th className="text-left pb-1">Venue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {preview.map((row, i) => (
                      <tr key={i} className="text-zinc-600">
                        <td className="py-1.5 pr-3">{row.team}</td>
                        <td className="py-1.5 pr-3">{row.opponent}</td>
                        <td className="py-1.5 pr-3">{row.date}</td>
                        <td className="py-1.5 pr-3">{row.time || '—'}</td>
                        <td className="py-1.5">{row.venue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <Button onClick={handleImport} disabled={!file || loading} className="bg-teal-700 hover:bg-teal-800 flex-1">
                {loading ? 'Importing...' : 'Import Shoots'}
              </Button>
              <Button variant="outline" onClick={() => { reset(); onClose(); }} className="border-zinc-200 text-zinc-600 hover:bg-zinc-100">
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <CheckCircle2 className="h-14 w-14 text-emerald-700 mx-auto mb-4" />
            <p className="text-xl font-bold text-zinc-900 mb-1">{result.success} shoots imported</p>
            {result.failed > 0 && <p className="text-amber-700 text-sm">{result.failed} rows failed (missing title or date)</p>}
            <Button onClick={() => { reset(); onClose(); }} className="mt-6 bg-teal-700 hover:bg-teal-800">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}