import { useColorScheme } from 'react-native';
import { colors } from './colors';
import { useThemeStore } from '../stores/useThemeStore';

const darkColors = {
  ...colors,
  white: '#1F2937',
  bg: {
    primary: '#111827',
    secondary: '#1F2937',
    tertiary: '#254441',
  },
  neutral: {
    50: '#374151',
    100: '#374151',
    200: '#4B5563',
    300: '#6B7280',
    400: '#9CA3AF',
    500: '#D1D5DB',
    600: '#E5E7EB',
    700: '#F3F4F6',
    800: '#F9FAFB',
    900: '#FFFFFF',
  },
};

export function useColors() {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();

  const isDark =
    mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  return isDark ? darkColors : colors;
}

export function useIsDark() {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  return mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
}
