import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  Alert,
  Animated,
  StyleSheet,
  TouchableOpacity,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
  const [sortKey, setSortKey] = useState<'name-asc' | 'name-desc' | 'date-desc' | 'date-asc' | 'size-desc' | 'size-asc'>('date-desc');

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
      if (finished && !uploadTransferDone.current) setUploadLabel(t('files.upload_processing'));
    });
  };

  const setRealProgress = (pct: number) => {
    progressAnim.stopAnimation();
    Animated.timing(progressAnim, { toValue: pct, duration: 150, useNativeDriver: false }).start();
    if (pct >= 100) {
      uploadTransferDone.current = true;
      setUploadLabel(t('files.upload_processing'));
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
        () => { setUploading(true); setUploadLabel(t('files.upload_uploading')); startProgressAnimation(); },
        (abort) => { cancelUpload.current = abort; },
        (pct) => setRealProgress(pct),
      );
      if (result.success) {
        completeProgress();
        setUploadLabel(t('files.upload_done'));
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
      Toast.show({ type: 'error', text1: t('files.upload_error'), text2: err?.response?.data?.error ?? err?.message });
    }
  };

  const handleCancelUpload = () => {
    cancelUpload.current?.();
    cancelUpload.current = null;
    uploadTransferDone.current = false;
    setUploading(false);
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    Toast.show({ type: 'info', text1: t('common.cancel') });
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
      Alert.alert(t('common.error'), t('files.folder_create_error'));
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
      t('files.batch_delete_confirm_title', { count }),
      t('files.batch_delete_confirm_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive', onPress: async () => {
            try {
              await Promise.all(getSelectedTargets().map((t) =>
                t.kind === 'file'
                  ? useFileStore.getState().deleteFile(t.data.id)
                  : useFileStore.getState().deleteFolder(t.data.id)
              ));
              Toast.show({ type: 'success', text1: `${count} élément(s) supprimé(s)` });
              exitSelectionMode();
            } catch {
              Toast.show({ type: 'error', text1: t('common.error') });
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
      Toast.show({ type: 'error', text1: t('common.error') });
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
      Toast.show({ type: 'error', text1: t('common.error') });
    }
  };

  // ── Sort ──────────────────────────────────────────────────────────────────

  const SORT_KEYS = ['name-asc', 'name-desc', 'date-desc', 'date-asc', 'size-desc', 'size-asc'] as const;

  const handleSort = () => {
    const sortLabels = [
      t('files.sort_name_asc'),
      t('files.sort_name_desc'),
      t('files.sort_date_desc'),
      t('files.sort_date_asc'),
      t('files.sort_size_desc'),
      t('files.sort_size_asc'),
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...sortLabels, t('common.cancel')], cancelButtonIndex: 6 },
        (idx) => { if (idx < 6) setSortKey(SORT_KEYS[idx]); }
      );
    } else {
      Alert.alert(t('files.sort_title'), undefined,
        SORT_KEYS.map((k, i) => ({ text: sortLabels[i], onPress: () => setSortKey(k) }))
          .concat([{ text: t('common.cancel'), onPress: () => {} }])
      );
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const safeBreadcrumbs = breadcrumbs ?? [];
  const currentFolderName = safeBreadcrumbs.length > 0
    ? safeBreadcrumbs[safeBreadcrumbs.length - 1].name
    : t('files.title');

  const filteredFiles = activeTagId
    ? files.filter((f) => f.tags?.some((ft) => ft.tagId === activeTagId))
    : files;

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    switch (sortKey) {
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'date-asc': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'date-desc': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'size-asc': return a.size - b.size;
      case 'size-desc': return b.size - a.size;
    }
  });

  const items = [
    ...(activeTagId ? [] : folders.map((f) => ({ type: 'folder' as const, data: f }))),
    ...sortedFiles.map((f) => ({ type: 'file' as const, data: f })),
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
        onSort={handleSort}
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
              title={t('files.empty_folder')}
              subtitle={t('files.empty_drop')}
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
