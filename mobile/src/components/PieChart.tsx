import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: PieSlice[];
  size?: number;
}

function buildSvg(slices: PieSlice[], size: number): string {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return '';
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const ir = r * 0.58; // inner radius for donut

  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const pt = (angle: number, radius: number) =>
    `${cx + radius * Math.cos(toRad(angle))},${cy + radius * Math.sin(toRad(angle))}`;

  let current = 0;
  const paths = slices.map((slice) => {
    const start = (current / total) * 360;
    current += slice.value;
    const end = (current / total) * 360;
    const large = end - start > 180 ? 1 : 0;
    const d = [
      `M ${pt(start, r)}`,
      `A ${r} ${r} 0 ${large} 1 ${pt(end, r)}`,
      `L ${pt(end, ir)}`,
      `A ${ir} ${ir} 0 ${large} 0 ${pt(start, ir)}`,
      'Z',
    ].join(' ');
    return `<path d="${d}" fill="${slice.color}" />`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths.join('')}</svg>`;
}

export default function PieChart({ slices, size = 160 }: Props) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const svg = buildSvg(slices, size);
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent;}</style></head><body>${svg}</body></html>`;

  return (
    <View style={styles.wrapper}>
      <WebView
        style={{ width: size, height: size, backgroundColor: 'transparent' }}
        source={{ html }}
        scrollEnabled={false}
        pointerEvents="none"
        originWhitelist={['*']}
        backgroundColor="transparent"
      />
      <View style={styles.legend}>
        {slices.map((s) => (
          <View key={s.label} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>{s.label}</Text>
            <Text style={styles.legendValue}>{s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    fontSize: 12,
    color: '#52525b',
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3f3f46',
  },
});
