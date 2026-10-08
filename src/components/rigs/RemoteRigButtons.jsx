import React from 'react';
import { Monitor } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  CRD_GOOGLE_ACCOUNT_KEY,
  CRD_WINDOW_NAME,
  isAndroidUserAgent,
  isStandaloneDisplay,
  normalizeRemoteRigs,
  openRemoteRig,
  remoteRigLaunchHref,
} from '@/utils/remoteRigs';

export default function RemoteRigButtons({ remotes, className = '' }) {
  const { appPublicSettings } = useAuth();
  const account = appPublicSettings?.public_settings?.[CRD_GOOGLE_ACCOUNT_KEY] || '';
  const items = normalizeRemoteRigs(remotes);
  if (!items.length) return null;

  return (
    <div className={`relative z-10 flex flex-wrap gap-1.5 pointer-events-auto ${className}`}>
      {items.map((item, index) => {
        const href = remoteRigLaunchHref(item, { account });
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
            target={CRD_WINDOW_NAME}
            rel="noopener noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              // Desktop Chrome: keep the native <a> so remotedesktop.google.com
              // can hand off to the installed Chrome Remote Desktop app.
              // The installed PWA still needs window.open (target=_blank leaves
              // the OS default / already-open browser).
              if (!isStandaloneDisplay() || isAndroidUserAgent()) return;
              e.preventDefault();
              openRemoteRig(item, { account });
            }}
            className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-orange-700/60 bg-orange-950/40 px-2.5 py-1.5 text-xs font-semibold text-orange-200 hover:bg-orange-950/70 hover:text-orange-50 cursor-pointer"
            title={`Open Chrome Remote Desktop — ${item.name}`}
          >
            <Monitor className="h-3 w-3" />
            {item.name}
          </a>
        );
      })}
    </div>
  );
}
