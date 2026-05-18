import { useEffect } from 'react';

function isMobile(): boolean {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

export function useMobileRedirect() {
  useEffect(() => {
    if (isMobile()) {
      window.location.replace('supfile://');
    }
  }, []);
}
