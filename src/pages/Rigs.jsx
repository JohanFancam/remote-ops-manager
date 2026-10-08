import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, X, Settings2, StickyNote, Copy, Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import RigSettingSidePanel from '../components/rigs/RigSettingSidePanel';
import { LiveDataBadge } from '@/components/shoots/LiveDataControls';
import { schedulePhaseFlags } from '@/components/utils/schedulePhases';

export default function Rigs() {
  const { isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [sidePanelRig, setSidePanelRig] = useState(null); // rig object to edit, or {} for new, or null for closed
  const [viewOnly, setViewOnly] = useState(false); // true when viewing (not editing)
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const PER_PAGE = 9;

  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rigSettings'] });

  const handleSave = async (formData) => {
    if (!formData.team) return;
    if (sidePanelRig?.id) {
      await base44.entities.RigSetting.update(sidePanelRig.id, formData);
    } else {
      await base44.entities.RigSetting.create(formData);
    }
    setSidePanelRig(null);
    setViewOnly(false);
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.RigSetting.delete(id);
    setConfirmDeleteId(null);
    if (sidePanelRig?.id === id) setSidePanelRig(null);
    refresh();
  };

  const handleLiveDataToggle = async (rig, event) => {
    event.stopPropagation();
    if (!isAdmin) return;
    await base44.entities.RigSetting.update(rig.id, { live_data: !rig.live_data });
    refresh();
  };

  const handleDuplicate = async (rig) => {
    const { id, created_date, updated_date, created_by_id, ...rest } = rig;
    await base44.entities.RigSetting.create({ ...rest, team: `${rest.team} (Copy)` });
    refresh();
  };

  const filtered = rigSettings.filter(r =>
    !search ||
    r.team?.toLowerCase().includes(search.toLowerCase()) ||
    r.sport?.toLowerCase().includes(search.toLowerCase()) ||
    r.rig_type?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageItems = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <div className="min-h-screen bg-slate-800 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Rig Settings</h1>
            <p className="text-slate-400 text-sm mt-1">Team camera configs and the default checklist used when that team’s shoot is assigned for rig testing</p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setSidePanelRig({}); setViewOnly(false); }} className="bg-orange-500 hover:bg-orange-400">
              <Plus className="h-4 w-4 mr-2" /> New Rig Setting
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by team, sport, rig type…"
            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder:text-gray-600 focus:border-orange-500 outline-none" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 3-column tile grid — 9 per page */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          {pageItems.map(rig => {
            const isActive = sidePanelRig?.id === rig.id;
            return (
              <div key={rig.id} className={`rounded-xl border flex flex-col transition-all ${
                isActive ? 'border-orange-500 ring-2 ring-orange-500/40 bg-slate-900' : 'border-slate-800 bg-slate-900 hover:border-slate-800'
              }`}>
                {/* Tile header */}
                <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-100 text-base leading-tight truncate">{rig.team}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{rig.sport} · {rig.venue_type}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {rig.rig_type && (
                      <Badge className="bg-blue-600/20 text-blue-400 border-blue-800 text-xs">{rig.rig_type}</Badge>
                    )}
                    {rig.live_data ? <LiveDataBadge /> : null}
                  </div>
                </div>

                {/* Section badges */}
                <div className="px-4 py-2 flex flex-wrap gap-1.5">
                  {rig.data_enabled !== false && <Badge className="bg-blue-600/20 text-blue-400 border-blue-800 text-xs">Data</Badge>}
                  {rig.fancam_day_enabled && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">Outdoor Day</Badge>}
                  {rig.fancam_night_enabled && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Outdoor Night</Badge>}
                  {rig.indoor_enabled && <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs">Indoor</Badge>}
                  {rig.attention_enabled && <Badge className="bg-yellow-500/20 text-amber-400 border-yellow-500/30 text-xs">Attention</Badge>}
                  {rig.sound_enabled && <Badge className="bg-green-500/20 text-emerald-400 border-green-500/30 text-xs">Sound</Badge>}
                  {rig.sound_trigger_enabled && <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">Sound Trigger</Badge>}
                  {(() => {
                    const phases = schedulePhaseFlags(rig);
                    return (
                      <>
                        {phases.setup && <Badge className="bg-slate-700/60 text-slate-300 border-slate-600 text-xs">Setup time</Badge>}
                        {phases.pre_shoot && <Badge className="bg-slate-700/60 text-slate-300 border-slate-600 text-xs">Pre-shoot time</Badge>}
                        {(rig.default_checks || []).filter(Boolean).length > 0 && (
                          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                            {(rig.default_checks || []).filter(Boolean).length} checks
                          </Badge>
                        )}
                      </>
                    );
                  })()}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(event) => handleLiveDataToggle(rig, event)}
                      className={`text-xs rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide ${
                        rig.live_data
                          ? 'border-sky-500/50 bg-sky-500/20 text-sky-200'
                          : 'border-slate-700 text-slate-500 hover:border-sky-500/40 hover:text-sky-200'
                      }`}
                    >
                      {rig.live_data ? 'Live Data on' : 'Live Data off'}
                    </button>
                  )}
                </div>

                {/* Remote rigs */}
                {rig.remote_rigs?.length > 0 && (
                  <div className="px-4 pb-3">
                    <p className="text-[10px] text-slate-500 mb-1 font-semibold uppercase tracking-tighter">Remote Rigs</p>
                    <div className="flex flex-wrap gap-1">
                      {rig.remote_rigs.map((r, i) => (
                        <span key={i} className="text-xs bg-blue-950/40 text-blue-400 border border-blue-800 px-2 py-0.5 rounded-full">{r}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes preview */}
                {rig.notes && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-1.5 text-orange-400/80 mb-1">
                      <StickyNote className="h-3 w-3" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Notes</span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 italic px-1">"{rig.notes}"</p>
                  </div>
                )}

                {/* Actions */}
                {isAdmin && (
                  <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setSidePanelRig(rig); setViewOnly(true); }}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-orange-400 transition-colors"
                        title="Quick view">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      <button
                        onClick={() => { setSidePanelRig(rig); setViewOnly(false); }}
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                          isActive && !viewOnly ? 'text-orange-400 hover:text-slate-100' : 'text-slate-400 hover:text-slate-100'
                        }`}>
                        <Edit2 className="h-3.5 w-3.5" />
                        {isActive && !viewOnly ? 'Editing →' : 'Edit'}
                      </button>
                    </div>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => handleDuplicate(rig)} title="Duplicate"
                        className="p-1.5 rounded text-slate-500 hover:text-orange-400 hover:bg-slate-800 transition-colors">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {confirmDeleteId === rig.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(rig.id)} className="text-xs px-2 py-0.5 bg-red-700 hover:bg-red-600 text-white rounded">Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-gray-600 text-slate-100 rounded">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(rig.id)}
                          className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && search && (
            <div className="col-span-full text-center py-10 text-slate-500">
              <Search className="h-8 w-8 text-gray-700 mx-auto mb-2" />
              <p>No rig settings match "{search}"</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="text-sm text-slate-500">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {rigSettings.length === 0 && !sidePanelRig && (
          <div className="text-center py-20 text-slate-500">
            <Settings2 className="h-12 w-12 text-gray-700 mx-auto mb-4" />
            <p>No rig settings yet. Add your first team configuration.</p>
          </div>
        )}

        {/* Side Panel for Edit / Add */}
        <RigSettingSidePanel
          isOpen={sidePanelRig !== null}
          rig={sidePanelRig?.id ? sidePanelRig : null}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setSidePanelRig(null); setViewOnly(false); }}
          readOnly={viewOnly}
        />
      </div>
    </div>
  );
}