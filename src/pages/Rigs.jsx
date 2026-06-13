import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, X, Settings2, StickyNote, Copy, Search } from 'lucide-react';
import RigSettingSidePanel from '../components/rigs/RigSettingSidePanel';

export default function Rigs() {
  const { isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [sidePanelRig, setSidePanelRig] = useState(null); // rig object to edit, or {} for new, or null for closed
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.RigSetting.delete(id);
    setConfirmDeleteId(null);
    if (sidePanelRig?.id === id) setSidePanelRig(null);
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

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Rig Settings</h1>
            <p className="text-gray-400 text-sm mt-1">Team-based camera configurations</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setSidePanelRig({})} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> New Rig Setting
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by team, sport, rig type…"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder:text-gray-600 focus:border-blue-600 outline-none" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 2x2 tile grid — scroll for more */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {filtered.map(rig => {
            const isActive = sidePanelRig?.id === rig.id;
            return (
              <div key={rig.id} className={`rounded-xl border flex flex-col transition-all ${
                isActive ? 'border-blue-500 ring-2 ring-blue-600/40 bg-gray-900' : 'border-gray-800 bg-gray-900 hover:border-gray-700'
              }`}>
                {/* Tile header */}
                <div className="p-4 border-b border-gray-800 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-white text-base leading-tight truncate">{rig.team}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{rig.sport} · {rig.venue_type}</p>
                  </div>
                  {rig.rig_type && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs flex-shrink-0">{rig.rig_type}</Badge>
                  )}
                </div>

                {/* Section badges */}
                <div className="px-4 py-2 flex flex-wrap gap-1.5">
                  {rig.data_enabled !== false && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Data</Badge>}
                  {rig.fancam_day_enabled && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">Fancam Day</Badge>}
                  {rig.fancam_night_enabled && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Fancam Night</Badge>}
                  {rig.attention_enabled && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Attention</Badge>}
                  {rig.sound_enabled && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Sound</Badge>}
                </div>

                {/* Remote rigs */}
                {rig.remote_rigs?.length > 0 && (
                  <div className="px-4 pb-3">
                    <p className="text-[10px] text-gray-500 mb-1 font-semibold uppercase tracking-tighter">Remote Rigs</p>
                    <div className="flex flex-wrap gap-1">
                      {rig.remote_rigs.map((r, i) => (
                        <span key={i} className="text-xs bg-blue-900/30 text-blue-300 border border-blue-700/30 px-2 py-0.5 rounded-full">{r}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes preview */}
                {rig.notes && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-1.5 text-blue-400/80 mb-1">
                      <StickyNote className="h-3 w-3" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Notes</span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 italic px-1">"{rig.notes}"</p>
                  </div>
                )}

                {/* Actions */}
                {isAdmin && (
                  <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
                    <button
                      onClick={() => setSidePanelRig(rig)}
                      className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                        isActive ? 'text-blue-400 hover:text-white' : 'text-gray-400 hover:text-white'
                      }`}>
                      <Edit2 className="h-3.5 w-3.5" />
                      {isActive ? 'Editing →' : 'Edit'}
                    </button>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => handleDuplicate(rig)} title="Duplicate"
                        className="p-1.5 rounded text-gray-500 hover:text-blue-400 hover:bg-gray-800 transition-colors">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {confirmDeleteId === rig.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(rig.id)} className="text-xs px-2 py-0.5 bg-red-700 hover:bg-red-600 text-white rounded">Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white rounded">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(rig.id)}
                          className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors">
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
            <div className="col-span-full text-center py-10 text-gray-500">
              <Search className="h-8 w-8 text-gray-700 mx-auto mb-2" />
              <p>No rig settings match "{search}"</p>
            </div>
          )}
        </div>

        {rigSettings.length === 0 && !sidePanelRig && (
          <div className="text-center py-20 text-gray-500">
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
          onClose={() => setSidePanelRig(null)}
        />
      </div>
    </div>
  );
}