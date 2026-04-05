import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Copy, Check, Edit2, Save, Archive, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

const ARCHIVE_KEY = 'shootsummary_archived';
function getArchived() {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch { return []; }
}
function saveArchived(ids) { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(ids)); }

export default function ShootSummaryPanel({ shoots = [], appSettings = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editMsg, setEditMsg] = useState('');
  const [overrides, setOverrides] = useState({});
  const [archived, setArchived] = useState(() => getArchived());
  const [showArchived, setShowArchived] = useState(false);

  const { data: reports = [] } = useQuery({
    queryKey: ['shootReports'],
    queryFn: () => base44.entities.ShootReport.list('-shoot_date', 200),
  });

  // Customizable templates from settings
  const templateOk = appSettings.find(s => s.key === 'summary_template_ok')?.value
    || '{name} complete, no issues to report.';
  const templateIssues = appSettings.find(s => s.key === 'summary_template_issues')?.value
    || '{name} complete — ⚠️ Issues reported: {notes}';

  // Last 7 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = format(cutoff, 'yyyy-MM-dd');

  const completedShoots = shoots
    .filter(s => s.phase_status?.shoot_complete && s.date >= cutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date));

  const activeShoots = completedShoots.filter(s => !archived.includes(s.id));
  const archivedShoots = completedShoots.filter(s => archived.includes(s.id));

  const getReport = (shootId) => reports.find(r => r.shoot_id === shootId);

  const buildMessage = (shoot) => {
    const report = getReport(shoot.id);
    const name = shoot.title || shoot.client || 'Shoot';
    if (report?.had_issues) {
      return templateIssues
        .replace('{name}', name)
        .replace('{notes}', report.notes || 'see report');
    }
    return templateOk.replace('{name}', name);
  };

  const getMessage = (shoot) => {
    if (overrides[shoot.id] !== undefined) return overrides[shoot.id];
    return buildMessage(shoot);
  };

  const handleEdit = (shoot) => {
    setEditingId(shoot.id);
    setEditMsg(getMessage(shoot));
  };

  const handleSave = (id) => {
    setOverrides(prev => ({ ...prev, [id]: editMsg }));
    setEditingId(null);
  };

  const handleArchive = (id) => {
    const next = [...new Set([...archived, id])];
    setArchived(next);
    saveArchived(next);
  };

  const handleUnarchive = (id) => {
    const next = archived.filter(a => a !== id);
    setArchived(next);
    saveArchived(next);
  };

  const fullSummary = activeShoots.map(s => getMessage(s)).join('\n');

  const handleCopy = () => {
    if (!fullSummary) return;
    navigator.clipboard.writeText(`Shoot Summary:\n\n${fullSummary}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-gray-900 border-gray-800 mt-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-white font-semibold text-base hover:text-green-400 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            Shoot Summary — Last 7 Days
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
            {activeShoots.length > 0 && !expanded && (
              <span className="text-xs bg-green-600/20 text-green-400 border border-green-700/40 px-2 py-0.5 rounded-full ml-1">
                {activeShoots.length}
              </span>
            )}
          </button>
          {expanded && activeShoots.length > 0 && (
            <Button size="sm" onClick={handleCopy} className="bg-green-700 hover:bg-green-600 gap-1.5 text-xs h-7">
              {copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy All</>}
            </Button>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4">
          {activeShoots.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No completed shoots in the last 7 days.</p>
          ) : (
            <div className="space-y-2">
              {activeShoots.map(s => {
                const report = getReport(s.id);
                const hasIssues = report?.had_issues;
                const isEditing = editingId === s.id;
                const todayStr = format(new Date(), 'yyyy-MM-dd');

                return (
                  <div key={s.id} className={`rounded-lg px-3 py-2.5 border ${hasIssues ? 'bg-red-950/20 border-red-800/40' : 'bg-gray-800/40 border-gray-700/50'}`}>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editMsg}
                          onChange={e => setEditMsg(e.target.value)}
                          className="bg-gray-700 border-gray-600 text-white text-sm min-h-[60px]"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-blue-700 hover:bg-blue-600 h-6 text-xs gap-1" onClick={() => handleSave(s.id)}>
                            <Save className="h-3 w-3" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-400" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          {hasIssues
                            ? <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                            : <CheckCircle2 className="h-3.5 w-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                          }
                          <p className="text-sm text-gray-200 leading-relaxed">{getMessage(s)}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                          <button onClick={() => handleEdit(s)} className="text-gray-600 hover:text-blue-400" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleArchive(s.id)} className="text-gray-600 hover:text-yellow-400" title="Archive">
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-600 mt-1 ml-5">
                      {s.date === format(new Date(), 'yyyy-MM-dd') ? 'Today' : format(new Date(s.date + 'T12:00:00'), 'EEE, MMM d')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {activeShoots.length > 0 && (
            <div className="mt-4 bg-gray-800/60 rounded-lg p-3 border border-gray-700">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Preview</p>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                {`Shoot Summary:\n\n${fullSummary}`}
              </pre>
            </div>
          )}

          {archivedShoots.length > 0 && (
            <div className="mt-4 border-t border-gray-800 pt-3">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5"
              >
                <Archive className="h-3 w-3" />
                {showArchived ? 'Hide' : 'Show'} archived ({archivedShoots.length})
              </button>
              {showArchived && (
                <div className="mt-2 space-y-2">
                  {archivedShoots.map(s => (
                    <div key={s.id} className="flex items-center gap-3 opacity-50">
                      <span className="text-sm text-gray-500 line-through flex-1">{s.title || s.client}</span>
                      <button onClick={() => handleUnarchive(s.id)} className="text-gray-600 hover:text-blue-400" title="Restore">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}