import React, { useEffect, useCallback, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import Toast from 'react-native-toast-message';
import { useFileStore } from '../../stores/useFileStore';
import { uploadService } from '../../services/uploadService';
import FileRow from '../../components/FileRow';
import FolderRow from '../../components/FolderRow';
import EmptyState from '../../components/EmptyState';
import FilePreviewModal from '../../components/FilePreviewModal';
import ItemActionsSheet from '../../components/ItemActionsSheet';
import SearchBar from '../../components/SearchBar';
import { FileItem, Folder } from '../../types';

type ActionTarget =
  | { kind: 'file'; data: FileItem }
  | { kind: 'folder'; data: Folder }
  | null;

export default function FilesScreen() {
  const insets = useSafeAreaInsets();
  const {
    files, folders, breadcrumbs, currentFolderId,
    loading, fetchContents, navigateToFolder, createFolder, toggleFavorite,
  } = useFileStore();

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [actionTarget, setActionTarget] = useState<ActionTarget>(null);
  const [showSearch, setShowSearch] = useState(false);

  const handleUpload = async () => {
    setUploading(true);
    try {
      const { success, count } = await uploadService.pickAndUpload(currentFolderId);
      if (success) {
        Toast.show({ type: 'success', text1: `${count} fichier(s) envoyé(s)` });
        fetchContents(currentFolderId);
      }
    } catch {
      Toast.show({ type: 'error', text1: "Erreur lors de l'envoi" });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchContents();
  }, []);

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
    if (breadcrumbs.length > 1) {
      navigateToFolder(breadcrumbs[breadcrumbs.length - 2].id);
    } else {
      navigateToFolder(undefined);
    }
  };

  const currentFolderName = breadcrumbs.length > 0
    ? breadcrumbs[breadcrumbs.length - 1].name
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
          {currentFolderId && (
            <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.primary[600]} />
            </TouchableOpacity>
          )}
          <Text style={styles.title} numberOfLines={1}>{currentFolderName}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <TouchableOpacity onPress={() => setShowSearch(true)} style={styles.addBtn}>
            <Ionicons name="search-outline" size={24} color={colors.primary[600]} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowNewFolder(true)} style={styles.addBtn}>
            <Ionicons name="add-circle-outline" size={26} color={colors.primary[600]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <View style={styles.breadcrumbs}>
          <TouchableOpacity onPress={() => navigateToFolder(undefined)}>
            <Text style={styles.breadcrumbLink}>Racine</Text>
          </TouchableOpacity>
          {breadcrumbs.map((bc, i) => (
            <React.Fragment key={bc.id}>
              <Ionicons name="chevron-forward" size={14} color={colors.neutral[400]} />
              <TouchableOpacity
                onPress={() => i < breadcrumbs.length - 1 ? navigateToFolder(bc.id) : null}
              >
                <Text style={[
                  styles.breadcrumbLink,
                  i === breadcrumbs.length - 1 && styles.breadcrumbCurrent,
                ]}>
                  {bc.name}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
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
          if (item.type === 'folder') {
            return (
              <FolderRow
                folder={item.data}
                onPress={() => navigateToFolder(item.data.id)}
                onLongPress={() => setActionTarget({ kind: 'folder', data: item.data })}
              />
            );
          }
          return (
            <FileRow
              file={item.data}
              showFavorite
              onPress={() => setPreviewFile(item.data)}
              onLongPress={() => setActionTarget({ kind: 'file', data: item.data })}
              onToggleFavorite={() => toggleFavorite(item.data.id)}
            />
          );
        }}
      />

      {/* FAB Upload */}
      <TouchableOpacity
        style={[styles.fab, uploading && styles.fabDisabled]}
        onPress={handleUpload}
        disabled={uploading}
        activeOpacity={0.8}
      >
        <Ionicons name={uploading ? 'hourglass-outline' : 'cloud-upload-outline'} size={26} color={colors.white} />
      </TouchableOpacity>

      {/* Global search */}
      <SearchBar
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onFilePress={(f) => setPreviewFile(f)}
      />

      {/* Actions sheet (long-press) */}
      <ItemActionsSheet
        target={actionTarget}
        onClose={() => setActionTarget(null)}
      />

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
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  breadcrumbLink: {
    ...typography.caption,
    color: colors.primary[500],
    fontWeight: '500',
  },
  breadcrumbCurrent: {
    color: colors.neutral[600],
    fontWeight: '600',
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
});
