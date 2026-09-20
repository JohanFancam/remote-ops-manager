import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Rocket, RefreshCw } from 'lucide-react';

function stateLabel(state) {
  if (state === 'running') return 'Deploying…';
  if (state === 'success') return 'Last deploy succeeded';
  if (state === 'failed') return 'Last deploy failed';
  return 'Ready';
}

export default function DeploySettings() {
  const queryClient = useQueryClient();
  const [branch, setBranch] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['deployStatus'],
    queryFn: () => base44.deploy.status(),
    refetchInterval: (query) => (query.state.data?.status?.state === 'running' ? 2000 : 8000),
  });

  useEffect(() => {
    if (!data?.current?.branch) return;
    setBranch((prev) => prev || data.current.branch);
  }, [data?.current?.branch]);

  const running = data?.status?.state === 'running';
  const options = useMemo(() => {
    const list = [...(data?.branches || [])];
    if (branch && !list.includes(branch)) list.unshift(branch);
    return list;
  }, [data?.branches, branch]);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      await base44.deploy.start(branch);
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ['deployStatus'] });
    } catch (err) {
      setError(err.message || 'Deploy could not start');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-800 mb-6">
      <CardHeader className="border-b border-slate-800 pb-4">
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Rocket className="h-5 w-5 text-blue-400" /> Deploy
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-xs text-slate-500">
          One click pulls the selected branch on this server, rebuilds, and restarts the app.
          Use this on the live site so you do not need SSH for later updates.
        </p>

        {isLoading ? (
          <div className="h-8 w-8 border-2 border-slate-700 border-t-blue-400 rounded-full animate-spin" />
        ) : (
          <>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-sm">
              <p className="text-slate-300">
                Live now:{' '}
                <span className="font-medium text-slate-100">{data?.current?.branch || '—'}</span>
                {data?.current?.sha ? <span className="text-slate-500"> · {data.current.sha}</span> : null}
              </p>
              {data?.current?.subject && (
                <p className="text-xs text-slate-500 mt-1 truncate">{data.current.subject}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">{stateLabel(data?.status?.state)}</p>
            </div>

            {!data?.canDeploy && (
              <p className="text-xs text-amber-300/90">
                {data?.reason || 'Deploy is only available on the live server.'}
              </p>
            )}

            <div>
              <label className="text-xs text-slate-400 block mb-1">Branch to deploy</label>
              <select
                value={branch}
                onChange={(e) => { setBranch(e.target.value); setConfirming(false); }}
                disabled={running || !data?.canDeploy}
                className="w-full bg-slate-800 border border-slate-800 text-slate-100 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {options.length === 0 && <option value="">No branches found</option>}
                {options.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            {confirming ? (
              <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-3 space-y-3">
                <p className="text-sm text-amber-100">
                  Deploy <span className="font-semibold">{branch}</span> to this live app now?
                  The site may be briefly unavailable while it rebuilds.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={start} disabled={busy || running} className="bg-blue-600 hover:bg-blue-500 gap-2">
                    <Rocket className="h-4 w-4" /> {busy ? 'Starting…' : 'Yes, deploy'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirming(false)}
                    className="text-slate-300 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setConfirming(true)}
                disabled={!data?.canDeploy || !branch || running}
                className="bg-blue-600 hover:bg-blue-500 gap-2 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Rocket className="h-4 w-4" />
                {running ? 'Deploy in progress' : 'Deploy this update'}
              </Button>
            )}

            {data?.log ? (
              <details className="rounded-lg border border-slate-800 bg-black/30">
                <summary className="cursor-pointer px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5" /> Deploy log
                </summary>
                <pre className="px-3 pb-3 text-[11px] leading-relaxed text-slate-400 overflow-auto max-h-64 whitespace-pre-wrap">
                  {data.log}
                </pre>
              </details>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
