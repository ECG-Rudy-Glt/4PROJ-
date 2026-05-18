import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { auditService, AuditLog } from '../../services/auditService';

const ACTION_LABELS: Record<string, string> = {
  UPLOAD: 'Fichier importé',
  DELETE: 'Fichier supprimé',
  RESTORE: 'Fichier restauré',
  DOWNLOAD: 'Fichier téléchargé',
  SHARE: 'Partage créé',
  UNSHARE: 'Partage supprimé',
  CREATE_FOLDER: 'Dossier créé',
  DELETE_FOLDER: 'Dossier supprimé',
  MOVE_FILE: 'Fichier déplacé',
  RENAME_FILE: 'Fichier renommé',
  LOGIN: 'Connexion',
  LOGOUT: 'Déconnexion',
  PASSWORD_CHANGE: 'Mot de passe modifié',
  PROFILE_UPDATE: 'Profil mis à jour',
  TAG_ADD: 'Étiquette ajoutée',
  TAG_REMOVE: 'Étiquette supprimée',
  COMMENT_ADD: 'Commentaire ajouté',
  VAULT_SETUP: 'Coffre configuré',
  VAULT_UNLOCK: 'Coffre déverrouillé',
  VAULT_LOCK: 'Coffre verrouillé',
};

const ACTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  UPLOAD: 'cloud-upload-outline',
  DELETE: 'trash-outline',
  RESTORE: 'refresh-outline',
  DOWNLOAD: 'cloud-download-outline',
  SHARE: 'share-outline',
  LOGIN: 'log-in-outline',
  LOGOUT: 'log-out-outline',
  CREATE_FOLDER: 'folder-open-outline',
  VAULT_SETUP: 'shield-checkmark-outline',
  VAULT_UNLOCK: 'lock-open-outline',
  VAULT_LOCK: 'lock-closed-outline',
};

const PAGE_SIZE = 20;

export default function AuditScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchLogs = useCallback(async (offset = 0) => {
    try {
      const res = await auditService.getUserLogs({ limit: PAGE_SIZE, offset });
      if (offset === 0) {
        setLogs(res.logs);
      } else {
        setLogs((prev) => [...prev, ...res.logs]);
      }
      setTotal(res.total);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  const handleLoadMore = () => {
    if (loadingMore || logs.length >= total) return;
    setLoadingMore(true);
    fetchLogs(logs.length);
  };

  const renderItem = ({ item }: { item: AuditLog }) => {
    const icon = ACTION_ICONS[item.action] ?? 'ellipse-outline';
    const label = ACTION_LABELS[item.action] ?? item.action;
    const date = new Date(item.createdAt);

    return (
      <View style={styles.logItem}>
        <View style={styles.logIcon}>
          <Ionicons name={icon} size={18} color={colors.primary[600]} />
        </View>
        <View style={styles.logContent}>
          <Text style={styles.logLabel}>{label}</Text>
          {item.details?.fileName && (
            <Text style={styles.logDetail} numberOfLines={1}>{item.details.fileName}</Text>
          )}
          {item.details?.ipAddress && (
            <Text style={styles.logMeta}>IP : {item.details.ipAddress}</Text>
          )}
        </View>
        <Text style={styles.logDate}>
          {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}{'\n'}
          {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.primary[600]} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Journal d'activité</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={48} color={colors.neutral[300]} />
              <Text style={styles.emptyText}>Aucune activité</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary[600]} style={{ margin: spacing.lg }} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    ...shadows.sm,
  },
  backBtn: { marginRight: spacing.md },
  pageTitle: { ...typography.h3, color: colors.primary[600] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  list: { padding: spacing.lg, gap: spacing.sm },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  logContent: { flex: 1 },
  logLabel: { ...typography.body, color: colors.neutral[800], fontWeight: '600' },
  logDetail: { ...typography.bodySmall, color: colors.neutral[600], marginTop: 2 },
  logMeta: { ...typography.caption, color: colors.neutral[400], marginTop: 2 },
  logDate: { ...typography.caption, color: colors.neutral[400], textAlign: 'right' },
  emptyText: { ...typography.body, color: colors.neutral[400], marginTop: spacing.md },
});
