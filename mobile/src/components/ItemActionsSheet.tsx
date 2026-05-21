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
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { useColors, AppColors } from '../theme/useColors';
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
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [subSheet, setSubSheet] = useState<
    'none' | 'rename' | 'move' | 'share' | 'tags' | 'versions' | 'comments'
  >('none');
  const [renameValue, setRenameValue] = useState('');
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  const store = useFileStore();

  // Reset state when target changes
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
      Toast.show({ type: 'error', text1: 'Impossible de charger les dossiers' });
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
      Toast.show({ type: 'success', text1: 'Renommé' });
      onClose();
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur lors du renommage' });
    }
  };

  const handleMoveTo = async (folderId?: string) => {
    try {
      if (isFile) {
        await store.moveFile(target.data.id, folderId);
      } else {
        const destination = folderId ? allFolders.find((folder) => folder.id === folderId) : undefined;
        if (destination && isInvalidFolderDestination(destination)) {
          Toast.show({ type: 'error', text1: 'Destination invalide' });
          return;
        }
        await store.moveFolder(target.data.id, folderId);
      }
      Toast.show({ type: 'success', text1: 'Déplacé' });
      onClose();
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur lors du déplacement' });
    }
  };

  const handleDelete = () => {
    Alert.alert(
      isFile ? 'Supprimer ce fichier ?' : 'Supprimer ce dossier ?',
      isFile
        ? 'Le fichier sera déplacé dans la corbeille.'
        : 'Le dossier et tout son contenu seront supprimés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isFile) {
                await store.deleteFile(target.data.id);
              } else {
                await store.deleteFolder(target.data.id);
              }
              Toast.show({ type: 'success', text1: 'Supprimé' });
              onClose();
            } catch {
              Toast.show({ type: 'error', text1: 'Erreur lors de la suppression' });
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
      Toast.show({ type: 'error', text1: 'Impossible d\'ouvrir le fichier' });
    }
  };

  const handleDownloadZip = async () => {
    if (isFile) return;
    try {
      Toast.show({ type: 'info', text1: 'Préparation du ZIP…' });
      const localUri = await folderService.downloadAsZip(target.data.id, target.data.name);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Toast.show({ type: 'error', text1: 'Le partage de fichiers n\'est pas disponible sur cet appareil' });
        return;
      }
      await Sharing.shareAsync(localUri, {
        mimeType: 'application/zip',
        dialogTitle: 'Enregistrer ou partager le ZIP',
        UTI: 'public.zip-archive',
      });
      onClose();
    } catch {
      Toast.show({ type: 'error', text1: 'Impossible de télécharger le dossier' });
    }
  };

  // ── Sub sheet: Rename ─────────────────────────────────
  if (subSheet === 'rename') {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setSubSheet('none')}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Renommer</Text>
            <TextInput
              style={styles.input}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Nouveau nom"
              placeholderTextColor={colors.neutral[400]}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.dialogActions}>
              <TouchableOpacity onPress={() => setSubSheet('none')} style={styles.btnGhost}>
                <Text style={styles.btnGhostText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRename} style={styles.btnPrimary}>
                <Text style={styles.btnPrimaryText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  // ── Sub sheet: Share ─────────────────────────────────
  if (subSheet === 'share') {
    return (
      <ShareModal
        target={target}
        onClose={() => { setSubSheet('none'); onClose(); }}
      />
    );
  }

  // ── Sub sheet: Tags (files only) ─────────────────────
  if (subSheet === 'tags' && isFile) {
    return (
      <TagsPicker
        file={target.data as FileItem}
        onClose={() => { setSubSheet('none'); onClose(); }}
      />
    );
  }

  // ── Sub sheet: Versions (files only) ─────────────────
  if (subSheet === 'versions' && isFile) {
    return (
      <VersionsPanel
        file={target.data as FileItem}
        onClose={() => { setSubSheet('none'); onClose(); }}
        onRestored={() => store.refresh()}
      />
    );
  }

  // ── Sub sheet: Comments (files only) ─────────────────
  if (subSheet === 'comments' && isFile) {
    return (
      <CommentsPanel
        file={target.data as FileItem}
        onClose={() => { setSubSheet('none'); onClose(); }}
      />
    );
  }

  // ── Sub sheet: Move ──────────────────────────────────
  if (subSheet === 'move') {
    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setSubSheet('none')}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '80%' }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Déplacer vers</Text>
              <TouchableOpacity onPress={() => setSubSheet('none')}>
                <Ionicons name="close" size={24} color={colors.neutral[500]} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              <TouchableOpacity style={styles.folderItem} onPress={() => handleMoveTo(undefined)}>
                <Ionicons name="home-outline" size={20} color={colors.primary[600]} />
                <Text style={styles.folderItemText}>Racine</Text>
              </TouchableOpacity>
              {loadingFolders && <Text style={styles.muted}>Chargement…</Text>}
              {availableMoveFolders
                .map((f) => (
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
                <Text style={styles.muted}>Aucun autre dossier</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Main actions sheet ────────────────────────────────
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
              label="Sélectionner"
              onPress={() => { onSelect(); onClose(); }}
              colors={colors}
              styles={styles}
            />
          )}
          <ActionRow icon="create-outline" label="Renommer" onPress={() => setSubSheet('rename')} colors={colors} styles={styles} />
          <ActionRow
            icon="move-outline"
            label="Déplacer"
            onPress={() => {
              setSubSheet('move');
              loadFolders();
            }}
            colors={colors}
            styles={styles}
          />
          <ActionRow icon="share-social-outline" label="Partager" onPress={() => setSubSheet('share')} colors={colors} styles={styles} />
          {isFile ? (
            <>
              <ActionRow icon="pricetags-outline" label="Tags" onPress={() => setSubSheet('tags')} colors={colors} styles={styles} />
              <ActionRow icon="chatbubble-outline" label="Commentaires" onPress={() => setSubSheet('comments')} colors={colors} styles={styles} />
              <ActionRow icon="time-outline" label="Historique des versions" onPress={() => setSubSheet('versions')} colors={colors} styles={styles} />
              <ActionRow icon="download-outline" label="Télécharger" onPress={handleDownload} colors={colors} styles={styles} />
            </>
          ) : (
            <ActionRow icon="archive-outline" label="Télécharger en ZIP" onPress={handleDownloadZip} colors={colors} styles={styles} />
          )}
          <ActionRow
            icon="trash-outline"
            label="Supprimer"
            destructive
            onPress={handleDelete}
            colors={colors}
            styles={styles}
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
  colors,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  colors: AppColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const color = destructive ? colors.error : colors.neutral[800];
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.white,
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
    backgroundColor: c.neutral[200],
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
    marginBottom: spacing.xs,
  },
  sheetTitle: {
    ...typography.h4,
    color: c.neutral[800],
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
    backgroundColor: c.white,
    margin: spacing.xl,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows['2xl'],
  },
  dialogTitle: {
    ...typography.h4,
    color: c.neutral[800],
    marginBottom: spacing.lg,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: c.neutral[50],
    borderWidth: 1,
    borderColor: c.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: c.neutral[900],
  },
  btnGhost: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  btnGhostText: {
    ...typography.button,
    color: c.neutral[500],
  },
  btnPrimary: {
    backgroundColor: c.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  btnPrimaryText: {
    ...typography.button,
    color: c.white,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  folderItemText: {
    ...typography.body,
    color: c.neutral[800],
    flex: 1,
  },
  muted: {
    ...typography.caption,
    color: c.neutral[400],
    textAlign: 'center',
    padding: spacing.lg,
  },
});
