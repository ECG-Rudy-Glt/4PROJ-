import React, { useEffect, useCallback, useState } from 'react';
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
import { useColors } from '../../theme/useColors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDashboardStore } from '../../stores/useDashboardStore';
import SearchBar from '../../components/SearchBar';
import FilePreviewModal from '../../components/FilePreviewModal';
import PieChart from '../../components/PieChart';
import { FileItem } from '../../types';

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
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const { data, loading, fetch } = useDashboardStore();
  const navigation = useNavigation<any>();
  const [showSearch, setShowSearch] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  const styles = makeStyles(colors);

  useEffect(() => {
    fetch();
  }, []);

  const onRefresh = useCallback(() => {
    fetch();
  }, []);

  const quotaPercent = data ? Math.round((data.quotaUsed / data.quotaLimit) * 100) : 0;

  // Répartition par type — camembert
  const SLICE_COLORS = ['#6366f1', '#e8b84a', '#d4785c', '#22c55e', '#06b6d4', '#a78bfa'];
  const byType = data?.fileStats?.byMimeType ?? {};

  const getCategoryLabel = (mime: string): string => {
    if (mime.startsWith('image/')) return 'Images';
    if (mime.startsWith('video/')) return 'Vidéos';
    if (mime.startsWith('audio/')) return 'Audio';
    if (mime.includes('pdf')) return 'PDF';
    if (mime.includes('word') || mime.includes('docx')) return 'Word';
    if (mime.includes('sheet') || mime.includes('xlsx')) return 'Excel';
    return mime.split('/')[1]?.substring(0, 8) ?? mime;
  };

  const pieSlices = Object.entries(byType)
    .map(([mime, val]) => ({
      label: getCategoryLabel(mime),
      value: (val as { count: number; size: number }).count,
      color: '',
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((s, i) => ({ ...s, color: SLICE_COLORS[i] }));

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
        <TouchableOpacity onPress={() => setShowSearch(true)} style={styles.searchBtn}>
          <Ionicons name="search" size={22} color={colors.primary[600]} />
        </TouchableOpacity>
      </View>

      {/* Stats rapides */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="document-outline" size={22} color={colors.primary[500]} />
          <Text style={styles.statValue}>{data?.fileStats?.totalFiles ?? '–'}</Text>
          <Text style={styles.statLabel}>Total fichiers</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="server-outline" size={22} color={colors.accent.bright} />
          <Text style={styles.statValue}>{data?.fileStats ? formatSize(data.fileStats.totalSize) : '–'}</Text>
          <Text style={styles.statLabel}>Espace utilisé</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="images-outline" size={22} color={colors.accent.warm} />
          <Text style={styles.statValue}>{data?.quotaLimit ? formatSize(data.quotaLimit) : '–'}</Text>
          <Text style={styles.statLabel}>Taille totale</Text>
        </View>
      </View>

      {/* Carte quota */}
      <View style={styles.quotaCard}>
        <View style={styles.quotaHeader}>
          <Ionicons name="cloud-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.quotaTitle}>Stockage</Text>
          <Text style={styles.quotaPercent}>{quotaPercent}%</Text>
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
          {data ? `${formatSize(data.quotaUsed)} utilisés sur ${formatSize(data.quotaLimit)}` : '...'}
        </Text>
      </View>

      {/* Répartition par type — camembert */}
      {pieSlices.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Répartition par type</Text>
          <PieChart slices={pieSlices} size={160} />
        </View>
      )}

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
        <TouchableOpacity
          key={file.id}
          style={styles.fileRow}
          onPress={() => setPreviewFile(file as FileItem)}
          activeOpacity={0.7}
        >
          <View style={styles.fileIconCircle}>
            <Ionicons name={getCategoryIcon(file.mimeType)} size={20} color={colors.primary[600]} />
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
            <Text style={styles.fileMeta}>
              {formatSize(file.size)} · {formatDate(file.updatedAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.neutral[300]} />
        </TouchableOpacity>
      ))}

      <SearchBar visible={showSearch} onClose={() => setShowSearch(false)} />

      <FilePreviewModal
        file={previewFile}
        visible={!!previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
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
      marginBottom: spacing.lg,
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
    searchBtn: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      backgroundColor: colors.white,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.sm,
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.white,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      alignItems: 'center',
      gap: spacing.xs,
      ...shadows.sm,
    },
    statValue: {
      ...typography.h4,
      color: colors.neutral[800],
      fontSize: 14,
    },
    statLabel: {
      ...typography.caption,
      color: colors.neutral[500],
      textAlign: 'center',
      fontSize: 10,
    },
    quotaCard: {
      backgroundColor: colors.white,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
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
      flex: 1,
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
      color: colors.neutral[500],
    },
    quotaPercent: {
      ...typography.bodySmall,
      color: colors.neutral[400],
      fontWeight: '600',
    },
    sectionCard: {
      backgroundColor: colors.white,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadows.sm,
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
      marginBottom: spacing.sm,
    },
    seeAll: {
      ...typography.bodySmall,
      color: colors.primary[600],
      fontWeight: '600',
    },
    typeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    typeLabel: {
      ...typography.caption,
      color: colors.neutral[600],
      width: 60,
    },
    typeBarBg: {
      flex: 1,
      height: 6,
      backgroundColor: colors.neutral[100],
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    typeBarFill: {
      height: '100%',
      backgroundColor: colors.primary[400],
      borderRadius: borderRadius.full,
    },
    typeCount: {
      ...typography.caption,
      color: colors.neutral[400],
      width: 24,
      textAlign: 'right',
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
}
