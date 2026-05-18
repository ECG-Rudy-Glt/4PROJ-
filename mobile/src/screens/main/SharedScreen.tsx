import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import Toast from 'react-native-toast-message';
import { shareService } from '../../services/shareService';
import { fileService } from '../../services/fileService';
import { SharedFile, SharedFolder, FileItem } from '../../types';
import EmptyState from '../../components/EmptyState';
import FilePreviewModal from '../../components/FilePreviewModal';

type Tab = 'pending' | 'withMe' | 'byMe';

interface PendingShare {
  id: string;
  type: 'file' | 'folder';
  name: string;
  sharedBy: { email: string; firstName?: string; lastName?: string };
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
}

export default function SharedScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<PendingShare[]>([]);
  const [filesWithMe, setFilesWithMe] = useState<SharedFile[]>([]);
  const [foldersWithMe, setFoldersWithMe] = useState<SharedFolder[]>([]);
  const [filesByMe, setFilesByMe] = useState<SharedFile[]>([]);
  const [foldersByMe, setFoldersByMe] = useState<SharedFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewIsShared, setPreviewIsShared] = useState(false);
  const [previewCanDelete, setPreviewCanDelete] = useState(false);
  const [folderStack, setFolderStack] = useState<{ folderId: string; name: string; rootFolderId: string }[]>([]);
  const [folderContents, setFolderContents] = useState<{ files: FileItem[]; folders: any[] } | null>(null);
  const [folderContentsLoading, setFolderContentsLoading] = useState(false);
  const [folderPreviewFile, setFolderPreviewFile] = useState<FileItem | null>(null);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingData, filesWith, filesBy, foldersWith, foldersBy] = await Promise.all([
        shareService.getPendingShares(),
        shareService.listFilesSharedWithMe(),
        shareService.listFilesSharedByMe(),
        shareService.listFoldersSharedWithMe(),
        shareService.listFoldersSharedByMe(),
      ]);

      const pendingList: PendingShare[] = [
        ...(pendingData.files ?? []).map((f: any) => ({
          id: f.id,
          type: 'file' as const,
          name: f.file?.name ?? 'Fichier',
          sharedBy: f.sharedBy,
          fileSize: f.file?.size ? Number(f.file.size) : undefined,
          mimeType: f.file?.mimeType,
          createdAt: f.createdAt,
        })),
        ...(pendingData.folders ?? []).map((f: any) => ({
          id: f.id,
          type: 'folder' as const,
          name: f.folder?.name ?? 'Dossier',
          sharedBy: f.sharedBy,
          createdAt: f.createdAt,
        })),
      ];

      setPending(pendingList);
      setFilesWithMe(filesWith.sharedFiles ?? []);
      setFilesByMe(filesBy.sharedFiles ?? []);
      setFoldersWithMe(foldersWith.sharedFolders ?? []);
      setFoldersByMe(foldersBy.sharedFolders ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const handlePendingAction = async (share: PendingShare, accepted: boolean) => {
    setActionId(share.id);
    try {
      if (share.type === 'file') {
        accepted
          ? await shareService.acceptSharedFile(share.id)
          : await shareService.rejectSharedFile(share.id);
      } else {
        accepted
          ? await shareService.acceptSharedFolder(share.id)
          : await shareService.rejectSharedFolder(share.id);
      }
      Toast.show({ type: 'success', text1: accepted ? 'Partage accepté' : 'Partage refusé' });
      setPending((prev) => prev.filter((s) => s.id !== share.id));
      if (accepted) fetchData();
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur' });
    } finally {
      setActionId(null);
    }
  };

  const confirmPendingAction = (share: PendingShare, accepted: boolean) => {
    Alert.alert(
      accepted ? 'Accepter ce partage ?' : 'Refuser ce partage ?',
      share.name,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: accepted ? 'Accepter' : 'Refuser',
          style: accepted ? 'default' : 'destructive',
          onPress: () => handlePendingAction(share, accepted),
        },
      ],
    );
  };

  const handleRevokeShare = (type: 'file' | 'folder', shareId: string, name: string) => {
    Alert.alert('Révoquer le partage', `Révoquer le partage de "${name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Révoquer', style: 'destructive', onPress: async () => {
          try {
            if (type === 'file') {
              await shareService.removeSharedFile(shareId);
            } else {
              await shareService.removeSharedFolder(shareId);
            }
            Toast.show({ type: 'success', text1: 'Partage révoqué' });
            fetchData();
          } catch {
            Toast.show({ type: 'error', text1: 'Erreur' });
          }
        },
      },
    ]);
  };

  const loadFolderContents = async (folderId: string, rootFolderId: string) => {
    setFolderContentsLoading(true);
    try {
      const data = await shareService.getSharedFolderContents(folderId, rootFolderId);
      setFolderContents(data);
    } catch {
      Toast.show({ type: 'error', text1: 'Impossible de charger le contenu du dossier' });
    } finally {
      setFolderContentsLoading(false);
    }
  };

  const openSharedFolder = (folderId: string, name: string) => {
    const newStack = [{ folderId, name, rootFolderId: folderId }];
    setFolderStack(newStack);
    setFolderContents(null);
    loadFolderContents(folderId, folderId);
  };

  const navigateIntoSubfolder = (folderId: string, name: string) => {
    const rootFolderId = folderStack[0]?.rootFolderId ?? folderId;
    const newStack = [...folderStack, { folderId, name, rootFolderId }];
    setFolderStack(newStack);
    setFolderContents(null);
    loadFolderContents(folderId, rootFolderId);
  };

  const navigateBack = () => {
    if (folderStack.length <= 1) {
      setFolderStack([]);
      setFolderContents(null);
      return;
    }
    const newStack = folderStack.slice(0, -1);
    setFolderStack(newStack);
    const parent = newStack[newStack.length - 1];
    setFolderContents(null);
    loadFolderContents(parent.folderId, parent.rootFolderId);
  };

  const getUserName = (user?: { email: string; firstName?: string; lastName?: string }) => {
    if (!user) return 'Inconnu';
    if (user.firstName) return `${user.firstName} ${user.lastName || ''}`.trim();
    return user.email;
  };

  const withMeItems = [
    ...foldersWithMe.filter((f) => f.accepted).map((f) => ({ type: 'folder' as const, data: f })),
    ...filesWithMe.filter((f) => f.accepted).map((f) => ({ type: 'file' as const, data: f })),
  ];
  const byMeItems = [
    ...foldersByMe.map((f) => ({ type: 'folder' as const, data: f })),
    ...filesByMe.map((f) => ({ type: 'file' as const, data: f })),
  ];

  const renderPendingItem = ({ item }: { item: PendingShare }) => (
    <View style={styles.shareRow}>
      <View style={[styles.shareIconCircle, item.type === 'folder' && styles.folderIconBg]}>
        <Ionicons
          name={item.type === 'folder' ? 'folder' : 'document-outline'}
          size={20}
          color={item.type === 'folder' ? colors.accent.bright : colors.primary[500]}
        />
      </View>
      <View style={styles.shareInfo}>
        <Text style={styles.shareName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.shareMeta}>De {getUserName(item.sharedBy)}</Text>
        {item.fileSize != null && (
          <Text style={styles.shareMeta}>
            {(item.fileSize / 1024 / 1024).toFixed(2)} MB
            {item.mimeType ? ` • ${item.mimeType.split('/')[1]}` : ''}
          </Text>
        )}
      </View>
      {actionId === item.id ? (
        <ActivityIndicator color={colors.primary[600]} />
      ) : (
        <View style={styles.actionBtns}>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => confirmPendingAction(item, true)}
          >
            <Ionicons name="checkmark" size={18} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => confirmPendingAction(item, false)}
          >
            <Ionicons name="close" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderSharedItem = ({ item }: { item: { type: 'file' | 'folder'; data: SharedFile | SharedFolder } }) => {
    const sf = item.data;
    const isFolder = item.type === 'folder';
    const name = isFolder ? (sf as SharedFolder).folder?.name : (sf as SharedFile).file?.name;
    const partner = tab === 'withMe' ? sf.sharedBy : sf.sharedWith;
    const fileItem = !isFolder ? (sf as SharedFile).file : null;

    const handlePress = () => {
      if (isFolder && tab === 'withMe') {
        const sf = item.data as SharedFolder;
        openSharedFolder(sf.folderId, name || 'Dossier');
      } else if (!isFolder) {
        if (!fileItem) {
          Toast.show({ type: 'error', text1: 'Fichier introuvable' });
          return;
        }
        const isShared = tab === 'withMe';
        setPreviewFile(fileItem);
        setPreviewIsShared(isShared);
        setPreviewCanDelete(!isShared || !!(sf as SharedFile).canDelete);
      }
    };

    return (
      <TouchableOpacity
        style={styles.shareRow}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={[styles.shareIconCircle, isFolder && styles.folderIconBg]}>
          <Ionicons
            name={isFolder ? 'folder' : 'document-outline'}
            size={20}
            color={isFolder ? colors.accent.bright : colors.primary[500]}
          />
        </View>
        <View style={styles.shareInfo}>
          <Text style={styles.shareName} numberOfLines={1}>{name || '–'}</Text>
          <Text style={styles.shareMeta}>
            {tab === 'withMe' ? `Par ${getUserName(partner)}` : `Avec ${getUserName(partner)}`}
          </Text>
          <View style={styles.permRow}>
            {sf.canWrite && <PermBadge label="Écriture" />}
            {sf.canDelete && <PermBadge label="Suppression" />}
            {sf.canShare && <PermBadge label="Partage" />}
          </View>
        </View>
        {tab === 'byMe' && (
          <TouchableOpacity
            onPress={() => handleRevokeShare(item.type, sf.id, name || '')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.neutral[400]} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Partages</Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'pending' && styles.tabActive]}
          onPress={() => setTab('pending')}
        >
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
            En attente
          </Text>
          {pending.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pending.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'withMe' && styles.tabActive]}
          onPress={() => setTab('withMe')}
        >
          <Text style={[styles.tabText, tab === 'withMe' && styles.tabTextActive]}>
            Avec moi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'byMe' && styles.tabActive]}
          onPress={() => setTab('byMe')}
        >
          <Text style={[styles.tabText, tab === 'byMe' && styles.tabTextActive]}>
            Par moi
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'pending' && (
        <FlatList
          data={pending}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchData} tintColor={colors.primary[600]} />
          }
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="checkmark-circle-outline"
                title="Aucun partage en attente"
                subtitle="Vous n'avez aucune invitation en attente"
              />
            ) : null
          }
          renderItem={renderPendingItem}
        />
      )}

      {(tab === 'withMe' || tab === 'byMe') && (
        <FlatList
          data={tab === 'withMe' ? withMeItems : byMeItems}
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
                  ? "Aucun fichier partagé avec vous"
                  : "Vous n'avez partagé aucun fichier"}
              />
            ) : null
          }
          renderItem={renderSharedItem}
        />
      )}

      <FilePreviewModal
        file={previewFile}
        visible={previewFile !== null}
        onClose={() => setPreviewFile(null)}
        streamToCache={previewIsShared ? fileService.streamSharedToCache : undefined}
        downloadToCache={previewIsShared ? fileService.downloadSharedToCache : undefined}
        readOnly={previewIsShared}
        onDelete={previewCanDelete ? async (id) => { setPreviewFile(null); } : undefined}
      />

      {/* Folder contents modal */}
      {folderStack.length > 0 && <Modal
        visible={true}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setFolderStack([]); setFolderContents(null); }}
      >
        <View style={styles.folderModal}>
          <View style={styles.folderModalHeader}>
            <TouchableOpacity onPress={navigateBack} style={styles.folderModalClose}>
              <Ionicons
                name={folderStack.length <= 1 ? 'close' : 'chevron-back'}
                size={24}
                color={colors.neutral[600]}
              />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
              <Ionicons name="folder" size={20} color={colors.accent.bright} />
              <Text style={styles.folderModalTitle} numberOfLines={1}>
                {currentFolder?.name ?? ''}
              </Text>
            </View>
            {folderStack.length > 1 && (
              <TouchableOpacity onPress={() => { setFolderStack([]); setFolderContents(null); }}>
                <Ionicons name="close" size={22} color={colors.neutral[400]} />
              </TouchableOpacity>
            )}
          </View>

          {folderContentsLoading || folderContents === null ? (
            <View style={styles.folderModalLoader}>
              <ActivityIndicator color={colors.primary[600]} size="large" />
            </View>
          ) : (
            <FlatList
              data={[
                ...(folderContents?.folders ?? []).map((f: any) => ({ kind: 'folder' as const, data: f })),
                ...(folderContents?.files ?? []).map((f: any) => ({ kind: 'file' as const, data: f })),
              ]}
              keyExtractor={(item) => `${item.kind}-${item.data.id}`}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <EmptyState icon="folder-open-outline" title="Dossier vide" subtitle="Ce dossier ne contient aucun fichier" />
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.shareRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (item.kind === 'folder') {
                      navigateIntoSubfolder(item.data.id, item.data.name);
                    } else {
                      setFolderPreviewFile(item.data as FileItem);
                    }
                  }}
                >
                  <View style={[styles.shareIconCircle, item.kind === 'folder' && styles.folderIconBg]}>
                    <Ionicons
                      name={item.kind === 'folder' ? 'folder' : 'document-outline'}
                      size={20}
                      color={item.kind === 'folder' ? colors.accent.bright : colors.primary[500]}
                    />
                  </View>
                  <View style={styles.shareInfo}>
                    <Text style={styles.shareName} numberOfLines={1}>{item.data.name}</Text>
                    {item.kind === 'file' && item.data.mimeType && (
                      <Text style={styles.shareMeta}>{item.data.mimeType.split('/')[1]?.toUpperCase()}</Text>
                    )}
                  </View>
                  <Ionicons
                    name={item.kind === 'folder' ? 'chevron-forward' : 'eye-outline'}
                    size={16}
                    color={colors.neutral[300]}
                  />
                </TouchableOpacity>
              )}
            />
          )}
          <FilePreviewModal
            file={folderPreviewFile}
            visible={folderPreviewFile !== null}
            onClose={() => setFolderPreviewFile(null)}
            streamToCache={fileService.streamSharedToCache}
            downloadToCache={fileService.downloadSharedToCache}
            readOnly={true}
          />
        </View>
      </Modal>}
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
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabActive: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  tabText: {
    ...typography.caption,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: colors.error,
    minWidth: 16,
    height: 16,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
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
    backgroundColor: `${colors.primary[500]}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderIconBg: {
    backgroundColor: `${colors.accent.bright}15`,
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
  actionBtns: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  acceptBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderModal: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  folderModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    gap: spacing.md,
  },
  folderModalClose: {
    padding: spacing.xs,
  },
  folderModalTitle: {
    ...typography.h4,
    color: colors.neutral[800],
    flex: 1,
  },
  folderModalLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
