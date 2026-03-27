import { TextStyle, Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;

export const fontWeight: Record<string, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const typography: Record<string, TextStyle> = {
  h1: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, fontFamily },
  h2: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, fontFamily },
  h3: { fontSize: fontSize.xl, fontWeight: fontWeight.semibold, fontFamily },
  h4: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, fontFamily },
  body: { fontSize: fontSize.base, fontWeight: fontWeight.regular, fontFamily },
  bodySmall: { fontSize: fontSize.sm, fontWeight: fontWeight.regular, fontFamily },
  caption: { fontSize: fontSize.xs, fontWeight: fontWeight.regular, fontFamily },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, fontFamily },
  button: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, fontFamily },
};
