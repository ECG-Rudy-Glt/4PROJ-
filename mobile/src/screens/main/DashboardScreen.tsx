import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDashboardStore } from '../../stores/useDashboardStore';

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getCategoryIcon = (mimeType: string): keyof typeof Ionicons.glyphMap => {
  if (mimeType.startsWith('image/')) return 'image-outline';
  if (mimeType.startsWith('video/')) return 'videocam-outline';
  if (mimeType.startsWith('audio/')) return 'musical-notes-outline';
  if (mimeType.includes('pdf')) return 'document-text-outline';
  return 'document-outline';
};

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data, loading, fetch } = useDashboardStore();
  const navigation = useNavigation<any>();

  useEffect(() => {
    fetch();
  }, []);

  const onRefresh = useCallback(() => {
    fetch();
  }, []);

  const quotaPercent = data ? Math.round((data.quotaUsed / data.quotaLimit) * 100) : 0;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary[600]} />}
    >
      {/* En-tête */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Bonjour{user?.firstName ? `, ${user.firstName}` : ''} 👋
          </Text>
          <Text style={styles.subGreeting}>Votre espace de stockage</Text>
        </View>
      </View>

      {/* Carte quota */}
      <View style={styles.quotaCard}>
        <View style={styles.quotaHeader}>
          <Ionicons name="cloud-outline" size={22} color={colors.primary[600]} />
          <Text style={styles.quotaTitle}>Stockage</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(quotaPercent, 100)}%`,
                backgroundColor: quotaPercent > 90 ? colors.error : quotaPercent > 70 ? colors.warning : colors.primary[500],
              },
            ]}
          />
        </View>
        <Text style={styles.quotaText}>
          {data ? `${formatSize(data.quotaUsed)} / ${formatSize(data.quotaLimit)}` : '...'}{' '}
          <Text style={styles.quotaPercent}>({quotaPercent}%)</Text>
        </Text>
      </View>

      {/* Stats rapides */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="document-outline" size={24} color={colors.primary[500]} />
          <Text style={styles.statValue}>{data?.fileStats.totalFiles ?? '–'}</Text>
          <Text style={styles.statLabel}>Fichiers</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="server-outline" size={24} color={colors.accent.bright} />
          <Text style={styles.statValue}>{data ? formatSize(data.fileStats.totalSize) : '–'}</Text>
          <Text style={styles.statLabel}>Utilisé</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="images-outline" size={24} color={colors.accent.warm} />
          <Text style={styles.statValue}>
            {data?.fileStats.byMimeType
              ? Object.keys(data.fileStats.byMimeType).length
              : '–'}
          </Text>
          <Text style={styles.statLabel}>Types</Text>
        </View>
      </View>

      {/* Fichiers récents */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Fichiers récents</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Files')}>
          <Text style={styles.seeAll}>Voir tout</Text>
        </TouchableOpacity>
      </View>

      {data?.recentFiles.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-upload-outline" size={48} color={colors.neutral[300]} />
          <Text style={styles.emptyText}>Aucun fichier pour le moment</Text>
        </View>
      )}

      {data?.recentFiles.map((file) => (
        <View key={file.id} style={styles.fileRow}>
          <View style={styles.fileIconCircle}>
            <Ionicons name={getCategoryIcon(file.mimeType)} size={20} color={colors.primary[600]} />
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
            <Text style={styles.fileMeta}>
              {formatSize(file.size)} · {formatDate(file.updatedAt)}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  greeting: {
    ...typography.h2,
    color: colors.primary[600],
  },
  subGreeting: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    marginTop: 2,
  },
  quotaCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  quotaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quotaTitle: {
    ...typography.h4,
    color: colors.neutral[800],
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  quotaText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  quotaPercent: {
    color: colors.neutral[400],
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.sm,
  },
  statValue: {
    ...typography.h4,
    color: colors.neutral[800],
  },
  statLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.neutral[800],
  },
  seeAll: {
    ...typography.bodySmall,
    color: colors.primary[600],
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.neutral[400],
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  fileIconCircle: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '500',
  },
  fileMeta: {
    ...typography.caption,
    color: colors.neutral[400],
    marginTop: 2,
  },
});
