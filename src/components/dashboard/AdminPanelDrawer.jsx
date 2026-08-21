import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminPanelDrawer({ title, open, onClose, children, wide = false }) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className={cn(
        "fixed top-0 right-0 z-50 h-full bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl overflow-hidden transition-all",
        wide ? "w-full md:w-[720px]" : "w-full md:w-[520px]"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="text-zinc-100 font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg p-1.5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </>
  );
}