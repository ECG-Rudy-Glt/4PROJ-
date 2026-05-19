import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../theme/useColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Tag } from '../../types';

interface Props {
  tags: Tag[];
  activeTagId: string | null;
  onSelectTag: (id: string | null) => void;
}

export default function TagFilterBar({ tags, activeTagId, onSelectTag }: Props) {
  const colors = useColors();
  const styles = makeStyles(colors);

  if (tags.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <TouchableOpacity
          style={[styles.chip, !activeTagId && styles.chipActive]}
          onPress={() => onSelectTag(null)}
        >
          <Ionicons name="apps-outline" size={12} color={!activeTagId ? colors.white : colors.neutral[500]} />
          <Text style={[styles.chipText, !activeTagId && styles.chipTextActive]}>Tous</Text>
        </TouchableOpacity>
        {tags.map((tag) => {
          const active = activeTagId === tag.id;
          return (
            <TouchableOpacity
              key={tag.id}
              style={[styles.chip, active && { backgroundColor: tag.color, borderColor: tag.color }]}
              onPress={() => onSelectTag(active ? null : tag.id)}
            >
              <View style={[styles.dot, { backgroundColor: active ? '#fff' : tag.color }]} />
              <Text style={[styles.chipText, active && { color: '#fff' }]}>{tag.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.neutral[100],
    },
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
      alignItems: 'center',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.neutral[200],
      backgroundColor: colors.neutral[50],
      gap: 5,
    },
    chipActive: {
      backgroundColor: colors.primary[600],
      borderColor: colors.primary[600],
    },
    chipText: {
      fontSize: 12,
      color: colors.neutral[600],
      fontWeight: '500',
    },
    chipTextActive: {
      color: colors.white,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
  });
}
