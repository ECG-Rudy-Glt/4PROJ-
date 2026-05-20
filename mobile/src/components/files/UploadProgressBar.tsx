import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../theme/useColors';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';

interface Props {
  label: string;
  progressAnim: Animated.Value;
  onCancel: () => void;
}

export default function UploadProgressBar({ label, progressAnim, onCancel }: Props) {
  const colors = useColors();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="cloud-upload-outline" size={16} color={colors.primary[600]} />
        <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
        <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle-outline" size={20} color={colors.neutral[400]} />
        </TouchableOpacity>
      </View>
      <View style={styles.barBg}>
        <Animated.View
          style={[
            styles.barFill,
            { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      backgroundColor: colors.white,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      ...shadows.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    label: {
      fontSize: 12,
      color: colors.primary[600],
      fontWeight: '600',
    },
    barBg: {
      height: 6,
      backgroundColor: colors.neutral[100],
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      backgroundColor: colors.primary[500],
      borderRadius: borderRadius.full,
    },
  });
}
