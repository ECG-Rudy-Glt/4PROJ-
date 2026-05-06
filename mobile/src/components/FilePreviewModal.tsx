import React, { useState, useEffect } from 'react';
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
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { WebView } from 'react-native-webview';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { FileItem } from '../types';
import { fileService } from '../services/fileService';

const SCREEN_WIDTH = Dimensions.get('window').width;

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

interface Props {
  file: FileItem | null;
  visible: boolean;
  onClose: () => void;
  onDelete?: (fileId: string) => void;
  onToggleFavorite?: (fileId: string) => void;
  streamToCache?: (file: FileItem) => Promise<string>;
  downloadToCache?: (file: FileItem) => Promise<string>;
  readOnly?: boolean;
}

// ── Player vidéo/audio (expo-video gère les deux) ─────────────────────────────
function MediaPlayer({ uri, isAudio }: { uri: string; isAudio: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });

  return (
    <VideoView
      style={isAudio ? styles.audioPlayer : styles.videoFill}
      player={player}
      allowsFullscreen={!isAudio}
      allowsPictureInPicture={!isAudio}
    />
  );
}

// ── Viewer PDF ─────────────────────────────────────────────────────────────────
function PdfViewer({ uri }: { uri: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {!loaded && (
        <View style={[StyleSheet.absoluteFill, styles.loaderWrap]}>
          <ActivityIndicator color="white" size="large" />
          <Text style={styles.loadingText}>Chargement du PDF…</Text>
        </View>
      )}
      <WebView
        source={{ uri }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        originWhitelist={['*']}
        javaScriptEnabled
      />
    </View>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function FilePreviewModal({
  file,
  visible,
  onClose,
  onDelete,
  onToggleFavorite,
  streamToCache,
  downloadToCache,
  readOnly = false,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);

  const isImage = !!file && (file.mimeType?.startsWith('image/') ?? false);
  const isVideo = !!file && (file.mimeType?.startsWith('video/') ?? false);
  const isAudio = !!file && (file.mimeType?.startsWith('audio/') ?? false);
  const isPdf   = !!file && file.mimeType === 'application/pdf';

  useEffect(() => {
    if (!file || !visible) {
      setStreamUrl(null);
      return;
    }
    setLoadingStream(true);
    setStreamUrl(null);
    (streamToCache ?? fileService.streamToCache)(file)
      .then((url) => setStreamUrl(url))
      .catch(() => Alert.alert('Erreur', 'Impossible de charger le fichier'))
      .finally(() => setLoadingStream(false));
  }, [file?.id, visible, streamToCache]);

  if (!file) return null;

  const isFullscreen = isVideo || isPdf;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = await (downloadToCache ?? fileService.downloadToCache)(file);
      await Linking.openURL(url);
    } catch {
      Alert.alert('Erreur', 'Impossible de télécharger le fichier');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    try {
      const url = await (downloadToCache ?? fileService.downloadToCache)(file);
      await Share.share({ url, message: file.name });
    } catch { /* cancelled */ }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer', `Voulez-vous supprimer "${file.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { onDelete?.(file.id); onClose(); } },
    ]);
  };

  const renderPreview = () => {
    if (loadingStream) {
      return (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color="white" size="large" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      );
    }

    if (!streamUrl) return null;

    // ── Image ────────────────────────────────────────────────────────────────
    if (isImage) {
      return (
        <Image
          source={{ uri: streamUrl }}
          style={styles.imageFill}
          resizeMode="contain"
          onError={() => Alert.alert('Erreur', "Impossible d'afficher l'image")}
        />
      );
    }

    // ── Vidéo ou Audio ───────────────────────────────────────────────────────
    if (isVideo || isAudio) {
      return <MediaPlayer uri={streamUrl} isAudio={isAudio} />;
    }

    // ── PDF ──────────────────────────────────────────────────────────────────
    if (isPdf) {
      return <PdfViewer uri={streamUrl} />;
    }

    // ── Autre document ───────────────────────────────────────────────────────
    return (
      <View style={styles.docWrap}>
        <View style={styles.iconCircle}>
          <Ionicons name={getDocIcon(file.mimeType)} size={52} color={colors.primary[500]} />
        </View>
        <Text style={styles.docName} numberOfLines={2}>{file.name}</Text>
        <Text style={styles.docMeta}>{file.mimeType}</Text>
        <TouchableOpacity style={styles.openBtn} onPress={() => Linking.openURL(streamUrl)} activeOpacity={0.8}>
          <Ionicons name="open-outline" size={18} color={colors.white} />
          <Text style={styles.openBtnText}>Ouvrir</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={colors.neutral[600]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{file.name}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, isFullscreen && styles.scrollFullscreen]}
          scrollEnabled={!isFullscreen}
          showsVerticalScrollIndicator={false}
        >
          {/* Zone de prévisualisation */}
          <View style={[styles.previewBox, isFullscreen && styles.previewBoxTall]}>
            {renderPreview()}
          </View>

          {/* Infos + actions */}
          {!isFullscreen && (
            <View style={styles.infoCard}>
              <InfoRow label="Taille" value={formatSize(file.size)} />
              <InfoRow label="Type" value={file.mimeType} />
              <InfoRow label="Créé le" value={formatDate(file.createdAt)} />
              <InfoRow label="Modifié le" value={formatDate(file.updatedAt)} />
              {file.folder && <InfoRow label="Dossier" value={file.folder.name} />}
            </View>
          )}

          <View style={[styles.actions, isFullscreen && styles.actionsCompact]}>
            <ActionButton icon="download-outline" label="Télécharger" onPress={handleDownload} loading={downloading} />
            {!readOnly && onToggleFavorite && (
              <ActionButton
                icon={file.isFavorite ? 'star' : 'star-outline'}
                label="Favori"
                onPress={() => onToggleFavorite(file.id)}
                color={file.isFavorite ? colors.accent.bright : undefined}
              />
            )}
            {!readOnly && <ActionButton icon="share-outline" label="Partager" onPress={handleShare} />}
            {!readOnly && onDelete && (
              <ActionButton icon="trash-outline" label="Supprimer" onPress={handleDelete} color={colors.error} />
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function getDocIcon(mimeType: string): keyof typeof Ionicons.glyphMap {
  if (mimeType.includes('pdf')) return 'document-text-outline';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document-outline';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'grid-outline';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'easel-outline';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive-outline';
  if (mimeType.startsWith('text/')) return 'code-slash-outline';
  return 'document-outline';
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ActionButton({ icon, label, onPress, color, loading }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      {loading
        ? <ActivityIndicator size="small" color={color || colors.primary[600]} />
        : <Ionicons name={icon} size={22} color={color || colors.primary[600]} />}
      <Text style={[styles.actionLabel, color ? { color } : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.neutral[200],
  },
  closeBtn: { padding: spacing.xs },
  headerTitle: { ...typography.h4, color: colors.neutral[800], flex: 1, textAlign: 'center' },
  scrollContent: { paddingBottom: spacing['3xl'] },
  scrollFullscreen: { flex: 1, paddingBottom: 0 },
  previewBox: {
    width: SCREEN_WIDTH - spacing.lg * 2,
    height: 300,
    alignSelf: 'center',
    marginVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.neutral[900],
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBoxTall: {
    width: SCREEN_WIDTH,
    height: 460,
    marginVertical: 0,
    borderRadius: 0,
    flex: 1,
  },
  loaderWrap: { alignItems: 'center', gap: spacing.md, justifyContent: 'center' },
  loadingText: { ...typography.caption, color: colors.neutral[400] },
  imageFill: { width: SCREEN_WIDTH - spacing.lg * 2, height: 300 },
  videoFill: { width: SCREEN_WIDTH, height: 460 },
  audioPlayer: { width: SCREEN_WIDTH - spacing.lg * 2, height: 80 },
  docWrap: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  iconCircle: {
    width: 96, height: 96,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    justifyContent: 'center', alignItems: 'center',
  },
  docName: { ...typography.body, color: colors.white, textAlign: 'center', fontWeight: '600' },
  docMeta: { ...typography.caption, color: colors.neutral[400] },
  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primary[600], borderRadius: borderRadius.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.sm,
  },
  openBtnText: { ...typography.button, color: colors.white },
  infoCard: {
    backgroundColor: colors.white, marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl, padding: spacing.lg, ...shadows.md,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
  },
  infoLabel: { ...typography.bodySmall, color: colors.neutral[500] },
  infoValue: {
    ...typography.bodySmall, color: colors.neutral[800],
    fontWeight: '500', maxWidth: '60%', textAlign: 'right',
  },
  actions: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: spacing.xl, paddingHorizontal: spacing.lg,
  },
  actionsCompact: {
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.neutral[200],
  },
  actionBtn: { alignItems: 'center', gap: spacing.xs },
  actionLabel: { ...typography.caption, color: colors.primary[600], fontWeight: '500' },
});
