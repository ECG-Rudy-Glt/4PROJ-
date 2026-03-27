/**
 * SUPFILE Mobile — Design tokens (miroir du Tailwind config web)
 */

export const colors = {
  // ── Primary (green-teal) ──────────────────────────────
  primary: {
    50: '#e6f2f1',
    100: '#b3dbd8',
    200: '#80c4be',
    300: '#5A9A94',
    400: '#478078',
    500: '#3A6B66',
    600: '#254441',
    700: '#1d3633',
    800: '#162826',
    900: '#0f1a19',
  },

  // ── Accent ────────────────────────────────────────────
  accent: {
    warm: '#D4785C',
    warmDark: '#E8A088',
    bright: '#E8B84A',
    brightDark: '#F0C96B',
  },

  // ── Neutrals (gray scale) ────────────────────────────
  neutral: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // ── Backgrounds ──────────────────────────────────────
  bg: {
    primary: '#FFFFFF',
    secondary: '#F5F3EF',
    tertiary: '#e6f2f1',
  },
  bgDark: {
    primary: '#1a1a1a',
    secondary: '#2D2D2D',
    tertiary: '#254441',
  },

  // ── Semantic ─────────────────────────────────────────
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#6366F1',

  // ── Base ─────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type Colors = typeof colors;
