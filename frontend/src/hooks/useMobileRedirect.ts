import { useEffect } from 'react';

export function isMobileBrowser(): boolean {
  const userAgent = navigator.userAgent || navigator.vendor || '';
  const isIPadOS = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  return isIPadOS || /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
}

export function useMobileRedirect() {
  useEffect(() => {
    if (isMobileBrowser()) {
      window.location.replace('/mobile');
    }
  }, []);
}
