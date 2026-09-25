import React, { useEffect } from 'react';
import { DEFAULT_APP_LOGO, ROM_BRAND_BLUE } from '@/components/brand/BrandMark';

export default function AppSplash({ logoUrl }) {
  useEffect(() => {
    document.documentElement.classList.remove('rom-ready');
    return () => {
      document.documentElement.classList.add('rom-ready');
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: ROM_BRAND_BLUE }}
    >
      <img
        src={logoUrl || DEFAULT_APP_LOGO}
        alt="Remote Ops Manager"
        className="h-40 w-40 object-contain sm:h-44 sm:w-44"
      />
    </div>
  );
}
