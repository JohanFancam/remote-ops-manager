import React from 'react';
import { Monitor } from 'lucide-react';
import {
  formatRemoteDueLabel,
  isRemoteDisabled,
  normalizeRemoteRigs,
} from '@/utils/remoteRigs';

export default function RemoteRigButtons({ remotes, className = '' }) {
  const items = normalizeRemoteRigs(remotes);
  if (!items.length) return null;

  return (
    <div className={`relative z-10 flex flex-wrap gap-1.5 pointer-events-auto ${className}`}>
      {items.map((item, index) => {
        const disabled = isRemoteDisabled(item);
        const dueLabel = formatRemoteDueLabel(item.due_date);
        const title = disabled
          ? `${item.name} is unavailable${dueLabel ? ` — due ${dueLabel}` : ''}. Do not log into this rig.`
          : item.name;
        return (
          <span
            key={`${item.name}-${index}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className={
              disabled
                ? 'relative z-10 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-500 cursor-default'
                : 'relative z-10 inline-flex items-center gap-1.5 rounded-full border border-orange-700/60 bg-orange-950/40 px-2.5 py-1.5 text-xs font-semibold text-orange-200 cursor-default'
            }
            title={title}
          >
            <Monitor className={`h-3 w-3 ${disabled ? 'text-slate-500' : ''}`} />
            {item.name}
            {disabled && dueLabel ? (
              <span className="font-normal text-[10px] text-slate-500">due {dueLabel}</span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
