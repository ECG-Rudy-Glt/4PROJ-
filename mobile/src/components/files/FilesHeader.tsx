import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../theme/useColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';

interface Props {
  title: string;
  selectionMode: boolean;
  selectedCount: number;
  canGoBack: boolean;
  uploading: boolean;
  paddingTop: number;
  onGoBack: () => void;
  onExitSelection: () => void;
  onSelectAll: () => void;
  onSearch: () => void;
  onNewFolder: () => void;
  onSort: () => void;
}

export default function FilesHeader({
  title, selectionMode, selectedCount, canGoBack, paddingTop,
  onGoBack, onExitSelection, onSelectAll, onSearch, onNewFolder, onSort,
}: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = makeStyles(colors);

  return (
    <View style={[styles.header, selectionMode && styles.headerSelection, { paddingTop: paddingTop + spacing.md }]}>
      <View style={styles.headerLeft}>
        {selectionMode ? (
          <TouchableOpacity onPress={onExitSelection} style={styles.btn}>
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>
        ) : canGoBack ? (
          <TouchableOpacity onPress={onGoBack} style={styles.btn}>
            <Ionicons name="chevron-back" size={24} color={colors.primary[600]} />
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.title, selectionMode && styles.titleSelection]} numberOfLines={1}>
          {selectionMode
            ? t('files.batch_selected', { count: selectedCount })
            : title}
        </Text>
      </View>
      {!selectionMode && (
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <TouchableOpacity onPress={onSort} style={styles.btn}>
            <Ionicons name="swap-vertical-outline" size={22} color={colors.primary[600]} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onSearch} style={styles.btn}>
            <Ionicons name="search-outline" size={22} color={colors.primary[600]} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onNewFolder} style={styles.btn}>
            <Ionicons name="add-circle-outline" size={24} color={colors.primary[600]} />
          </TouchableOpacity>
        </View>
      )}
      {selectionMode && (
        <TouchableOpacity onPress={onSelectAll} style={styles.selectAllBtn}>
          <Ionicons name="checkmark-done-outline" size={20} color={colors.white} />
          <Text style={styles.selectAllText}>Tout</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.neutral[100],
      ...shadows.sm,
    },
    headerSelection: {
      backgroundColor: colors.primary[600],
      borderBottomColor: colors.primary[700],
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: spacing.sm,
    },
    btn: {
      padding: spacing.xs,
    },
    title: {
      ...typography.h3,
      color: colors.primary[600],
      flex: 1,
    },
    titleSelection: {
      color: colors.white,
      fontSize: 17,
      fontWeight: '600',
    },
    selectAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    selectAllText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '700',
    },
  });
}
