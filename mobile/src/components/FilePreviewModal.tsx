import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { FileItem } from '../types';
import { fileService } from '../services/fileService';

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

interface Props {
  file: FileItem | null;
  visible: boolean;
  onClose: () => void;
  onDelete?: (fileId: string) => void;
  onToggleFavorite?: (fileId: string) => void;
}

export default function FilePreviewModal({ file, visible, onClose, onDelete, onToggleFavorite }: Props) {
  const [downloading, setDownloading] = useState(false);

  if (!file) return null;

  const isImage = file.mimeType.startsWith('image/');

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = await fileService.getDownloadUrl(file.id);
      await Linking.openURL(url);
    } catch {
      Alert.alert('Erreur', 'Impossible de télécharger le fichier');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    try {
      const url = await fileService.getDownloadUrl(file.id);
      await Share.share({ message: `${file.name}: ${url}` });
    } catch {
      // Cancelled
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer',
      `Voulez-vous supprimer "${file.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            onDelete?.(file.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.neutral[600]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{file.name}</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Preview */}
        <View style={styles.previewArea}>
          {isImage ? (
            <Image
              source={{ uri: file.thumbnailPath || file.storagePath }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Ionicons name="document-outline" size={64} color={colors.neutral[300]} />
              <Text style={styles.previewMime}>{file.mimeType}</Text>
            </View>
          )}
        </View>

        {/* Infos */}
        <View style={styles.infoCard}>
          <InfoRow label="Taille" value={formatSize(file.size)} />
          <InfoRow label="Type" value={file.mimeType} />
          <InfoRow label="Créé le" value={formatDate(file.createdAt)} />
          <InfoRow label="Modifié le" value={formatDate(file.updatedAt)} />
          {file.category && <InfoRow label="Catégorie" value={file.category} />}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <ActionButton
            icon="download-outline"
            label="Télécharger"
            onPress={handleDownload}
            loading={downloading}
          />
          <ActionButton
            icon={file.isFavorite ? 'star' : 'star-outline'}
            label="Favori"
            onPress={() => onToggleFavorite?.(file.id)}
            color={file.isFavorite ? colors.accent.bright : undefined}
          />
          <ActionButton
            icon="share-outline"
            label="Partager"
            onPress={handleShare}
          />
          <ActionButton
            icon="trash-outline"
            label="Supprimer"
            onPress={handleDelete}
            color={colors.error}
          />
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ActionButton({
  icon, label, onPress, color, loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      {loading ? (
        <ActivityIndicator size="small" color={color || colors.primary[600]} />
      ) : (
        <Ionicons name={icon} size={22} color={color || colors.primary[600]} />
      )}
      <Text style={[styles.actionLabel, color ? { color } : null]}>{label}</Text>
    </TouchableOpacity>
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
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  closeBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.neutral[800],
    flex: 1,
    textAlign: 'center',
  },
  previewArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.lg,
  },
  previewPlaceholder: {
    alignItems: 'center',
    gap: spacing.md,
  },
  previewMime: {
    ...typography.bodySmall,
    color: colors.neutral[400],
  },
  infoCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.neutral[500],
  },
  infoValue: {
    ...typography.bodySmall,
    color: colors.neutral[800],
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  actionBtn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionLabel: {
    ...typography.caption,
    color: colors.primary[600],
    fontWeight: '500',
  },
});
