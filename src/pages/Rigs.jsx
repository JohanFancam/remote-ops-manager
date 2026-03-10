import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';

const SPORTS = ['NBA', 'NHL', 'NFL', 'Soccer', 'MLB', 'MLS', 'Rugby', 'Cricket', 'Tennis', 'Other'];
const SHUTTER_OPTIONS = ['1/100', '1/125', '1/160', '1/200', '1/250', '1/320', '1/400'];
const APERTURE_OPTIONS = ['F5.6', 'F6.3', 'F7.1', 'F8', 'F9', 'F10', 'F11'];
const ISO_OPTIONS = ['Auto', '800', '1600', '3200', '6400'];

const RIG_TYPES = ['Data', 'Fancam', 'Data/Fancam'];

const emptyForm = {
  team: '', venue_type: 'Indoor', sport: 'NBA', rig_type: 'Data', shoot_plan: '',
  remote_rigs: [],
  sound: false,
  hd_camera: true, hd_shutter: '1/250', hd_aperture: 'F8', hd_iso: 'Auto',
  wide_camera: true, wide_shutter: '1/250', wide_aperture: 'F8', wide_iso: 'Auto',
  attention_camera: false, attention_shutter: '1/250', attention_aperture: 'F8', attention_iso: 'Auto',
  notes: '',
};

