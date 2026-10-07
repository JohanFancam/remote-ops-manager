import React from 'react';
import { useAuth } from '@/lib/AuthContext';

export const DEFAULT_APP_LOGO = '/rom-logo.png';
export const ROM_BRAND_BLUE = '#01184D';
export const ROM_CANVAS = '#1f2021';
export const ROM_SURFACE = '#292a2a';

export function resolveAppLogoUrl(customUrl) {
  const url = String(customUrl || '').trim();
  return url || DEFAULT_APP_LOGO;
}

export default function BrandMark({
  className = 'h-9 w-9',
  logoUrl,
  alt = 'Remote Ops Manager',
}) {
  const { appPublicSettings } = useAuth();
  const publicLogo = appPublicSettings?.public_settings?.app_logo_url;
  const src = resolveAppLogoUrl(logoUrl ?? publicLogo);
  return (
    <div className={`relative flex-shrink-0 overflow-hidden rounded-xl ${className}`}>
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}
