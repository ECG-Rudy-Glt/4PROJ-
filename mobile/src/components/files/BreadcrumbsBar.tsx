import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../theme/useColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface Crumb {
  id: string;
  name: string;
}

interface Props {
  breadcrumbs: Crumb[];
  currentFolderId?: string;
  onNavigate: (id?: string) => void;
}

export default function BreadcrumbsBar({ breadcrumbs, currentFolderId, onNavigate }: Props) {
  const colors = useColors();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <TouchableOpacity
          style={styles.item}
          onPress={() => onNavigate(undefined)}
          disabled={!currentFolderId}
        >
          <Ionicons
            name="home"
            size={13}
            color={currentFolderId ? colors.primary[500] : colors.neutral[500]}
          />
          <Text style={[styles.text, !currentFolderId && styles.textActive]}>Racine</Text>
        </TouchableOpacity>

        {breadcrumbs.map((bc, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <React.Fragment key={bc.id}>
              <Ionicons name="chevron-forward" size={12} color={colors.neutral[300]} style={{ marginTop: 1 }} />
              <TouchableOpacity
                style={styles.item}
                onPress={() => !isLast && onNavigate(bc.id)}
                disabled={isLast}
              >
                <Text style={[styles.text, isLast && styles.textActive]} numberOfLines={1}>
                  {bc.name}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.neutral[50],
      borderBottomWidth: 1,
      borderBottomColor: colors.neutral[100],
      paddingVertical: spacing.sm,
      marginTop: 2,
    },
    scroll: {
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
      paddingHorizontal: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    text: {
      ...typography.caption,
      color: colors.primary[500],
      fontWeight: '500',
      maxWidth: 120,
    },
    textActive: {
      color: colors.neutral[700],
      fontWeight: '700',
    },
  });
}
