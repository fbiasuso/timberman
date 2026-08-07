import { useEffect, useState } from 'react';

/** Breakpoint at which the cartelera match cards switch to the stacked layout. */
const MOBILE_QUERY = '(max-width: 640px)';

function matchesMobileQuery(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MOBILE_QUERY).matches;
}

/**
 * Tracks the mobile viewport via matchMedia and reacts to resize/orientation
 * changes. Falls back to desktop (false) when matchMedia is unavailable,
 * e.g. during SSR or in test environments that do not implement it.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(matchesMobileQuery);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    media.addEventListener('change', handleChange);
    setIsMobile(media.matches);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
