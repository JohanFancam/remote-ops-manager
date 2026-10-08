import React, { useEffect } from 'react';
import { resolveAppLogoUrl } from '@/components/brand/BrandMark';
import { readCachedTheme } from '@/utils/theme';

export default function AppSplash({ logoUrl, canvas }) {
  const cached = readCachedTheme();
  const background = canvas || cached.canvas;
  const src = resolveAppLogoUrl(logoUrl || cached.logo);

  useEffect(() => {
    document.documentElement.classList.remove('rom-ready');
    return () => {
      document.documentElement.classList.add('rom-ready');
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: background }}
      data-testid="app-splash"
    >
      <img
        src={src}
        alt="Remote Ops Manager"
        className="h-24 w-24 object-contain sm:h-28 sm:w-28"
      />
    </div>
  );
}
