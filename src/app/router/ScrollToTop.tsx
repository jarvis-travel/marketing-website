import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  // A link with a #fragment lands on that element (Home's "How we use AI" goes to
  // /data-security#ai, JAR-4464); every other route change starts at the top.
  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname, hash]);

  return null;
}
