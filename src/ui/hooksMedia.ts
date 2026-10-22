import { useSyncExternalStore } from 'react';

/** Matches the CSS breakpoint used for the phone layout. */
export const MOBILE_QUERY = '(max-width: 900px)';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
