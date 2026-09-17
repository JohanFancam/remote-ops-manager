import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Upload, Check, AlertTriangle, X } from 'lucide-react';

export default function DataImportSection() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef();
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [imported, setImported] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setFiles([]);
    setPreview(null);
    setImported(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePick = (e) => {
    setFiles(Array.from(e.target.files || []));
    setPreview(null);
    setImported(null);
    setError('');
  };

  const run = async (confirm) => {
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      const result = await base44.dataImport.entities({ files, confirm });
      if (confirm) {
        setImported(result);
        setPreview(null);
        // Everything on screen may have changed
        queryClient.invalidateQueries();
      } else {
        setPreview(result);
      }
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const rowsFor = (result) => result?.results || [];
  const totals = (result) => rowsFor(result).reduce(
    (acc, r) => ({ created: acc.created + r.created, updated: acc.updated + r.updated }),
    { created: 0, updated: 0 }
  );

  const renderResults = (result, title) => {
    const t = totals(result);
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2">
        <p className="text-xs font-medium text-slate-300">{title}</p>
        <div className="space-y-1">
          {rowsFor(result).map((r) => (
            <div key={r.fileName} className="text-xs text-slate-400 flex flex-wrap gap-x-2">
              <span className="text-slate-200">{r.entityType}</span>
              <span className="text-slate-500">{r.fileName}</span>
              <span className="ml-auto tabular-nums">
                {r.created} new · {r.updated} existing
                {r.skippedWithoutId ? ` · ${r.skippedWithoutId} skipped` : ''}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 border-t border-slate-800 pt-2">
          Total: {t.created} new, {t.updated} existing
          {result?.references
            ? ` · ${result.references.references} shoot links (${result.references.broken} unresolved)`
            : ''}
        </p>
      </div>
    );
  };

  return (
    <Card className="bg-slate-900 border-slate-800 mb-6">
      <CardHeader className="border-b border-slate-800 pb-4">
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Database className="h-5 w-5 text-purple-400" /> Import Data
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-xs text-slate-500">
          Upload entity exports (CSV or JSON) to bring shoots, rig profiles, payments, reports,
          standby days, and availability into the app. Keep the exported file names — the entity is
          read from them, e.g. <code className="text-slate-400">Shoot_export.csv</code>. Records
          keep their original ids, so re-importing updates rather than duplicates, and shoots are
          always imported first so linked records attach correctly.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            multiple
            onChange={handlePick}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800 gap-2"
          >
            <Upload className="h-4 w-4" /> Choose files
          </Button>
          {files.length > 0 && (
            <>
              <span className="text-xs text-slate-400">
                {files.length} file{files.length === 1 ? '' : 's'} selected
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={reset}
                className="text-slate-500 hover:text-slate-200 h-8"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>

        {files.length > 0 && (
          <ul className="text-xs text-slate-500 space-y-0.5">
            {files.map((f) => (
              <li key={f.name}>{f.name} · {(f.size / 1024).toFixed(0)} KB</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => run(false)}
            disabled={busy || !files.length}
            className="bg-blue-600 hover:bg-blue-500 gap-2"
          >
            {busy && !preview ? 'Checking…' : 'Preview'}
          </Button>
          <Button
            onClick={() => run(true)}
            disabled={busy || !preview}
            className="bg-green-700 hover:bg-green-600 gap-2"
          >
            <Check className="h-4 w-4" />
            {busy && preview ? 'Importing…' : 'Import'}
          </Button>
        </div>

        {preview && renderResults(preview, 'Preview — nothing written yet')}
        {imported && renderResults(imported, 'Imported')}

        {imported && (
          <p className="text-xs text-emerald-400">
            Import complete. Reload the page to see the data everywhere.
          </p>
        )}

        {preview && !imported && (
          <p className="text-xs text-amber-300 flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-px flex-shrink-0" />
            Check the counts above, then press Import to write these records.
          </p>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </CardContent>
    </Card>
  );
}
