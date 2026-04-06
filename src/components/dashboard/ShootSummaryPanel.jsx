import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  Copy, Check, Edit2, Save, Archive, RotateCcw, RefreshCw, Clock
} from 'lucide-react';
import { format } from 'date-fns';

const ARCHIVE_KEY = 'shootsummary_archived';
function getArchived() {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch { return []; }
}
function saveArchived(ids) { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(ids)); }

export default function ShootSummaryPanel({ shoots = [], appSettings = [] }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editMsg, setEditMsg] = useState('');
  const [overrides, setOverrides] = useState({});
  const [archived, setArchived] = useState(() => getArchived());
  const [checked, setChecked] = useState({});
  const [showArchived, setShowArchived] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: reports = [] } = useQuery({
    queryKey: ['shootReports'],
    queryFn: () => base44.entities.ShootReport.list('-shoot_date', 200),
  });

  const templateOk = appSettings.find(s => s.key === 'summary_template_ok')?.value
    || '{name} complete, no issues to report.';
  const templateIssues = appSettings.find(s => s.key === 'summary_template_issues')?.value
    || '{name} complete — ⚠️ Issues reported: {notes}';

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = format(cutoff, 'yyyy-MM-dd');

  // Completed shoots in last 7 days (not archived)
  const completedShoots = shoots
    .filter(s => s.phase_status?.shoot_complete && s.date >= cutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Today's in-progress shoots
  const inProgressShoots = shoots.filter(s =>
    s.date === todayStr &&
    !s.phase_status?.shoot_complete &&
    s.status !== 'cancelled' &&
    (s.phase_status?.setup_complete || s.phase_status?.pre_shoot_started ||
      s.phase_status?.attention_started || s.phase_status?.sound_started)
  ).sort((a, b) => (a.game_time || '').localeCompare(b.game_time || ''));

  const activeShoots = completedShoots.filter(s => !archived.includes(s.id));
  const archivedShoots = completedShoots.filter(s => archived.includes(s.id));
  const checkedShoots = activeShoots.filter(s => checked[s.id]);

  const getReport = (shootId) => reports.find(r => r.shoot_id === shootId);

  const buildMessage = (shoot) => {
    const report = getReport(shoot.id);
    const name = shoot.title || shoot.client || 'Shoot';
    if (report?.had_issues) {
      return templateIssues.replace('{name}', name).replace('{notes}', report.notes || 'see report');
    }
    return templateOk.replace('{name}', name);
  };

  const getMessage = (shoot) => {
    if (overrides[shoot.id] !== undefined) return overrides[shoot.id];
    return buildMessage(shoot);
  };

  const getPhaseLabel = (shoot) => {
    const p = shoot.phase_status || {};
    if (p.sound_started) return 'Sound Check';
    if (p.attention_started) return 'Attention';
    if (p.pre_shoot_started) return 'Pre-Shoot';
    if (p.setup_complete) return 'Setup Done';
    return 'In Progress';
  };

  const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const handleEdit = (shoot) => {
    setEditingId(shoot.id);
    setEditMsg(getMessage(shoot));
  };

  const handleSave = (id) => {
    setOverrides(prev => ({ ...prev, [id]: editMsg }));
    setEditingId(null);
  };

  const handleArchiveChecked = () => {
    const next = [...new Set([...archived, ...checkedShoots.map(s => s.id)])];
    setArchived(next);
    saveArchived(next);
    setChecked({});
  };

  const handleUnarchive = (id) => {
    const next = archived.filter(a => a !== id);
    setArchived(next);
    saveArchived(next);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['shoots'] });
    await queryClient.invalidateQueries({ queryKey: ['shootReports'] });
    setTimeout(() => setRefreshing(false), 800);
  };

  const bulletSummary = checkedShoots.map(s => `• ${getMessage(s)}`).join('\n');
  const fullCopyText = `Shoot Summary:\n\n${bulletSummary}`;

  const handleCopy = () => {
    if (!bulletSummary) return;
    navigator.clipboard.writeText(fullCopyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalCount = activeShoots.length + inProgressShoots.length;

  return (
    <Card className="bg-gray-900 border-gray-800 mt-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-white font-semibold text-base hover:text-green-400 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            Shoot Summary
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
            {totalCount > 0 && !expanded && (
              <span className="text-xs bg-green-600/20 text-green-400 border border-green-700/40 px-2 py-0.5 rounded-full ml-1">
                {totalCount}
              </span>
            )}
          </button>
          {expanded && (
            <div className="flex items-center gap-2">
              <button onClick={handleRefresh} title="Refresh"
                className={`text-gray-500 hover:text-white transition-colors ${refreshing ? 'animate-spin' : ''}`}>
                <RefreshCw className="h-4 w-4" />
              </button>
              {checkedShoots.length > 0 && (
                <>
                  <Button size="sm" variant="ghost" onClick={handleArchiveChecked}
                    className="gap-1.5 text-xs h-7 text-gray-400 hover:text-yellow-400 hover:bg-gray-800">
                    <Archive className="h-3 w-3" /> Archive Selected
                  </Button>
                  <Button size="sm" onClick={handleCopy} className="bg-green-700 hover:bg-green-600 gap-1.5 text-xs h-7">
                    {copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy Selected</>}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4 space-y-4">

          {/* In-Progress Today */}
          {inProgressShoots.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-yellow-400" /> In Progress Today
              </p>
              <div className="space-y-1.5">
                {inProgressShoots.map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-yellow-950/20 border border-yellow-800/30 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
                      <span className="text-sm text-yellow-200 font-medium">{s.title || s.client}</span>
                      {s.game_time && <span className="text-xs text-gray-500">· {s.game_time}</span>}
                    </div>
                    <span className="text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-700/40 px-2 py-0.5 rounded-full font-medium">
                      {getPhaseLabel(s)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed — checkbox model like RigsCheck */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-green-400" /> Completed — Last 7 Days
            </p>
            {activeShoots.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-3">No completed shoots yet.</p>
            ) : (
              <div className="space-y-2">
                {activeShoots.map(s => {
                  const report = getReport(s.id);
                  const hasIssues = report?.had_issues;
                  const isEditing = editingId === s.id;
                  const isChecked = !!checked[s.id];

                  return (
                    <div key={s.id} className={`rounded-lg px-3 py-2.5 border transition-colors ${isChecked ? 'bg-green-950/20 border-green-700/50' : hasIssues ? 'bg-red-950/20 border-red-800/40' : 'bg-gray-800/40 border-gray-700/50'}`}>
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
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggle(s.id)}
                            className="w-4 h-4 rounded accent-green-500 flex-shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              {hasIssues
                                ? <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                                : <CheckCircle2 className="h-3.5 w-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                              }
                              <p className={`text-sm leading-relaxed ${isChecked ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                                {getMessage(s)}
                              </p>
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5 ml-5">
                              {s.date === todayStr ? 'Today' : format(new Date(s.date + 'T12:00:00'), 'EEE, MMM d')}
                            </p>
                          </div>
                          <button onClick={() => handleEdit(s)} className="text-gray-600 hover:text-blue-400 flex-shrink-0 mt-0.5" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tip */}
          {activeShoots.length > 0 && checkedShoots.length === 0 && (
            <p className="text-xs text-gray-600 text-center">✓ Tick shoots to include in message, then Copy & Archive.</p>
          )}

          {/* Preview */}
          {checkedShoots.length > 0 && (
            <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Slack Message Preview</p>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{fullCopyText}</pre>
              <p className="text-xs text-gray-600 mt-2">After copying, click <strong className="text-yellow-400">Archive Selected</strong> to remove from list.</p>
            </div>
          )}

          {/* Archived */}
          {archivedShoots.length > 0 && (
            <div className="border-t border-gray-800 pt-3">
              <button onClick={() => setShowArchived(!showArchived)}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5">
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