import { useColorScheme } from 'react-native';
import { colors } from './colors';
import { useThemeStore } from '../stores/useThemeStore';

export const darkColors = {
  ...colors,
  primary: {
    50:  '#0D2320',
    100: '#122E2A',
    200: '#1B4641',
    300: '#255D57',
    400: '#347872',
    500: '#4A9E96',
    600: '#5CBDB5',  // plus clair en dark → CTAs visibles
    700: '#7CCEC8',
    800: '#A5DDD9',
    900: '#D0EDEB',
  },
  accent: {
    warm:     '#E8957A',
    warmDark: '#F0B09A',
    bright:   '#F0CC60',
    brightDark:'#F7DC80',
  },
  bg: {
    primary:   '#0F1117',  // fond principal — très sombre
    secondary: '#161C26',  // fond listes/sections
    tertiary:  '#0D2320',  // fond accent teal
  },
  white: '#1A2130',        // surface card/modal
  black: '#000000',
  neutral: {
    50:  '#1C2333',  // fond input
    100: '#232B3E',  // bordure subtile
    200: '#2D3A50',  // bordure
    300: '#3D4D66',  // éléments désactivés
    400: '#6B7A94',  // placeholder
    500: '#8B9BB4',  // texte secondaire
    600: '#BDC8D9',  // texte courant
    700: '#D8E1ED',  // texte fort
    800: '#ECF0F6',  // titres
    900: '#F5F8FF',  // texte primaire
  },
  bgDark: {
    primary:   '#0F1117',
    secondary: '#161C26',
    tertiary:  '#254441',
  },
  success: '#34D399',
  error:   '#F87171',
  warning: '#FBBF24',
  info:    '#818CF8',
};

export type AppColors = typeof darkColors;

export function useColors(): AppColors {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  return isDark ? darkColors : (colors as unknown as AppColors);
}

export function useIsDark(): boolean {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();
  return mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
}
