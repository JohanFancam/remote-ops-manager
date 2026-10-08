import { useEffect } from 'react';
import { resolveAppLogoUrl } from './BrandMark';

export default function AppIconHead({ logoUrl }) {
  const href = resolveAppLogoUrl(logoUrl);

  useEffect(() => {
    const ensure = (rel) => {
      let link = document.head.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
    };
    ensure('icon');
    ensure('apple-touch-icon');
  }, [href]);

  return null;
}
