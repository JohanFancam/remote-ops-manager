import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Info, Plus, Trash2, Upload, Edit2, Save, X, BookOpen } from 'lucide-react';

const TYPE_CONFIG = {
  do: { label: '✅ DO', color: 'bg-green-500/20 text-emerald-700 border-green-500/30', border: 'border-emerald-200', badge: 'border-green-600' },
  dont: { label: '❌ DON\'T', color: 'bg-red-500/20 text-red-600 border-red-200', border: 'border-red-700/40', badge: 'border-red-600' },
  info: { label: 'ℹ️ INFO', color: 'bg-teal-600/20 text-teal-700 border-teal-200', border: 'border-teal-200', badge: 'border-teal-700' },
};

function ImageCard({ item, isAdmin, onDelete, onEdit }) {
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
  return (
    <Card className={`bg-white border ${cfg.border} overflow-hidden`}>
      <div className="relative">
        <img src={item.image_url} alt={item.title} className="w-full h-48 object-cover" />
        <div className="absolute top-2 left-2">
          <Badge className={`text-xs border ${cfg.color} font-bold`}>{cfg.label}</Badge>
        </div>
        {isAdmin && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button onClick={() => onEdit(item)} className="bg-white hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 rounded p-1.5">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onDelete(item.id)} className="bg-white hover:bg-red-900/60 text-zinc-600 hover:text-red-600 rounded p-1.5">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <CardContent className="p-3">
        {item.category && (
          <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">{item.category}</p>
        )}
        <p className="text-sm font-semibold text-zinc-900 mb-1">{item.title}</p>
        {item.description && (
          <p className="text-xs text-zinc-500 leading-relaxed">{item.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

const BLANK_FORM = { title: '', description: '', type: 'info', category: '', sort_order: 0, image_url: '' };

export default function ReferenceGuide() {
  const { isAdmin } = useApp();
  const queryClient = useQueryClient();
  const fileInputRef = useRef();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [saving, setSaving] = useState(false);

  const { data: images = [] } = useQuery({
    queryKey: ['referenceImages'],
    queryFn: () => base44.entities.ReferenceImage.list('sort_order', 200),
  });

  const categories = ['all', ...Array.from(new Set(images.map(i => i.category).filter(Boolean)))];

  const filtered = images.filter(i => {
    const typeMatch = filterType === 'all' || i.type === filterType;
    const catMatch = filterCat === 'all' || i.category === filterCat;
    return typeMatch && catMatch;
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, image_url: file_url }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title || !form.image_url) return;
    setSaving(true);
    if (editingId) {
      await base44.entities.ReferenceImage.update(editingId, form);
    } else {
      await base44.entities.ReferenceImage.create(form);
    }
    setSaving(false);
    setForm(BLANK_FORM);
    setEditingId(null);
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['referenceImages'] });
  };

  const handleEdit = (item) => {
    setForm({ title: item.title, description: item.description || '', type: item.type || 'info', category: item.category || '', sort_order: item.sort_order || 0, image_url: item.image_url });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await base44.entities.ReferenceImage.delete(id);
    queryClient.invalidateQueries({ queryKey: ['referenceImages'] });
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BookOpen className="h-7 w-7 text-teal-700" /> Reference Guide
            </h1>
            <p className="text-zinc-500 mt-1 text-sm">Visual setup reference — what to do and what not to do.</p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setForm(BLANK_FORM); setEditingId(null); setShowForm(!showForm); }}
              className="bg-teal-700 hover:bg-teal-700 gap-2">
              <Plus className="h-4 w-4" /> Add Image
            </Button>
          )}
        </div>

        {/* Upload form — admin only */}
        {isAdmin && showForm && (
          <Card className="bg-white border-zinc-200 mb-6">
            <CardContent className="pt-5 space-y-4">
              <p className="text-sm font-semibold text-zinc-900">{editingId ? 'Edit Image' : 'Add Reference Image'}</p>

              {/* Image upload */}
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                {form.image_url ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border border-zinc-200">
                    <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />
                    <button onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                      className="absolute top-2 right-2 bg-white rounded p-1 text-zinc-600 hover:text-zinc-900">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-zinc-200 rounded-lg flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-teal-700 hover:text-teal-700 transition-colors">
                    <Upload className="h-6 w-6" />
                    <span className="text-sm">{uploading ? 'Uploading...' : 'Click to upload image'}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="bg-zinc-100 border-zinc-200 text-zinc-900 placeholder:text-zinc-400" />
                <Input placeholder="Category (e.g. Camera Setup)" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="bg-zinc-100 border-zinc-200 text-zinc-900 placeholder:text-zinc-400" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="bg-zinc-100 border border-zinc-200 text-zinc-900 rounded-md px-3 py-2 text-sm">
                  <option value="do">✅ DO — Correct way</option>
                  <option value="dont">❌ DON'T — Avoid this</option>
                  <option value="info">ℹ️ INFO — General reference</option>
                </select>
                <Input type="number" placeholder="Sort order (0=first)" value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  className="bg-zinc-100 border-zinc-200 text-zinc-900 placeholder:text-zinc-400" />
              </div>

              <Textarea placeholder="Description — explain what this image shows" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="bg-zinc-100 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 text-sm min-h-[80px]" />

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving || !form.title || !form.image_url}
                  className="bg-teal-700 hover:bg-teal-700 gap-2">
                  <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="ghost" className="text-zinc-500 hover:text-zinc-900" onClick={() => { setShowForm(false); setEditingId(null); }}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['all', 'do', 'dont', 'info'].map(t => (
            <button key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === t ? 'bg-teal-700 text-white' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}>
              {t === 'all' ? 'All' : TYPE_CONFIG[t]?.label}
            </button>
          ))}
          {categories.length > 1 && (
            <div className="flex gap-1 ml-2 flex-wrap">
              {categories.map(c => (
                <button key={c}
                  onClick={() => setFilterCat(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filterCat === c ? 'bg-gray-600 text-zinc-900' : 'bg-zinc-100/60 text-zinc-400 hover:text-zinc-900'}`}>
                  {c === 'all' ? 'All Categories' : c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="h-12 w-12 text-gray-700 mx-auto mb-3" />
            <p className="text-zinc-400">
              {images.length === 0
                ? isAdmin ? 'No reference images yet. Click "Add Image" to get started.' : 'No reference images have been added yet.'
                : 'No images match the current filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(item => (
              <ImageCard key={item.id} item={item} isAdmin={isAdmin} onDelete={handleDelete} onEdit={handleEdit} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}