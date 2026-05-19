import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { fileService } from '../../services/fileService';
import { folderService } from '../../services/folderService';
import { FileItem, Folder } from '../../types';
import EmptyState from '../../components/EmptyState';

type TrashItem =
  | { kind: 'file'; data: FileItem }
  | { kind: 'folder'; data: Folder };

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export default function TrashScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeleted = useCallback(async () => {
    setLoading(true);
    try {
      const [{ files }, { folders }] = await Promise.all([
        fileService.getDeletedFiles(),
        folderService.getDeletedFolders(),
      ]);
      const trashItems: TrashItem[] = [
        ...(files ?? []).map((file) => ({ kind: 'file' as const, data: file })),
        ...(folders ?? []).map((folder) => ({ kind: 'folder' as const, data: folder })),
      ].sort((a, b) => {
        const aDate = a.data.deletedAt ? new Date(a.data.deletedAt).getTime() : 0;
        const bDate = b.data.deletedAt ? new Date(b.data.deletedAt).getTime() : 0;
        return bDate - aDate;
      });
      setItems(trashItems);
    } catch {
      Toast.show({ type: 'error', text1: t('common.error') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeleted();
  }, [fetchDeleted]);

  const handleRestore = async (item: TrashItem) => {
    try {
      if (item.kind === 'file') {
        await fileService.restoreFile(item.data.id);
      } else {
        await folderService.restoreFolder(item.data.id);
      }
      await fetchDeleted();
      Toast.show({ type: 'success', text1: t('trash.restored') });
    } catch {
      Toast.show({ type: 'error', text1: t('trash.restore_error') });
    }
  };

  const handleDeletePermanent = (item: TrashItem) => {
    Alert.alert(
      t('trash.delete_confirm_title'),
      t('trash.delete_confirm_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.kind === 'file') {
                await fileService.deleteFile(item.data.id, true);
              } else {
                await folderService.deleteFolder(item.data.id, true);
              }
              await fetchDeleted();
              Toast.show({ type: 'success', text1: t('trash.deleted') });
            } catch {
              Toast.show({ type: 'error', text1: t('trash.delete_error') });
            }
          },
        },
      ],
    );
  };

  const handleEmptyTrash = () => {
    if (items.length === 0) return;
    Alert.alert(
      t('trash.empty_confirm_title'),
      t('trash.empty_confirm_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(
                items.map((item) =>
                  item.kind === 'file'
                    ? fileService.deleteFile(item.data.id, true)
                    : folderService.deleteFolder(item.data.id, true)
                )
              );
              setItems([]);
              Toast.show({ type: 'success', text1: t('trash.title') });
            } catch {
              Toast.show({ type: 'error', text1: t('trash.delete_error') });
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.primary[600]} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('trash.title')}</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleEmptyTrash} style={styles.emptyBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={styles.emptyBtnText}>{t('trash.empty_btn')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => `${item.kind}-${item.data.id}`}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchDeleted} tintColor={colors.primary[600]} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="trash-outline"
              title={t('trash.empty')}
              subtitle={t('trash.empty')}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={item.kind === 'file' ? 'document-outline' : 'folder-outline'}
                size={20}
                color={colors.neutral[400]}
              />
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{item.data.name}</Text>
              <Text style={styles.meta}>
                {item.kind === 'file' ? `${formatSize(item.data.size)} · ` : 'Dossier · '}
                {item.data.deletedAt ? formatDate(item.data.deletedAt) : '–'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRestore(item)} style={styles.actionBtn}>
              <Ionicons name="arrow-undo-outline" size={20} color={colors.primary[500]} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeletePermanent(item)} style={styles.actionBtn}>
              <Ionicons name="close-circle-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
      />
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
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  backBtn: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.primary[600],
    flex: 1,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.error,
  },
  emptyBtnText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.body,
    color: colors.neutral[600],
    fontWeight: '500',
  },
  meta: {
    ...typography.caption,
    color: colors.neutral[400],
    marginTop: 2,
  },
  actionBtn: {
    padding: spacing.xs,
  },
});
