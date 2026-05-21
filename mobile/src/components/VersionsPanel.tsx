import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useColors, AppColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { FileItem, FileVersion } from '../types';
import { versionService } from '../services/versionService';

interface Props {
  file: FileItem | null;
  onClose: () => void;
  onRestored?: () => void;
}

const formatSize = (bytes: number): string => {
  if (!bytes) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function VersionsPanel({ file, onClose, onRestored }: Props) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) return;
    load();
  }, [file?.id]);

  const load = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await versionService.getFileVersions(file.id);
      setVersions(res.versions ?? []);
    } catch {
      Toast.show({ type: 'error', text1: 'Impossible de charger les versions' });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (v: FileVersion) => {
    if (!file) return;
    Alert.alert('Restaurer cette version ?', `Version ${v.versionNumber} du ${formatDate(v.createdAt)}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Restaurer',
        onPress: async () => {
          try {
            await versionService.restoreVersion(file.id, v.id);
            Toast.show({ type: 'success', text1: 'Version restaurée' });
            onRestored?.();
            load();
          } catch {
            Toast.show({ type: 'error', text1: 'Erreur' });
          }
        },
      },
    ]);
  };

  const handleDelete = (v: FileVersion) => {
    if (!file) return;
    Alert.alert('Supprimer cette version ?', 'Action irréversible', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await versionService.deleteVersion(file.id, v.id);
            Toast.show({ type: 'success', text1: 'Version supprimée' });
            load();
          } catch {
            Toast.show({ type: 'error', text1: 'Erreur' });
          }
        },
      },
    ]);
  };

  if (!file) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Ionicons name="time-outline" size={22} color={colors.primary[600]} />
            <Text style={styles.title} numberOfLines={1}>Historique - {file.name}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 500 }}>
            {loading && (
              <View style={styles.centered}>
                <ActivityIndicator color={colors.primary[600]} />
              </View>
            )}
            {!loading && versions.length === 0 && (
              <Text style={styles.muted}>Aucune version antérieure</Text>
            )}
            {versions.map((v) => (
              <View key={v.id} style={styles.versionRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>v{v.versionNumber}</Text>
                </View>
                <View style={styles.versionInfo}>
                  <Text style={styles.versionName} numberOfLines={1}>{v.name}</Text>
                  <Text style={styles.versionMeta}>
                    {formatSize(v.size)} · {formatDate(v.createdAt)}
                  </Text>
                  {v.createdBy && (
                    <Text style={styles.versionMeta} numberOfLines={1}>
                      par {v.createdBy.firstName || v.createdBy.email}
                    </Text>
                  )}
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => handleRestore(v)} style={styles.iconBtn}>
                    <Ionicons name="refresh-outline" size={20} color={colors.primary[600]} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(v)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h4,
    color: c.neutral[800],
    flex: 1,
  },
  centered: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  muted: {
    ...typography.body,
    color: c.neutral[400],
    textAlign: 'center',
    padding: spacing.xl,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  badge: {
    backgroundColor: c.primary[50],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 40,
    alignItems: 'center',
  },
  badgeText: {
    ...typography.caption,
    color: c.primary[700],
    fontWeight: '700',
  },
  versionInfo: {
    flex: 1,
  },
  versionName: {
    ...typography.body,
    color: c.neutral[800],
    fontWeight: '500',
  },
  versionMeta: {
    ...typography.caption,
    color: c.neutral[400],
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconBtn: {
    padding: spacing.sm,
  },
});
