import React from 'react';
import { DEFAULT_APP_LOGO, ROM_BRAND_BLUE } from '@/components/brand/BrandMark';

export default function AppSplash({ logoUrl }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: ROM_BRAND_BLUE }}
    >
      <img
        src={logoUrl || DEFAULT_APP_LOGO}
        alt="Remote Ops Manager"
        className="h-28 w-28 object-contain"
      />
    </div>
  );
}
