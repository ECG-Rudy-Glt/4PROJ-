import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  Alert,
  Animated,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useColors } from '../../theme/useColors';
import { spacing, borderRadius } from '../../theme/spacing';
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
import { FileItem, Folder, Tag } from '../../types';
import { tagService } from '../../services/tagService';
import FilesHeader from '../../components/files/FilesHeader';
import BreadcrumbsBar from '../../components/files/BreadcrumbsBar';
import TagFilterBar from '../../components/files/TagFilterBar';
import UploadProgressBar from '../../components/files/UploadProgressBar';
import BatchActionBar from '../../components/files/BatchActionBar';
import NewFolderModal from '../../components/files/NewFolderModal';
import BatchMoveModal from '../../components/files/BatchMoveModal';

type ActionTarget =
  | { kind: 'file'; data: FileItem }
  | { kind: 'folder'; data: Folder }
  | null;

export default function FilesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const {
    files = [], folders = [], breadcrumbs, currentFolderId,
    loading, fetchContents, navigateToFolder, createFolder, toggleFavorite,
  } = useFileStore();

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const progressAnim = useRef(new Animated.Value(0)).current;
  const cancelUpload = useRef<(() => void) | null>(null);
  const uploadTransferDone = useRef(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [actionTarget, setActionTarget] = useState<ActionTarget>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchMove, setShowBatchMove] = useState(false);
  const [showBatchShare, setShowBatchShare] = useState(false);
  const [batchMoveFolders, setBatchMoveFolders] = useState<Folder[]>([]);
  const [batchMoveFoldersLoading, setBatchMoveFoldersLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchContents(currentFolderId);
      tagService.getUserTags().then((r) => setAllTags(r.tags ?? [])).catch(() => {});
    }, [currentFolderId])
  );

  // ── Upload ────────────────────────────────────────────────────────────────

  const startProgressAnimation = () => {
    uploadTransferDone.current = false;
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 92,
      duration: 45000,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !uploadTransferDone.current) setUploadLabel('Traitement en cours…');
    });
  };

  const setRealProgress = (pct: number) => {
    progressAnim.stopAnimation();
    Animated.timing(progressAnim, { toValue: pct, duration: 150, useNativeDriver: false }).start();
    if (pct >= 100) {
      uploadTransferDone.current = true;
      setUploadLabel('Traitement en cours…');
    }
  };

  const completeProgress = () => {
    progressAnim.stopAnimation();
    Animated.timing(progressAnim, { toValue: 100, duration: 300, useNativeDriver: false }).start();
  };

  const handleUpload = async () => {
    try {
      const result = await uploadService.pickAndUpload(
        currentFolderId,
        () => { setUploading(true); setUploadLabel('Envoi en cours…'); startProgressAnimation(); },
        (abort) => { cancelUpload.current = abort; },
        (pct) => setRealProgress(pct),
      );
      if (result.success) {
        completeProgress();
        setUploadLabel('Terminé !');
        setTimeout(async () => {
          setUploading(false);
          progressAnim.setValue(0);
          if (result.partial) {
            const failed = result.failed ?? result.errors?.length ?? 0;
            const total = result.total ?? result.count + failed;
            Toast.show({
              type: 'info',
              text1: `${result.count}/${total} fichier(s) envoyé(s), ${failed} échec(s)`,
              text2: result.errors?.[0] ? `${result.errors[0].fileName ?? 'Fichier'}: ${result.errors[0].error}` : undefined,
            });
          } else {
            Toast.show({ type: 'success', text1: `${result.count} fichier(s) envoyé(s)` });
          }
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
      Toast.show({ type: 'error', text1: "Erreur lors de l'envoi", text2: err?.response?.data?.error ?? err?.message });
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

  // ── Folder / navigation ───────────────────────────────────────────────────

  const onRefresh = useCallback(() => fetchContents(currentFolderId), [currentFolderId]);

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

  // ── Selection ─────────────────────────────────────────────────────────────

  const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds(new Set()); };

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

  const getSelectedTargets = () =>
    items.filter((it) => selectedIds.has(it.data.id)).map((it) =>
      it.type === 'file'
        ? { kind: 'file' as const, data: it.data as FileItem }
        : { kind: 'folder' as const, data: it.data as Folder }
    );

  // ── Batch actions ─────────────────────────────────────────────────────────

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
              await Promise.all(getSelectedTargets().map((t) =>
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

  // ── Derived state ─────────────────────────────────────────────────────────

  const safeBreadcrumbs = breadcrumbs ?? [];
  const currentFolderName = safeBreadcrumbs.length > 0
    ? safeBreadcrumbs[safeBreadcrumbs.length - 1].name
    : 'Mes fichiers';

  const filteredFiles = activeTagId
    ? files.filter((f) => f.tags?.some((ft) => ft.tagId === activeTagId))
    : files;

  const items = [
    ...(activeTagId ? [] : folders.map((f) => ({ type: 'folder' as const, data: f }))),
    ...filteredFiles.map((f) => ({ type: 'file' as const, data: f })),
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <FilesHeader
        title={currentFolderName}
        selectionMode={selectionMode}
        selectedCount={selectedIds.size}
        canGoBack={!!currentFolderId}
        uploading={uploading}
        paddingTop={insets.top}
        onGoBack={handleGoBack}
        onExitSelection={exitSelectionMode}
        onSelectAll={() => setSelectedIds(new Set(items.map((it) => it.data.id)))}
        onSearch={() => setShowSearch(true)}
        onNewFolder={() => setShowNewFolder(true)}
      />

      {!selectionMode && (
        <BreadcrumbsBar
          breadcrumbs={safeBreadcrumbs}
          currentFolderId={currentFolderId}
          onNavigate={navigateToFolder}
        />
      )}

      {!selectionMode && (
        <TagFilterBar
          tags={allTags}
          activeTagId={activeTagId}
          onSelectTag={setActiveTagId}
        />
      )}

      {uploading && (
        <UploadProgressBar
          label={uploadLabel}
          progressAnim={progressAnim}
          onCancel={handleCancelUpload}
        />
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => `${item.type}-${item.data.id}`}
        contentContainerStyle={[
          styles.listContent,
          selectionMode && selectedIds.size > 0 && { paddingBottom: 120 },
        ]}
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
              highlightTagId={activeTagId ?? undefined}
            />
          );
        }}
      />

      {/* FAB Upload */}
      {!selectionMode && (
        <TouchableOpacity
          style={[styles.fab, uploading && styles.fabDisabled]}
          onPress={handleUpload}
          disabled={uploading}
          activeOpacity={0.8}
        >
          <Ionicons
            name={uploading ? 'hourglass-outline' : 'cloud-upload-outline'}
            size={26}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      )}

      {selectionMode && selectedIds.size > 0 && (
        <BatchActionBar
          onMove={openBatchMove}
          onShare={() => setShowBatchShare(true)}
          onDelete={handleBatchDelete}
        />
      )}

      <SearchBar
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onFilePress={(f) => setPreviewFile(f)}
      />

      <ItemActionsSheet
        target={actionTarget}
        onClose={() => setActionTarget(null)}
        onSelect={() => {
          if (actionTarget) enterSelectionWith(actionTarget.data.id);
        }}
      />

      <BatchMoveModal
        visible={showBatchMove}
        folders={batchMoveFolders}
        loading={batchMoveFoldersLoading}
        onClose={() => setShowBatchMove(false)}
        onSelectFolder={handleBatchMoveTo}
      />

      {showBatchShare && (
        <ShareModal
          targets={getSelectedTargets()}
          onClose={() => { setShowBatchShare(false); exitSelectionMode(); }}
        />
      )}

      <FilePreviewModal
        file={previewFile}
        visible={!!previewFile}
        onClose={() => setPreviewFile(null)}
        onDelete={async (id) => { await useFileStore.getState().deleteFile(id); }}
        onToggleFavorite={async (id) => {
          await toggleFavorite(id);
          setPreviewFile((f) => f ? { ...f, isFavorite: !f.isFavorite } : null);
        }}
      />

      <NewFolderModal
        visible={showNewFolder}
        value={newFolderName}
        onChangeText={setNewFolderName}
        onConfirm={handleCreateFolder}
        onCancel={() => { setShowNewFolder(false); setNewFolderName(''); }}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg.secondary,
    },
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
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
    },
    fabDisabled: {
      opacity: 0.6,
    },
  });
}
