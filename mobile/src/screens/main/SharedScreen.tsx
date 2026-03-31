import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { shareService } from '../../services/shareService';
import { SharedFile, SharedFolder } from '../../types';
import EmptyState from '../../components/EmptyState';

type Tab = 'withMe' | 'byMe';

export default function SharedScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('withMe');
  const [filesWithMe, setFilesWithMe] = useState<SharedFile[]>([]);
  const [foldersWithMe, setFoldersWithMe] = useState<SharedFolder[]>([]);
  const [filesByMe, setFilesByMe] = useState<SharedFile[]>([]);
  const [foldersByMe, setFoldersByMe] = useState<SharedFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [withMe, byMe] = await Promise.all([
        shareService.getSharedWithMe(),
        shareService.getSharedByMe(),
      ]);
      setFilesWithMe(withMe.files);
      setFoldersWithMe(withMe.folders);
      setFilesByMe(byMe.files);
      setFoldersByMe(byMe.folders);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const getUserName = (user?: { email: string; firstName?: string; lastName?: string }) => {
    if (!user) return 'Inconnu';
    if (user.firstName) return `${user.firstName} ${user.lastName || ''}`.trim();
    return user.email;
  };

  const currentFiles = tab === 'withMe' ? filesWithMe : filesByMe;
  const currentFolders = tab === 'withMe' ? foldersWithMe : foldersByMe;

  const items = [
    ...currentFolders.map((f) => ({ type: 'folder' as const, data: f })),
    ...currentFiles.map((f) => ({ type: 'file' as const, data: f })),
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Partages</Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'withMe' && styles.tabActive]}
          onPress={() => setTab('withMe')}
        >
          <Text style={[styles.tabText, tab === 'withMe' && styles.tabTextActive]}>
            Partagés avec moi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'byMe' && styles.tabActive]}
          onPress={() => setTab('byMe')}
        >
          <Text style={[styles.tabText, tab === 'byMe' && styles.tabTextActive]}>
            Partagés par moi
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => `${item.type}-${item.data.id}`}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchData} tintColor={colors.primary[600]} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="people-outline"
              title="Aucun partage"
              subtitle={tab === 'withMe'
                ? "Aucun fichier n'a été partagé avec vous"
                : "Vous n'avez partagé aucun fichier"}
            />
          ) : null
        }
        renderItem={({ item }) => {
          if (item.type === 'folder') {
            const sf = item.data;
            return (
              <View style={styles.shareRow}>
                <View style={styles.shareIconCircle}>
                  <Ionicons name="folder" size={22} color={colors.accent.bright} />
                </View>
                <View style={styles.shareInfo}>
                  <Text style={styles.shareName} numberOfLines={1}>{sf.folder?.name || 'Dossier'}</Text>
                  <Text style={styles.shareMeta}>
                    {tab === 'withMe' ? `Par ${getUserName(sf.sharedBy)}` : `Avec ${getUserName(sf.sharedWith)}`}
                  </Text>
                  <View style={styles.permRow}>
                    {sf.canWrite && <PermBadge label="Écriture" />}
                    {sf.canDelete && <PermBadge label="Suppression" />}
                    {sf.canShare && <PermBadge label="Partage" />}
                  </View>
                </View>
                {!sf.accepted && tab === 'withMe' && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>En attente</Text>
                  </View>
                )}
              </View>
            );
          }

          const sf = item.data;
          return (
            <View style={styles.shareRow}>
              <View style={[styles.shareIconCircle, { backgroundColor: `${colors.primary[500]}15` }]}>
                <Ionicons name="document-outline" size={20} color={colors.primary[500]} />
              </View>
              <View style={styles.shareInfo}>
                <Text style={styles.shareName} numberOfLines={1}>{sf.file?.name || 'Fichier'}</Text>
                <Text style={styles.shareMeta}>
                  {tab === 'withMe' ? `Par ${getUserName(sf.sharedBy)}` : `Avec ${getUserName(sf.sharedWith)}`}
                </Text>
                <View style={styles.permRow}>
                  {sf.canWrite && <PermBadge label="Écriture" />}
                  {sf.canDelete && <PermBadge label="Suppression" />}
                  {sf.canShare && <PermBadge label="Partage" />}
                </View>
              </View>
              {!sf.accepted && tab === 'withMe' && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingText}>En attente</Text>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

function PermBadge({ label }: { label: string }) {
  return (
    <View style={styles.permBadge}>
      <Text style={styles.permText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  title: {
    ...typography.h2,
    color: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.lg,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  tabText: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  shareIconCircle: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.full,
    backgroundColor: `${colors.accent.bright}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareInfo: {
    flex: 1,
  },
  shareName: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '500',
  },
  shareMeta: {
    ...typography.caption,
    color: colors.neutral[400],
    marginTop: 2,
  },
  permRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  permBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  permText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary[600],
  },
  pendingBadge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.warning,
  },
});
