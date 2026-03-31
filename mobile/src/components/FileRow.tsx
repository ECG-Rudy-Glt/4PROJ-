import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { FileItem } from '../types';

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const getCategoryIcon = (mimeType: string): keyof typeof Ionicons.glyphMap => {
  if (mimeType.startsWith('image/')) return 'image-outline';
  if (mimeType.startsWith('video/')) return 'videocam-outline';
  if (mimeType.startsWith('audio/')) return 'musical-notes-outline';
  if (mimeType.includes('pdf')) return 'document-text-outline';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return 'archive-outline';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'grid-outline';
  return 'document-outline';
};

const getCategoryColor = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return '#3B82F6';
  if (mimeType.startsWith('video/')) return '#8B5CF6';
  if (mimeType.startsWith('audio/')) return '#EC4899';
  if (mimeType.includes('pdf')) return '#EF4444';
  return colors.primary[500];
};

interface Props {
  file: FileItem;
  onPress?: () => void;
  onLongPress?: () => void;
  showFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export default function FileRow({ file, onPress, onLongPress, showFavorite, onToggleFavorite }: Props) {
  const iconColor = getCategoryColor(file.mimeType);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${iconColor}15` }]}>
        <Ionicons name={getCategoryIcon(file.mimeType)} size={20} color={iconColor} />
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{file.name}</Text>
        <Text style={styles.meta}>
          {formatSize(file.size)} · {formatDate(file.updatedAt)}
        </Text>
      </View>

      {showFavorite && (
        <TouchableOpacity onPress={onToggleFavorite} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons
            name={file.isFavorite ? 'star' : 'star-outline'}
            size={20}
            color={file.isFavorite ? colors.accent.bright : colors.neutral[300]}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '500',
  },
  meta: {
    ...typography.caption,
    color: colors.neutral[400],
    marginTop: 2,
  },
});
