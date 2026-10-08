import React from 'react';
import { Monitor } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  CRD_GOOGLE_ACCOUNT_KEY,
  isAndroidUserAgent,
  normalizeRemoteRigs,
  remoteRigLaunchHref,
} from '@/utils/remoteRigs';

export default function RemoteRigButtons({ remotes, className = '' }) {
  const { appPublicSettings } = useAuth();
  const account = appPublicSettings?.public_settings?.[CRD_GOOGLE_ACCOUNT_KEY] || '';
  const android = isAndroidUserAgent();
  const items = normalizeRemoteRigs(remotes);
  if (!items.length) return null;

  return (
    <div className={`relative z-10 flex flex-wrap gap-1.5 pointer-events-auto ${className}`}>
      {items.map((item, index) => {
        const href = remoteRigLaunchHref(item, { account, android });
        if (!href) {
          return (
            <span
              key={`${item.name}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300"
              title="Add a Chrome Remote Desktop link in this team’s rig settings"
            >
              <Monitor className="h-3 w-3 text-slate-500" />
              {item.name}
            </span>
          );
        }
        return (
          <a
            key={`${item.name}-${index}`}
            href={href}
            {...(android
              ? {}
              : { target: '_blank', rel: 'noopener' })}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-orange-700/60 bg-orange-950/40 px-2.5 py-1.5 text-xs font-semibold text-orange-200 hover:bg-orange-950/70 hover:text-orange-50 cursor-pointer"
            title={`Open Chrome Remote Desktop app — ${item.name}`}
          >
            <Monitor className="h-3 w-3" />
            {item.name}
          </a>
        );
      })}
    </div>
  );
}
