import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { FileItem, Folder } from '../types';
import { useFileStore } from '../stores/useFileStore';
import { folderService } from '../services/folderService';
import { fileService } from '../services/fileService';
import ShareModal from './ShareModal';
import TagsPicker from './TagsPicker';
import VersionsPanel from './VersionsPanel';
import CommentsPanel from './CommentsPanel';

type Target =
  | { kind: 'file'; data: FileItem }
  | { kind: 'folder'; data: Folder };

interface Props {
  target: Target | null;
  onClose: () => void;
  onSelect?: () => void;
}

export default function ItemActionsSheet({ target, onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const [subSheet, setSubSheet] = useState<
    'none' | 'rename' | 'move' | 'share' | 'tags' | 'versions' | 'comments'
  >('none');
  const [renameValue, setRenameValue] = useState('');
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  const store = useFileStore();

  useEffect(() => {
    if (target) {
      setRenameValue(target.data.name);
    } else {
      setSubSheet('none');
    }
  }, [target]);

  if (!target) return null;

  const isFile = target.kind === 'file';
  const name = target.data.name;

  const isInvalidFolderDestination = (folder: Folder) => {
    if (isFile) return false;
    const targetFolder = target.data as Folder;
    return (
      folder.id === targetFolder.id ||
      folder.path === targetFolder.path ||
      folder.path.startsWith(`${targetFolder.path}/`)
    );
  };

  const formatFolderDestination = (folder: Folder) =>
    folder.path?.replace(/^\//, '').replace(/\//g, ' / ') || folder.name;

  const availableMoveFolders = allFolders.filter((folder) => !isInvalidFolderDestination(folder));

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const res = await folderService.listAllFolders();
      setAllFolders(res.folders ?? []);
    } catch {
      Toast.show({ type: 'error', text1: t('actions.folders_loading_error') });
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleRename = async () => {
    const v = renameValue.trim();
    if (!v || v === name) { setSubSheet('none'); return; }
    try {
      if (isFile) {
        await store.renameFile(target.data.id, v);
      } else {
        await store.renameFolder(target.data.id, v);
      }
      Toast.show({ type: 'success', text1: t('actions.renamed') });
      onClose();
    } catch {
      Toast.show({ type: 'error', text1: t('actions.rename_error') });
    }
  };

  const handleMoveTo = async (folderId?: string) => {
    try {
      if (isFile) {
        await store.moveFile(target.data.id, folderId);
      } else {
        const destination = folderId ? allFolders.find((folder) => folder.id === folderId) : undefined;
        if (destination && isInvalidFolderDestination(destination)) {
          Toast.show({ type: 'error', text1: t('actions.move_invalid') });
          return;
        }
        await store.moveFolder(target.data.id, folderId);
      }
      Toast.show({ type: 'success', text1: t('actions.moved') });
      onClose();
    } catch {
      Toast.show({ type: 'error', text1: t('actions.move_error') });
    }
  };

  const handleDelete = () => {
    Alert.alert(
      isFile ? t('actions.delete_file_title') : t('actions.delete_folder_title'),
      isFile ? t('actions.delete_file_msg') : t('actions.delete_folder_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (isFile) {
                await store.deleteFile(target.data.id);
              } else {
                await store.deleteFolder(target.data.id);
              }
              Toast.show({ type: 'success', text1: t('actions.deleted') });
              onClose();
            } catch {
              Toast.show({ type: 'error', text1: t('actions.delete_error') });
            }
          },
        },
      ],
    );
  };

  const handleDownload = async () => {
    if (!isFile) return;
    try {
      const url = await fileService.downloadToCache(target.data);
      await Linking.openURL(url);
      onClose();
    } catch {
      Toast.show({ type: 'error', text1: t('actions.download_error') });
    }
  };

  const handleDownloadZip = async () => {
    if (isFile) return;
    try {
      Toast.show({ type: 'info', text1: t('actions.download_zip_preparing') });
      const url = await folderService.downloadAsZip(target.data.id, target.data.name);
      await Linking.openURL(url);
      onClose();
    } catch {
      Toast.show({ type: 'error', text1: t('actions.download_zip_error') });
    }
  };

  if (subSheet === 'rename') {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setSubSheet('none')}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{t('actions.rename')}</Text>
            <TextInput
              style={styles.input}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder={t('actions.rename_placeholder')}
              placeholderTextColor={colors.neutral[400]}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.dialogActions}>
              <TouchableOpacity onPress={() => setSubSheet('none')} style={styles.btnGhost}>
                <Text style={styles.btnGhostText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRename} style={styles.btnPrimary}>
                <Text style={styles.btnPrimaryText}>{t('common.validate')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  if (subSheet === 'share') {
    return (
      <ShareModal
        target={target}
        onClose={() => { setSubSheet('none'); onClose(); }}
      />
    );
  }

  if (subSheet === 'tags' && isFile) {
    return (
      <TagsPicker
        file={target.data as FileItem}
        onClose={() => { setSubSheet('none'); onClose(); }}
      />
    );
  }

  if (subSheet === 'versions' && isFile) {
    return (
      <VersionsPanel
        file={target.data as FileItem}
        onClose={() => { setSubSheet('none'); onClose(); }}
        onRestored={() => store.refresh()}
      />
    );
  }

  if (subSheet === 'comments' && isFile) {
    return (
      <CommentsPanel
        file={target.data as FileItem}
        onClose={() => { setSubSheet('none'); onClose(); }}
      />
    );
  }

  if (subSheet === 'move') {
    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setSubSheet('none')}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '80%' }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('actions.move_to')}</Text>
              <TouchableOpacity onPress={() => setSubSheet('none')}>
                <Ionicons name="close" size={24} color={colors.neutral[500]} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              <TouchableOpacity style={styles.folderItem} onPress={() => handleMoveTo(undefined)}>
                <Ionicons name="home-outline" size={20} color={colors.primary[600]} />
                <Text style={styles.folderItemText}>{t('actions.move_root')}</Text>
              </TouchableOpacity>
              {loadingFolders && <Text style={styles.muted}>{t('actions.move_loading')}</Text>}
              {availableMoveFolders.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.folderItem}
                  onPress={() => handleMoveTo(f.id)}
                >
                  <Ionicons name="folder-outline" size={20} color={colors.accent.bright} />
                  <Text style={styles.folderItemText} numberOfLines={1}>{formatFolderDestination(f)}</Text>
                </TouchableOpacity>
              ))}
              {!loadingFolders && availableMoveFolders.length === 0 && (
                <Text style={styles.muted}>{t('actions.move_no_folders')}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <Ionicons
              name={isFile ? 'document-outline' : 'folder-outline'}
              size={22}
              color={isFile ? colors.primary[600] : colors.accent.bright}
            />
            <Text style={styles.sheetTitle} numberOfLines={1}>{name}</Text>
          </View>

          {onSelect && (
            <ActionRow
              icon="checkmark-circle-outline"
              label={t('actions.select')}
              onPress={() => { onSelect(); onClose(); }}
            />
          )}
          <ActionRow icon="create-outline" label={t('actions.rename')} onPress={() => setSubSheet('rename')} />
          <ActionRow
            icon="move-outline"
            label={t('actions.move')}
            onPress={() => {
              setSubSheet('move');
              loadFolders();
            }}
          />
          <ActionRow icon="share-social-outline" label={t('actions.share')} onPress={() => setSubSheet('share')} />
          {isFile ? (
            <>
              <ActionRow icon="pricetags-outline" label={t('actions.tags')} onPress={() => setSubSheet('tags')} />
              <ActionRow icon="chatbubble-outline" label={t('actions.comments')} onPress={() => setSubSheet('comments')} />
              <ActionRow icon="time-outline" label={t('actions.versions')} onPress={() => setSubSheet('versions')} />
              <ActionRow icon="download-outline" label={t('actions.download')} onPress={handleDownload} />
            </>
          ) : (
            <ActionRow icon="archive-outline" label={t('actions.download_zip')} onPress={handleDownloadZip} />
          )}
          <ActionRow
            icon="trash-outline"
            label={t('actions.delete')}
            destructive
            onPress={handleDelete}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const color = destructive ? colors.error : colors.neutral[800];
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    ...shadows['2xl'],
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    marginBottom: spacing.xs,
  },
  sheetTitle: {
    ...typography.h4,
    color: colors.neutral[800],
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  actionLabel: {
    ...typography.body,
    fontWeight: '500',
  },
  dialog: {
    backgroundColor: colors.white,
    margin: spacing.xl,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows['2xl'],
  },
  dialogTitle: {
    ...typography.h4,
    color: colors.neutral[800],
    marginBottom: spacing.lg,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.neutral[900],
  },
  btnGhost: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  btnGhostText: {
    ...typography.button,
    color: colors.neutral[500],
  },
  btnPrimary: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  btnPrimaryText: {
    ...typography.button,
    color: colors.white,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
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
