import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle, CheckCircle2, Undo2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { parseCSV, normalizeRigType, normalizeTime, buildTitle, classifyRow, findExistingMatchup } from './csvMatch';
import CSVReviewTable from './CSVReviewTable';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Create a shoot, retrying with backoff if the platform rate-limits us.
async function createWithRetry(payload, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await base44.entities.Shoot.create(payload);
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      const isRateLimit = msg.includes('rate limit') || msg.includes('429') || msg.includes('too many');
      if (attempt === retries || !isRateLimit) throw err;
      await sleep(700 * (attempt + 1)); // 700ms, 1.4s, 2.1s, 2.8s
    }
  }
}

export default function CSVImportModal({ open, onClose, onImported }) {
  const [step, setStep] = useState('select'); // select | review | result
  const [file, setFile] = useState(null);
  const [classified, setClassified] = useState({ news: [], duplicates: [], reviews: [] });
  const [decisions, setDecisions] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [createdIds, setCreatedIds] = useState([]);
  const [undoing, setUndoing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [errors, setErrors] = useState([]);

  const reset = () => {
    setStep('select'); setFile(null);
    setClassified({ news: [], duplicates: [], reviews: [] });
    setDecisions({}); setLoading(false); setError('');
    setResult(null); setCreatedIds([]); setUndoing(false);
    setProgress(null); setErrors([]);
  };

  const handleFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError('');
    try {
      const text = await f.text();
      const parsed = parseCSV(text);
      const existing = await base44.entities.Shoot.list('-date', 500);

      const news = [], duplicates = [], reviews = [];
      const batchSeen = new Set();
      parsed.forEach((row, idx) => {
        if (!row.team || !row.date) return;
        const title = buildTitle(row);
        const gameTime = normalizeTime(row.time || '');
        const batchKey = `${title.toLowerCase()}|${row.date}|${gameTime}`;
        if (batchSeen.has(batchKey)) { duplicates.push({ row, idx, title, gameTime }); return; }
        batchSeen.add(batchKey);

        const status = classifyRow({ ...row, time: gameTime }, existing);
        const item = { row, idx, title, gameTime };
        if (status === 'duplicate') {
          duplicates.push(item);
        } else if (status === 'review') {
          const match = findExistingMatchup({ ...row, time: gameTime }, existing);
          reviews.push({
            ...item,
            existingDate: match?.date || '',
            existingTime: normalizeTime(match?.game_time || match?.start_time || ''),
          });
        } else {
          news.push(item);
        }
      });

      // Review rows default to "skip" — admin must actively choose to add.
      const dec = {};
      reviews.forEach(r => { dec[r.idx] = 'skip'; });
      setDecisions(dec);
      setClassified({ news, duplicates, reviews });
      setStep('review');
    } catch {
      setError('Could not parse CSV file.');
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError('');
    const ids = [];
    let success = 0, failed = 0;
    const toImport = [
      ...classified.news,
      ...classified.reviews.filter(r => decisions[r.idx] === 'add'),
    ];
    const seen = new Set();
    const total = toImport.length;
    let processed = 0;
    setProgress({ current: 0, total, currentTitle: '' });
    for (const item of toImport) {
      const key = `${item.title.toLowerCase()}|${item.row.date}|${item.gameTime}`;
      if (seen.has(key)) { processed++; setProgress({ current: processed, total, currentTitle: item.title }); continue; }
      seen.add(key);
      const homeTeam = item.row['client/team'] || item.row.team || '';
      const rigType = normalizeRigType(item.row.type || item.row.rig_type || item.row.format);
      try {
        const created = await createWithRetry({
          title: item.title,
          client: homeTeam,
          location: item.row.stadium || item.row.venue || '',
          date: item.row.date,
          game_time: item.gameTime,
          status: 'upcoming',
          ...(rigType ? { rig_type_override: rigType } : {}),
          ...(item.row.calendar ? { calendar_source: item.row.calendar } : {}),
        });
        if (created?.id) ids.push(created.id);
        success++;
      } catch (err) {
        failed++;
        setErrors(prev => [...prev, { title: item.title, date: item.row.date, time: item.gameTime, error: err?.message || 'Failed to create shoot' }]);
      }
      processed++;
      setProgress({ current: processed, total, currentTitle: item.title });
      // Small throttle so we don't burst the platform's per-second write limit.
      if (processed < total) await sleep(150);
    }

    const skipped = classified.duplicates.length + classified.reviews.filter(r => decisions[r.idx] !== 'add').length;
    setCreatedIds(ids);
    setProgress(null);
    setResult({ success, skipped, failed, undone: false });
    if (success > 0) onImported?.();
    setStep('result');
    setLoading(false);
  };

  const handleUndo = async () => {
    if (!createdIds.length) return;
    setUndoing(true);
    for (const id of createdIds) {
      try { await base44.entities.Shoot.delete(id); } catch { /* ignore */ }
    }
    setCreatedIds([]);
    setResult(r => ({ ...r, undone: true, success: 0 }));
    onImported?.();
    setUndoing(false);
  };

  const reviewCount = classified.reviews.filter(r => decisions[r.idx] === 'add').length;

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose(); }}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Import Shoots from CSV</DialogTitle>
        </DialogHeader>

        {step !== 'result' && (
          <div className="text-sm text-gray-400 bg-gray-800 rounded-lg p-3 mb-4 space-y-2">
            <p className="font-semibold text-gray-300">Expected CSV columns:</p>
            <code className="text-xs text-blue-300 block">team, opponent, date (YYYY-MM-DD), time (HH:MM), Client/Team</code>
            <ul className="text-xs text-gray-400 space-y-0.5 mt-1">
              <li><b>date</b> must be <b>YYYY-MM-DD</b> and <b>time</b> must be <b>HH:MM</b> in South African time (SAST).</li>
              <li><b>Client/Team</b> is the home team — the first team in the "Team vs Opponent" title (e.g. Lightning vs Predators → Lightning).</li>
            </ul>
            <p className="text-xs text-gray-500 mt-1">Exact duplicates are skipped; rows with the same team but a different date/time must be reviewed before importing.</p>
          </div>
        )}

        {step === 'select' && (
          <>
            <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors
              ${file ? 'border-blue-600 bg-blue-950/20' : 'border-gray-700 hover:border-gray-600'}`}>
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
              {file ? (
                <>
                  <FileText className="h-10 w-10 text-blue-400" />
                  <p className="text-white font-medium">{file.name}</p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-gray-600" />
                  <p className="text-gray-400">Click to select a CSV file</p>
                </>
              )}
            </label>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <Button onClick={() => { reset(); onClose(); }} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 flex-1">
                Cancel
              </Button>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="bg-green-950/30 border border-green-800/40 rounded-lg p-2">
                <p className="text-2xl font-bold text-green-400">{classified.news.length + reviewCount}</p>
                <p className="text-xs text-gray-400">to import</p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-2">
                <p className="text-2xl font-bold text-gray-300">{classified.duplicates.length}</p>
                <p className="text-xs text-gray-400">duplicates (skip)</p>
              </div>
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-2">
                <p className="text-2xl font-bold text-amber-400">{classified.reviews.length}</p>
                <p className="text-xs text-gray-400">need review</p>
              </div>
            </div>

            {classified.reviews.length > 0 && (
              <CSVReviewTable
                reviews={classified.reviews}
                decisions={decisions}
                onChange={(idx, val) => setDecisions(d => ({ ...d, [idx]: val }))}
                onAddAll={() => setDecisions(d => { const n = { ...d }; classified.reviews.forEach(r => { n[r.idx] = 'add'; }); return n; })}
                onSkipAll={() => setDecisions(d => { const n = { ...d }; classified.reviews.forEach(r => { n[r.idx] = 'skip'; }); return n; })}
              />
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {loading && progress && (
              <div className="mb-4 bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                    Importing shoots...
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-200 ease-out"
                    style={{ width: `${progress.total ? Math.round((progress.current / progress.total) * 100) : 0}%` }}
                  />
                </div>
                {progress.currentTitle && (
                  <p className="text-xs text-gray-500 mt-2 truncate">
                    {progress.current < progress.total ? 'Creating' : 'Created'}: {progress.currentTitle}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <Button onClick={handleImport} disabled={loading} className="bg-blue-600 hover:bg-blue-700 flex-1">
                {loading ? 'Importing...' : `Import ${classified.news.length + reviewCount} Shoot(s)`}
              </Button>
              <Button variant="outline" onClick={reset} disabled={loading} className="border-gray-700 text-gray-300 hover:bg-gray-800">
                Back
              </Button>
            </div>
          </>
        )}

        {step === 'result' && (
          <div className="text-center py-8">
            {result?.undone ? (
              <>
                <Undo2 className="h-14 w-14 text-blue-400 mx-auto mb-4" />
                <p className="text-xl font-bold text-white mb-1">Import undone</p>
                <p className="text-gray-400 text-sm">All shoots from this import were removed.</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-14 w-14 text-green-400 mx-auto mb-4" />
                <p className="text-xl font-bold text-white mb-1">{result?.success} shoots imported</p>
                {result?.skipped > 0 && <p className="text-yellow-400 text-sm">{result.skipped} skipped as duplicates</p>}
                {result?.failed > 0 && <p className="text-red-400 text-sm">{result.failed} rows failed</p>}
                {errors.length > 0 && (
                  <div className="mt-4 text-left bg-red-950/30 border border-red-800/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <p className="text-xs font-semibold text-red-300 mb-2 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" /> Error report ({errors.length})
                    </p>
                    <ul className="space-y-1.5">
                      {errors.map((e, i) => (
                        <li key={i} className="text-xs text-gray-300">
                          <span className="text-red-400 font-medium">{e.title || 'Untitled'}</span>
                          <span className="text-gray-500"> — {e.date}{e.time ? ` ${e.time}` : ''}</span>
                          <span className="text-gray-400 block ml-3">{e.error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {createdIds.length > 0 && (
                  <Button onClick={handleUndo} disabled={undoing} variant="outline" className="mt-6 border-amber-700/50 text-amber-400 hover:bg-amber-900/30">
                    {undoing ? 'Undoing...' : <><Undo2 className="h-4 w-4 mr-1" /> Undo Import</>}
                  </Button>
                )}
              </>
            )}
            <Button onClick={() => { reset(); onClose(); }} className="mt-3 bg-blue-600 hover:bg-blue-700">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}