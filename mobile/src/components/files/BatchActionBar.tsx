import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../theme/useColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';

interface Props {
  onMove: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export default function BatchActionBar({ onMove, onShare, onDelete }: Props) {
  const colors = useColors();
  const styles = makeStyles(colors);

  return (
    <View style={styles.bar}>
      <TouchableOpacity style={styles.btn} onPress={onMove}>
        <View style={styles.btnIcon}>
          <Ionicons name="move-outline" size={20} color={colors.primary[600]} />
        </View>
        <Text style={styles.btnText}>Déplacer</Text>
      </TouchableOpacity>
      <View style={styles.divider} />
      <TouchableOpacity style={styles.btn} onPress={onShare}>
        <View style={styles.btnIcon}>
          <Ionicons name="share-social-outline" size={20} color={colors.primary[600]} />
        </View>
        <Text style={styles.btnText}>Partager</Text>
      </TouchableOpacity>
      <View style={styles.divider} />
      <TouchableOpacity style={styles.btn} onPress={onDelete}>
        <View style={[styles.btnIcon, styles.btnIconDestructive]}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </View>
        <Text style={[styles.btnText, { color: colors.error }]}>Supprimer</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    bar: {
      position: 'absolute',
      bottom: spacing.xl,
      left: spacing.lg,
      right: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      borderRadius: borderRadius.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      ...shadows['2xl'],
    },
    btn: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing.xs,
    },
    btnIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.lg,
      backgroundColor: `${colors.primary[500]}12`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnIconDestructive: {
      backgroundColor: `${colors.error}12`,
    },
    btnText: {
      fontSize: 11,
      color: colors.primary[600],
      fontWeight: '600',
    },
    divider: {
      width: 1,
      height: 36,
      backgroundColor: colors.neutral[100],
    },
  });
}
