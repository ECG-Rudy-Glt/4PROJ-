import type { DesktopApi } from '../shared/types';

declare global {
  interface Window {
    supfile: DesktopApi;
  }
}

export {};
