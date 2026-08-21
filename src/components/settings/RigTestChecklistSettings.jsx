import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FlaskConical, Plus, Trash2, Save, GripVertical } from 'lucide-react';

export default function RigTestChecklistSettings({ appSettings }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const val = appSettings.find(s => s.key === 'rig_test_checklist')?.value;
    if (val) {
      try { setItems(JSON.parse(val)); } catch { /* ignore */ }
    } else {
      setItems([
        'Power on all rigs and confirm boot',
        'Check network / remote connectivity',
        'Verify camera feeds (HD + Wide)',
        'Test audio / sound recording',
        'Confirm rig type settings match team profile',
        'Review storage / SD cards',
        'Check battery levels',
      ]);
    }
  }, [appSettings]);

  const handleSave = async () => {
    const key = 'rig_test_checklist';
    const value = JSON.stringify(items);
    const existing = appSettings.find(s => s.key === key);
    if (existing) {
      await base44.entities.AppSettings.update(existing.id, { value });
    } else {
      await base44.entities.AppSettings.create({ key, value, description: 'Default rig test checklist items' });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems(prev => [...prev, newItem.trim()]);
    setNewItem('');
  };

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const moveItem = (idx, dir) => {
    const newItems = [...items];
    const target = idx + dir;
    if (target < 0 || target >= newItems.length) return;
    [newItems[idx], newItems[target]] = [newItems[target], newItems[idx]];
    setItems(newItems);
  };

  return (
    <Card className="bg-white border-zinc-200 mb-6">
      <CardHeader className="border-b border-zinc-200 pb-4">
        <CardTitle className="text-zinc-900 flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-teal-400" /> Rig Test Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className="text-xs text-zinc-400">
          These items will be pre-loaded whenever a rig test is assigned from the calendar or dashboard.
        </p>

        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-zinc-100/60 rounded-lg px-3 py-2">
              <div className="flex flex-col gap-0.5 mr-1">
                <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-gray-600 hover:text-zinc-600 disabled:opacity-20 leading-none">▲</button>
                <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="text-gray-600 hover:text-zinc-600 disabled:opacity-20 leading-none">▼</button>
              </div>
              <span className="text-sm text-zinc-600 flex-1">{idx + 1}. {item}</span>
              <button onClick={() => removeItem(idx)} className="text-gray-600 hover:text-red-600 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
            placeholder="Add checklist item…"
            className="bg-zinc-100 border-zinc-200 text-zinc-900 text-sm placeholder:text-zinc-400"
          />
          <Button size="sm" variant="outline" className="border-zinc-200 text-zinc-600 hover:bg-zinc-100 px-3" onClick={addItem}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button onClick={handleSave} className="bg-teal-700 hover:bg-teal-600 gap-2">
          <Save className="h-4 w-4" /> {saved ? '✓ Saved!' : 'Save Checklist'}
        </Button>
      </CardContent>
    </Card>
  );
}