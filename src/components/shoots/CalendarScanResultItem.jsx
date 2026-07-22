import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, X, Check } from 'lucide-react';

export default function CalendarScanResultItem({ item, onChange, onAdd, onUpdate, onSkip }) {
  return (
    <div className={`rounded-lg border p-3 ${
      item.status === 'done' ? 'border-green-700/50 bg-green-950/15' :
      item.status === 'skipped' ? 'border-gray-800 bg-gray-950/40 opacity-50' :
      'border-gray-800 bg-gray-950/40'
    }`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
          item.type === 'new' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
        }`}>
          {item.type === 'new' ? 'New Game' : 'Time/Date Changed'}
        </span>
        {item.status === 'done' && <span className="text-xs text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /> Applied</span>}
        {item.status === 'skipped' && <span className="text-xs text-gray-500">Skipped</span>}
      </div>

      {item.type === 'changed' && (
        <p className="text-xs text-gray-500 mb-2">
          App: {item.shoot.date} {item.shoot.game_time || '—'} &nbsp;→&nbsp; Calendar: {item.event.date} {item.event.time || '—'}
        </p>
      )}

      {item.status === 'pending' && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Input
              value={item.form.title}
              onChange={(e) => onChange(item.key, 'title', e.target.value)}
              disabled={item.type === 'changed'}
              placeholder="Title"
              className="bg-gray-900 border-gray-700 text-white text-sm col-span-2"
            />
            <Input type="date" value={item.form.date} onChange={(e) => onChange(item.key, 'date', e.target.value)} className="bg-gray-900 border-gray-700 text-white text-sm" />
            <Input type="time" value={item.form.game_time} onChange={(e) => onChange(item.key, 'game_time', e.target.value)} className="bg-gray-900 border-gray-700 text-white text-sm" />
          </div>
          <div className="flex gap-2">
            {item.type === 'new' ? (
              <Button size="sm" onClick={() => onAdd(item)} className="bg-blue-600 hover:bg-blue-700 text-xs h-7">
                <Plus className="h-3 w-3 mr-1" /> Add Shoot
              </Button>
            ) : (
              <Button size="sm" onClick={() => onUpdate(item)} className="bg-yellow-600 hover:bg-yellow-700 text-xs h-7">
                <RefreshCw className="h-3 w-3 mr-1" /> Update Shoot
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onSkip(item)} className="border-gray-700 text-gray-400 hover:bg-gray-800 text-xs h-7">
              <X className="h-3 w-3 mr-1" /> Skip
            </Button>
          </div>
        </>
      )}
    </div>
  );
}