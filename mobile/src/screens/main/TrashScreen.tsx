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
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { fileService } from '../../services/fileService';
import { FileItem } from '../../types';
import EmptyState from '../../components/EmptyState';

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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeleted = useCallback(async () => {
    setLoading(true);
    try {
      const { files } = await fileService.getDeletedFiles();
      setFiles(files);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur de chargement' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeleted();
  }, []);

  const handleRestore = async (fileId: string) => {
    try {
      await fileService.restoreFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      Toast.show({ type: 'success', text1: 'Fichier restauré' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur lors de la restauration' });
    }
  };

  const handleDeletePermanent = (file: FileItem) => {
    Alert.alert(
      'Supprimer définitivement',
      `"${file.name}" sera supprimé définitivement. Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await fileService.deleteFile(file.id, true);
              setFiles((prev) => prev.filter((f) => f.id !== file.id));
              Toast.show({ type: 'success', text1: 'Fichier supprimé définitivement' });
            } catch {
              Toast.show({ type: 'error', text1: 'Erreur de suppression' });
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.primary[600]} />
        </TouchableOpacity>
        <Text style={styles.title}>Corbeille</Text>
      </View>

      <FlatList
        data={files}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchDeleted} tintColor={colors.primary[600]} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="trash-outline"
              title="Corbeille vide"
              subtitle="Les fichiers supprimés apparaîtront ici"
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons name="document-outline" size={20} color={colors.neutral[400]} />
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.meta}>
                {formatSize(item.size)} · Supprimé le {item.deletedAt ? formatDate(item.deletedAt) : '–'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRestore(item.id)} style={styles.actionBtn}>
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
