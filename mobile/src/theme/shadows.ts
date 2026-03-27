import { ViewStyle, Platform } from 'react-native';

type Shadow = Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>;

const shadow = (
  offsetY: number,
  radius: number,
  opacity: number,
  elevation: number,
): Shadow => ({
  shadowColor: '#000',
  shadowOffset: { width: 0, height: offsetY },
  shadowOpacity: opacity,
  shadowRadius: radius,
  ...Platform.select({ android: { elevation } }),
});

export const shadows = {
  sm: shadow(1, 2, 0.05, 1),
  md: shadow(2, 4, 0.1, 3),
  lg: shadow(4, 8, 0.12, 6),
  xl: shadow(6, 12, 0.15, 10),
  '2xl': shadow(10, 20, 0.2, 16),
} as const;
