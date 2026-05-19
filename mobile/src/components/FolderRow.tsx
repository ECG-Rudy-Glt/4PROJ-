import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, AppColors } from '../theme/useColors';
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
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {selectionMode ? (
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
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

const makeStyles = (c: AppColors) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.white, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.sm, gap: spacing.md,
    ...shadows.sm,
  },
  rowSelected: {
    backgroundColor: `${c.primary[500]}18`,
    borderWidth: 1.5, borderColor: c.primary[500],
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: c.neutral[300],
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: c.neutral[50],
  },
  checkboxSelected: { backgroundColor: c.primary[600], borderColor: c.primary[600] },
  iconCircle: {
    width: 42, height: 42, borderRadius: borderRadius.full,
    backgroundColor: `${c.accent.bright}22`,
    justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1 },
  name: { ...typography.body, color: c.neutral[800], fontWeight: '500' },
  meta: { ...typography.caption, color: c.neutral[400], marginTop: 2 },
});
