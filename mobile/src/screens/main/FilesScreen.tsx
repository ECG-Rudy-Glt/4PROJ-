import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Animated,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import Toast from 'react-native-toast-message';
import { useFileStore } from '../../stores/useFileStore';
import { uploadService } from '../../services/uploadService';
import { folderService } from '../../services/folderService';
import FileRow from '../../components/FileRow';
import FolderRow from '../../components/FolderRow';
import EmptyState from '../../components/EmptyState';
import FilePreviewModal from '../../components/FilePreviewModal';
import ItemActionsSheet from '../../components/ItemActionsSheet';
import SearchBar from '../../components/SearchBar';
import ShareModal from '../../components/ShareModal';
import { FileItem, Folder } from '../../types';

type ActionTarget =
  | { kind: 'file'; data: FileItem }
  | { kind: 'folder'; data: Folder }
  | null;

export default function FilesScreen() {
  const insets = useSafeAreaInsets();
  const {
    files = [], folders = [], breadcrumbs, currentFolderId,
    loading, fetchContents, navigateToFolder, createFolder, toggleFavorite,
  } = useFileStore();

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelUpload = useRef<(() => void) | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [actionTarget, setActionTarget] = useState<ActionTarget>(null);
  const [showSearch, setShowSearch] = useState(false);

  // Multi-sélection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchMove, setShowBatchMove] = useState(false);
  const [showBatchShare, setShowBatchShare] = useState(false);
  const [batchMoveFolders, setBatchMoveFolders] = useState<Folder[]>([]);
  const [batchMoveFoldersLoading, setBatchMoveFoldersLoading] = useState(false);

  // Rafraîchit la liste à chaque fois que l'onglet reçoit le focus
  useFocusEffect(
    useCallback(() => {
      fetchContents(currentFolderId);
    }, [currentFolderId])
  );

  const uploadTransferDone = useRef(false);

  const startProgressAnimation = () => {
    uploadTransferDone.current = false;
    progressAnim.setValue(0);
    // Animation lente jusqu'à 92% — laisse de la place pour "Traitement en cours…"
    Animated.timing(progressAnim, {
      toValue: 92,
      duration: 45000,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !uploadTransferDone.current) {
        setUploadLabel('Traitement en cours…');
      }
    });
  };

  const setRealProgress = (pct: number) => {
    // Si les vrais events XHR arrivent, on arrête l'animation fake et on suit la réalité
    progressAnim.stopAnimation();
    Animated.timing(progressAnim, {
      toValue: pct,
      duration: 150,
      useNativeDriver: false,
    }).start();
    if (pct >= 100) {
      uploadTransferDone.current = true;
      setUploadLabel('Traitement en cours…');
    }
  };

  const completeProgress = () => {
    progressAnim.stopAnimation();
    Animated.timing(progressAnim, {
      toValue: 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleUpload = async () => {
    try {
      const { success, count } = await uploadService.pickAndUpload(
        currentFolderId,
        () => {
          setUploading(true);
          setUploadLabel('Envoi en cours…');
          startProgressAnimation();
        },
        (abort) => { cancelUpload.current = abort; },
        (pct) => setRealProgress(pct),
      );
      if (success) {
        completeProgress();
        setUploadLabel('Terminé !');
        setTimeout(async () => {
          setUploading(false);
          progressAnim.setValue(0);
          Toast.show({ type: 'success', text1: `${count} fichier(s) envoyé(s)` });
          await fetchContents(currentFolderId);
        }, 400);
      } else {
        setUploading(false);
        progressAnim.setValue(0);
      }
    } catch (err: any) {
      setUploading(false);
      progressAnim.stopAnimation();
      progressAnim.setValue(0);
      cancelUpload.current = null;
      uploadTransferDone.current = false;
      if (err?.cancelled) return;
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Erreur lors de l'envoi";
      Toast.show({ type: 'error', text1: "Erreur lors de l'envoi", text2: msg });
    }
  };

  const handleCancelUpload = () => {
    cancelUpload.current?.();
    cancelUpload.current = null;
    uploadTransferDone.current = false;
    setUploading(false);
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    Toast.show({ type: 'info', text1: 'Envoi annulé' });
  };

  const onRefresh = useCallback(() => {
    fetchContents(currentFolderId);
  }, [currentFolderId]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim());
      setShowNewFolder(false);
      setNewFolderName('');
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le dossier');
    }
  };

  const handleGoBack = () => {
    if (safeBreadcrumbs.length > 1) {
      navigateToFolder(safeBreadcrumbs[safeBreadcrumbs.length - 2].id);
    } else {
      navigateToFolder(undefined);
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  const enterSelectionWith = (id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const getSelectedTargets = () => {
    return items.filter((it) => selectedIds.has(it.data.id)).map((it) =>
      it.type === 'file'
        ? { kind: 'file' as const, data: it.data as FileItem }
        : { kind: 'folder' as const, data: it.data as Folder }
    );
  };

  const handleBatchDelete = () => {
    const count = selectedIds.size;
    Alert.alert(
      `Supprimer ${count} élément(s) ?`,
      'Les fichiers seront déplacés dans la corbeille. Les dossiers et leur contenu seront supprimés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive', onPress: async () => {
            try {
              const targets = getSelectedTargets();
              await Promise.all(targets.map((t) =>
                t.kind === 'file'
                  ? useFileStore.getState().deleteFile(t.data.id)
                  : useFileStore.getState().deleteFolder(t.data.id)
              ));
              Toast.show({ type: 'success', text1: `${count} élément(s) supprimé(s)` });
              exitSelectionMode();
            } catch {
              Toast.show({ type: 'error', text1: 'Erreur lors de la suppression' });
            }
          },
        },
      ]
    );
  };

  const openBatchMove = async () => {
    setShowBatchMove(true);
    setBatchMoveFoldersLoading(true);
    try {
      const res = await folderService.listAllFolders().catch(() => folderService.listFolders());
      setBatchMoveFolders(res.folders ?? []);
    } catch {
      Toast.show({ type: 'error', text1: 'Impossible de charger les dossiers' });
    } finally {
      setBatchMoveFoldersLoading(false);
    }
  };

  const handleBatchMoveTo = async (folderId?: string) => {
    const targets = getSelectedTargets();
    try {
      await Promise.all(targets.map((t) =>
        t.kind === 'file'
          ? useFileStore.getState().moveFile(t.data.id, folderId)
          : t.data.id !== folderId
            ? useFileStore.getState().moveFolder(t.data.id, folderId)
            : Promise.resolve()
      ));
      Toast.show({ type: 'success', text1: `${targets.length} élément(s) déplacé(s)` });
      setShowBatchMove(false);
      exitSelectionMode();
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur lors du déplacement' });
    }
  };

  const safeBreadcrumbs = breadcrumbs ?? [];
  const currentFolderName = safeBreadcrumbs.length > 0
    ? safeBreadcrumbs[safeBreadcrumbs.length - 1].name
    : 'Mes fichiers';

  const items = [
    ...folders.map((f) => ({ type: 'folder' as const, data: f })),
    ...files.map((f) => ({ type: 'file' as const, data: f })),
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {selectionMode ? (
            <TouchableOpacity onPress={exitSelectionMode} style={styles.backBtn}>
              <Ionicons name="close" size={24} color={colors.primary[600]} />
            </TouchableOpacity>
          ) : currentFolderId ? (
            <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.primary[600]} />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.title} numberOfLines={1}>
            {selectionMode ? `${selectedIds.size} sélectionné(s)` : currentFolderName}
          </Text>
        </View>
        {!selectionMode && (
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <TouchableOpacity onPress={() => setShowSearch(true)} style={styles.addBtn}>
              <Ionicons name="search-outline" size={24} color={colors.primary[600]} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowNewFolder(true)} style={styles.addBtn}>
              <Ionicons name="add-circle-outline" size={26} color={colors.primary[600]} />
            </TouchableOpacity>
          </View>
        )}
        {selectionMode && (
          <TouchableOpacity
            onPress={() => {
              const allIds = new Set(items.map((it) => it.data.id));
              setSelectedIds(allIds);
            }}
            style={styles.addBtn}
          >
            <Text style={{ color: colors.primary[600], ...typography.caption, fontWeight: '600' }}>Tout</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Fil d'Ariane */}
      <View style={styles.breadcrumbsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.breadcrumbsScroll}
        >
          {/* Racine toujours cliquable */}
          <TouchableOpacity
            style={styles.breadcrumbItem}
            onPress={() => navigateToFolder(undefined)}
            disabled={!currentFolderId}
          >
            <Ionicons
              name="home"
              size={13}
              color={currentFolderId ? colors.primary[500] : colors.neutral[500]}
            />
            <Text style={[
              styles.breadcrumbText,
              !currentFolderId && styles.breadcrumbTextActive,
            ]}>
              Racine
            </Text>
          </TouchableOpacity>

          {safeBreadcrumbs.map((bc, i) => {
            const isLast = i === safeBreadcrumbs.length - 1;
            return (
              <React.Fragment key={bc.id}>
                <Ionicons name="chevron-forward" size={12} color={colors.neutral[300]} style={{ marginTop: 1 }} />
                <TouchableOpacity
                  style={styles.breadcrumbItem}
                  onPress={() => !isLast && navigateToFolder(bc.id)}
                  disabled={isLast}
                >
                  <Text style={[
                    styles.breadcrumbText,
                    isLast && styles.breadcrumbTextActive,
                  ]} numberOfLines={1}>
                    {bc.name}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </ScrollView>
      </View>

      {/* Barre de progression upload */}
      {uploading && (
        <View style={styles.uploadProgressContainer}>
          <View style={styles.uploadProgressHeader}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.primary[600]} />
            <Text style={[styles.uploadProgressLabel, { flex: 1 }]}>{uploadLabel}</Text>
            <TouchableOpacity onPress={handleCancelUpload} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle-outline" size={20} color={colors.neutral[400]} />
            </TouchableOpacity>
          </View>
          <View style={styles.uploadProgressBarBg}>
            <Animated.View
              style={[
                styles.uploadProgressBarFill,
                { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
        </View>
      )}

      {/* Liste */}
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.type}-${item.data.id}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary[600]} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="folder-open-outline"
              title="Dossier vide"
              subtitle="Ajoutez des fichiers ou créez un dossier"
            />
          ) : null
        }
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.data.id);
          if (item.type === 'folder') {
            return (
              <FolderRow
                folder={item.data}
                selected={isSelected}
                selectionMode={selectionMode}
                onPress={() => {
                  if (selectionMode) { toggleSelection(item.data.id); return; }
                  navigateToFolder(item.data.id);
                }}
                onLongPress={() => {
                  if (selectionMode) { toggleSelection(item.data.id); return; }
                  setActionTarget({ kind: 'folder', data: item.data as Folder });
                }}
              />
            );
          }
          return (
            <FileRow
              file={item.data}
              selected={isSelected}
              selectionMode={selectionMode}
              showFavorite
              onPress={() => {
                if (selectionMode) { toggleSelection(item.data.id); return; }
                setPreviewFile(item.data);
              }}
              onLongPress={() => {
                if (selectionMode) { toggleSelection(item.data.id); return; }
                setActionTarget({ kind: 'file', data: item.data as FileItem });
              }}
              onToggleFavorite={() => toggleFavorite(item.data.id)}
            />
          );
        }}
      />

      {/* FAB Upload — masqué en mode sélection */}
      {!selectionMode && (
        <TouchableOpacity
          style={[styles.fab, uploading && styles.fabDisabled]}
          onPress={handleUpload}
          disabled={uploading}
          activeOpacity={0.8}
        >
          <Ionicons name={uploading ? 'hourglass-outline' : 'cloud-upload-outline'} size={26} color={colors.white} />
        </TouchableOpacity>
      )}

      {/* Barre d'actions batch */}
      {selectionMode && selectedIds.size > 0 && (
        <View style={styles.batchBar}>
          <TouchableOpacity style={styles.batchBtn} onPress={openBatchMove}>
            <Ionicons name="move-outline" size={22} color={colors.primary[600]} />
            <Text style={styles.batchBtnText}>Déplacer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.batchBtn} onPress={() => setShowBatchShare(true)}>
            <Ionicons name="share-social-outline" size={22} color={colors.primary[600]} />
            <Text style={styles.batchBtnText}>Partager</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.batchBtn} onPress={handleBatchDelete}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
            <Text style={[styles.batchBtnText, { color: colors.error }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Global search */}
      <SearchBar
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onFilePress={(f) => setPreviewFile(f)}
      />

      {/* Actions sheet (long-press — single item) */}
      <ItemActionsSheet
        target={actionTarget}
        onClose={() => setActionTarget(null)}
        onSelect={() => {
          if (actionTarget) enterSelectionWith(actionTarget.data.id);
        }}
      />

      {/* Modal déplacement batch */}
      {showBatchMove && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowBatchMove(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { padding: 0, overflow: 'hidden' }]}>
              <View style={styles.batchMoveHeader}>
                <Text style={styles.modalTitle}>Déplacer vers</Text>
                <TouchableOpacity onPress={() => setShowBatchMove(false)}>
                  <Ionicons name="close" size={22} color={colors.neutral[500]} />
                </TouchableOpacity>
              </View>
              {batchMoveFoldersLoading ? (
                <ActivityIndicator color={colors.primary[600]} style={{ padding: spacing.xl }} />
              ) : (
                <ScrollView style={{ maxHeight: 400 }}>
                  <TouchableOpacity style={styles.folderItem} onPress={() => handleBatchMoveTo(undefined)}>
                    <Ionicons name="home-outline" size={20} color={colors.primary[600]} />
                    <Text style={styles.folderItemText}>Racine</Text>
                  </TouchableOpacity>
                  {batchMoveFolders.map((f) => (
                    <TouchableOpacity key={f.id} style={styles.folderItem} onPress={() => handleBatchMoveTo(f.id)}>
                      <Ionicons name="folder-outline" size={20} color={colors.accent.bright} />
                      <Text style={styles.folderItemText} numberOfLines={1}>{f.name}</Text>
                    </TouchableOpacity>
                  ))}
                  {batchMoveFolders.length === 0 && (
                    <Text style={styles.muted}>Aucun dossier disponible</Text>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Modal partage batch */}
      {showBatchShare && (
        <ShareModal
          targets={getSelectedTargets()}
          onClose={() => { setShowBatchShare(false); exitSelectionMode(); }}
        />
      )}

      {/* Preview modal */}
      <FilePreviewModal
        file={previewFile}
        visible={!!previewFile}
        onClose={() => setPreviewFile(null)}
        onDelete={async (id) => { await useFileStore.getState().deleteFile(id); }}
        onToggleFavorite={async (id) => { await toggleFavorite(id); setPreviewFile((f) => f ? { ...f, isFavorite: !f.isFavorite } : null); }}
      />

      {/* Modal nouveau dossier */}
      <Modal visible={showNewFolder} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nouveau dossier</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nom du dossier"
              placeholderTextColor={colors.neutral[400]}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => { setShowNewFolder(false); setNewFolderName(''); }}
              >
                <Text style={styles.modalBtnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnConfirm, !newFolderName.trim() && styles.modalBtnDisabled]}
                onPress={handleCreateFolder}
                disabled={!newFolderName.trim()}
              >
                <Text style={styles.modalBtnConfirmText}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  backBtn: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.primary[600],
    flex: 1,
  },
  addBtn: {
    padding: spacing.xs,
  },
  uploadProgressContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  uploadProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  uploadProgressLabel: {
    ...typography.caption,
    color: colors.primary[600],
    fontWeight: '600',
  },
  uploadProgressBarBg: {
    height: 6,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  uploadProgressBarFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
  },
  breadcrumbsContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    paddingVertical: spacing.sm,
  },
  breadcrumbsScroll: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  breadcrumbText: {
    ...typography.caption,
    color: colors.primary[500],
    fontWeight: '500',
    maxWidth: 120,
  },
  breadcrumbTextActive: {
    color: colors.neutral[700],
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  fabDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows['2xl'],
  },
  modalTitle: {
    ...typography.h4,
    color: colors.neutral[800],
    marginBottom: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.neutral[900],
    marginBottom: spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  modalBtnCancel: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  modalBtnCancelText: {
    ...typography.button,
    color: colors.neutral[500],
  },
  modalBtnConfirm: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  modalBtnConfirmText: {
    ...typography.button,
    color: colors.white,
  },
  batchBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    ...shadows.lg,
  },
  batchBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  batchBtnText: {
    ...typography.caption,
    color: colors.primary[600],
    fontWeight: '600',
  },
  batchMoveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  folderItemText: {
    ...typography.body,
    color: colors.neutral[800],
    flex: 1,
  },
  muted: {
    ...typography.caption,
    color: colors.neutral[400],
    textAlign: 'center',
    padding: spacing.lg,
  },
});
