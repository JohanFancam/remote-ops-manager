import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function SettingsCategory({
  title,
  description,
  icon: Icon,
  children,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-3">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-left hover:border-slate-700 hover:bg-slate-800/60 transition-colors"
        >
          <span className="flex items-start gap-3 min-w-0">
            {Icon && (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-orange-400">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-100">{title}</span>
              {description && (
                <span className="block text-xs text-slate-500 mt-0.5">{description}</span>
              )}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-3 space-y-4 [&>*]:mb-0">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
