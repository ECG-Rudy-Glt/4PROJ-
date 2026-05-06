import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { Folder } from '../types';

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

interface Props {
  folder: Folder;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  selectionMode?: boolean;
}

export default function FolderRow({ folder, onPress, onLongPress, selected, selectionMode }: Props) {
  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {selectionMode ? (
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Ionicons name="checkmark" size={14} color={colors.white} />}
        </View>
      ) : (
        <View style={styles.iconCircle}>
          <Ionicons name="folder" size={22} color={colors.accent.bright} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{folder.name}</Text>
        <Text style={styles.meta}>{formatDate(folder.updatedAt)}</Text>
      </View>
      {!selectionMode && (
        <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
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
  rowSelected: {
    backgroundColor: `${colors.primary[500]}10`,
    borderWidth: 1.5,
    borderColor: colors.primary[400],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  checkboxSelected: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.full,
    backgroundColor: `${colors.accent.bright}15`,
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