function CameraSection({ label, enabled, onToggle, form, setForm, prefix }) {
  return (
    <div className={`rounded-lg border p-3 transition-colors ${enabled ? 'border-blue-700 bg-blue-950/20' : 'border-gray-700 bg-gray-800/20'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">{label}</span>
        <button
          type="button"
          onClick={onToggle}
          className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? 'bg-blue-600' : 'bg-gray-600'}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      {enabled && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Shutter Speed', key: `${prefix}_shutter`, options: SHUTTER_OPTIONS },
            { label: 'Aperture', key: `${prefix}_aperture`, options: APERTURE_OPTIONS },
            { label: 'ISO', key: `${prefix}_iso`, options: ISO_OPTIONS },
          ].map(field => (
            <div key={field.key}>
              <label className="text-xs text-gray-400 block mb-1">{field.label}</label>
              <select
                value={form[field.key]}
                onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1.5"
              >
                {field.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Rigs() {
  const { isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [rigInput, setRigInput] = useState('');

  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rigSettings'] });

  const handleSave = async () => {
    if (!form.team) return;
    if (editingId) {
      await base44.entities.RigSetting.update(editingId, form);
    } else {
      await base44.entities.RigSetting.create(form);
    }
    setForm(emptyForm);
    setEditingId(null);
    setIsAdding(false);
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.RigSetting.delete(id);
    refresh();
  };

  const startEdit = (rig) => {
    setEditingId(rig.id);
    setForm({ ...emptyForm, ...rig });
    setIsAdding(true);
    setExpandedId(null);
  };

  const addRig = () => {
    if (!rigInput.trim()) return;
    setForm({ ...form, remote_rigs: [...(form.remote_rigs || []), rigInput.trim()] });
    setRigInput('');
  };

  const removeRig = (i) => {
    setForm({ ...form, remote_rigs: form.remote_rigs.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Rig Settings</h1>
            <p className="text-gray-400 text-sm mt-1">Team-based camera and rig configurations</p>
          </div>
          {isAdmin && !isAdding && (
            <Button onClick={() => { setIsAdding(true); setEditingId(null); setForm(emptyForm); }} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> New Rig Setting
            </Button>
          )}
        </div>

        {/* Form */}
        {isAdmin && isAdding && (
          <Card className="bg-gray-900 border-blue-700 mb-8">
            <CardHeader className="border-b border-gray-800 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-base">{editingId ? 'Edit Rig Setting' : 'New Rig Setting'}</CardTitle>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white" onClick={() => { setIsAdding(false); setEditingId(null); setForm(emptyForm); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Team Name *" value={form.team} onChange={e => setForm({ ...form, team: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                <Select value={form.sport} onValueChange={v => setForm({ ...form, sport: v })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue placeholder="Sport" /></SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {SPORTS.map(s => <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={form.venue_type} onValueChange={v => setForm({ ...form, venue_type: v })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="Indoor" className="text-white">Indoor</SelectItem>
                    <SelectItem value="Outdoor" className="text-white">Outdoor</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.rig_type || 'Data'} onValueChange={v => setForm({ ...form, rig_type: v })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue placeholder="Rig Type" /></SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {RIG_TYPES.map(t => <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Shoot plan */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Shoot Plan</label>
                <textarea
                  value={form.shoot_plan}
                  onChange={e => setForm({ ...form, shoot_plan: e.target.value })}
                  placeholder="Describe the shoot plan..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-500 resize-none"
                />
              </div>

              {/* Remote Rigs */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Remote Rigs (Google Remote Names)</label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="e.g. RemotePC-01"
                    value={rigInput}
                    onChange={e => setRigInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addRig()}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                  <Button type="button" onClick={addRig} size="sm" className="bg-blue-600 hover:bg-blue-700">Add</Button>
                </div>
                {form.remote_rigs?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.remote_rigs.map((r, i) => (
                      <span key={i} className="flex items-center gap-1 bg-blue-900/40 text-blue-300 border border-blue-700/40 text-sm px-2 py-1 rounded-full">
                        {r}
                        <button type="button" onClick={() => removeRig(i)} className="hover:text-red-400 ml-1">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Camera toggles */}
              <div className="space-y-3">
                <label className="text-xs text-gray-400 uppercase tracking-wider block">Camera Settings</label>
                <CameraSection label="📷 HD Camera" enabled={form.hd_camera} onToggle={() => setForm({ ...form, hd_camera: !form.hd_camera })} form={form} setForm={setForm} prefix="hd" />
                <CameraSection label="🔭 Wide Camera" enabled={form.wide_camera} onToggle={() => setForm({ ...form, wide_camera: !form.wide_camera })} form={form} setForm={setForm} prefix="wide" />
                <CameraSection label="⚠️ Attention Camera" enabled={form.attention_camera} onToggle={() => setForm({ ...form, attention_camera: !form.attention_camera })} form={form} setForm={setForm} prefix="attention" />

                {/* Sound toggle */}
                <div className={`rounded-lg border p-3 ${form.sound ? 'border-green-700 bg-green-950/20' : 'border-gray-700 bg-gray-800/20'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">🔊 Sound</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, sound: !form.sound })}
                      className={`w-11 h-6 rounded-full transition-colors relative ${form.sound ? 'bg-green-600' : 'bg-gray-600'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${form.sound ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-500 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                  {editingId ? 'Save Changes' : 'Create Rig Setting'}
                </Button>
                <Button variant="outline" onClick={() => { setIsAdding(false); setEditingId(null); setForm(emptyForm); }} className="border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settings list */}
        <div className="space-y-3">
          {rigSettings.map(rig => (
            <Card key={rig.id} className="bg-gray-900 border-gray-800">
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === rig.id ? null : rig.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedId === rig.id ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                  <div>
                    <p className="font-semibold text-white">{rig.team}</p>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{rig.sport}</span>
                      <span className="text-xs text-gray-600">·</span>
                      <span className="text-xs text-gray-400">{rig.venue_type}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {rig.hd_camera && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">HD</Badge>}
                    {rig.wide_camera && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Wide</Badge>}
                    {rig.attention_camera && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">Attention</Badge>}
                    {rig.sound && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">🔊</Badge>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white hover:bg-gray-800" onClick={() => startEdit(rig)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-red-400 hover:bg-gray-800" onClick={() => handleDelete(rig.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {expandedId === rig.id && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-4">
                  {rig.remote_rigs?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Remote Rigs</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rig.remote_rigs.map((r, i) => (
                          <span key={i} className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700/40 px-2 py-0.5 rounded-full">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {rig.shoot_plan && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Shoot Plan</p>
                      <p className="text-sm text-gray-300">{rig.shoot_plan}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {[
                      { label: '📷 HD Camera', on: rig.hd_camera, s: rig.hd_shutter, a: rig.hd_aperture, iso: rig.hd_iso },
                      { label: '🔭 Wide Camera', on: rig.wide_camera, s: rig.wide_shutter, a: rig.wide_aperture, iso: rig.wide_iso },
                      { label: '⚠️ Attention Camera', on: rig.attention_camera, s: rig.attention_shutter, a: rig.attention_aperture, iso: rig.attention_iso },
                    ].map(cam => (
                      <div key={cam.label} className={`flex items-center gap-3 rounded p-2 ${cam.on ? 'bg-blue-950/20' : 'bg-gray-800/30'}`}>
                        <span className="text-xs font-medium text-gray-300 w-36">{cam.label}</span>
                        {cam.on ? (
                          <div className="flex gap-3 text-xs text-gray-400">
                            <span>⏱ {cam.s}</span>
                            <span>🔲 {cam.a}</span>
                            <span>💡 {cam.iso}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">OFF</span>
                        )}
                      </div>
                    ))}
                    <div className={`flex items-center gap-3 rounded p-2 ${rig.sound ? 'bg-green-950/20' : 'bg-gray-800/30'}`}>
                      <span className="text-xs font-medium text-gray-300 w-36">🔊 Sound</span>
                      <span className={`text-xs font-bold ${rig.sound ? 'text-green-400' : 'text-gray-600'}`}>{rig.sound ? 'YES' : 'NO'}</span>
                    </div>
                  </div>
                  {rig.notes && <p className="text-sm text-gray-400 italic">{rig.notes}</p>}
                </div>
              )}
            </Card>
          ))}
        </div>

        {rigSettings.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-5xl mb-4">⚙️</p>
            <p>No rig settings yet. Add your first team configuration.</p>
          </div>
        )}
      </div>
    </div>
  );
}