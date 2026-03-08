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
        if (!row.title || !row.date) { failed++; continue; }
        try {
          await base44.entities.Shoot.create({
            title: row.title,
            client: row.client || '',
            location: row.location || '',
            date: row.date,
            game_time: row.game_time || row.gametime || row['game time'] || '',
            status: row.status || 'upcoming',
            description: row.description || row.notes || '',
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
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Import Shoots from CSV</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-gray-400 bg-gray-800 rounded-lg p-3 mb-4">
          <p className="font-semibold text-gray-300 mb-1">Expected CSV columns:</p>
          <code className="text-xs text-blue-300">team, opponent, date (YYYY-MM-DD), time (HH:MM), venue</code>
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
                      <th className="text-left pb-1 pr-3">Title</th>
                      <th className="text-left pb-1 pr-3">Date</th>
                      <th className="text-left pb-1 pr-3">Game Time</th>
                      <th className="text-left pb-1">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {preview.map((row, i) => (
                      <tr key={i} className="text-gray-300">
                        <td className="py-1.5 pr-3">{row.title}</td>
                        <td className="py-1.5 pr-3">{row.date}</td>
                        <td className="py-1.5 pr-3">{row.game_time || row.gametime || '—'}</td>
                        <td className="py-1.5">{row.location}</td>
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
            {result.failed > 0 && <p className="text-yellow-400 text-sm">{result.failed} rows failed (missing title or date)</p>}
            <Button onClick={() => { reset(); onClose(); }} className="mt-6 bg-blue-600 hover:bg-blue-700">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}