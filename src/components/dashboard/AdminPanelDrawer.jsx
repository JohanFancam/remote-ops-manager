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
        "fixed top-0 right-0 z-50 h-full bg-gray-900 border-l border-gray-800 flex flex-col shadow-2xl overflow-hidden transition-all",
        wide ? "w-full md:w-[720px]" : "w-full md:w-[520px]"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-white font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg p-1.5 transition-colors"
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