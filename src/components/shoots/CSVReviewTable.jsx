import React from 'react';
import { Check, X } from 'lucide-react';

export default function CSVReviewTable({ reviews, decisions, onChange, onAddAll, onSkipAll }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-amber-300">
          ⚠ {reviews.length} row(s) match an existing team but have a different date or time — review each.
        </p>
        <div className="flex gap-2">
          <button onClick={onAddAll} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-green-700/50 text-green-400 hover:bg-green-900/30">
            <Check className="h-3 w-3" /> Add All
          </button>
          <button onClick={onSkipAll} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800">
            <X className="h-3 w-3" /> Skip All
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-700">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-800 text-gray-400">
            <tr className="border-b border-gray-700">
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">CSV Date</th>
              <th className="text-left p-2">CSV Time</th>
              <th className="text-left p-2">Existing</th>
              <th className="text-left p-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {reviews.map(r => (
              <tr key={r.idx} className="text-gray-300">
                <td className="p-2 truncate max-w-[200px]" title={r.title}>{r.title}</td>
                <td className="p-2 whitespace-nowrap">{r.row.date}</td>
                <td className="p-2 whitespace-nowrap">{r.gameTime || '—'}</td>
                <td className="p-2 whitespace-nowrap text-gray-500">
                  {r.existingDate || '—'}{r.existingTime ? ` @ ${r.existingTime}` : ''}
                </td>
                <td className="p-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => onChange(r.idx, 'add')}
                      className={`px-2 py-0.5 rounded text-xs ${decisions[r.idx] === 'add' ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >Add</button>
                    <button
                      onClick={() => onChange(r.idx, 'skip')}
                      className={`px-2 py-0.5 rounded text-xs ${decisions[r.idx] === 'skip' ? 'bg-gray-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >Skip</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}