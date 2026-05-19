import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { auditService, AuditLog } from '../../services/auditService';

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

type AuditCategory = 'all' | 'files' | 'folders' | 'auth' | 'security' | 'sharing';

const AUDIT_CATEGORIES: { key: AuditCategory; actions?: string[] }[] = [
  { key: 'all' },
  { key: 'files', actions: ['UPLOAD', 'DELETE', 'RESTORE', 'DOWNLOAD', 'MOVE_FILE', 'RENAME_FILE'] },
  { key: 'folders', actions: ['CREATE_FOLDER', 'DELETE_FOLDER'] },
  { key: 'auth', actions: ['LOGIN', 'LOGOUT'] },
  { key: 'security', actions: ['PASSWORD_CHANGE', 'PROFILE_UPDATE', 'VAULT_SETUP', 'VAULT_UNLOCK', 'VAULT_LOCK'] },
  { key: 'sharing', actions: ['SHARE', 'UNSHARE'] },
];

const PAGE_SIZE = 150;

export default function AuditScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [category, setCategory] = useState<AuditCategory>('all');

  const getActionLabel = (action: string) =>
    t(`audit.action_${action}`, { defaultValue: action });

  const getCategoryLabel = (key: AuditCategory): string =>
    t(`audit.filter_${key}`);

  const fetchLogs = useCallback(async (offset = 0) => {
    try {
      const res = await auditService.getUserLogs({ limit: PAGE_SIZE, offset });
      const allLogs = offset === 0 ? res.logs : [...logs, ...res.logs];
      if (offset === 0) setLogs(res.logs);
      else setLogs(allLogs);
      setTotal(res.total);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    setLogs([]);
    fetchLogs(0);
  }, [fetchLogs, category]);

  const handleLoadMore = () => {
    if (loadingMore || logs.length >= total) return;
    setLoadingMore(true);
    fetchLogs(logs.length);
  };

  const categoryActions = AUDIT_CATEGORIES.find((c) => c.key === category)?.actions;
  const filteredLogs = categoryActions
    ? logs.filter((l) => categoryActions.includes(l.action))
    : logs;

  const getCount = (cat: AuditCategory) => {
    const actions = AUDIT_CATEGORIES.find((c) => c.key === cat)?.actions;
    return actions ? logs.filter((l) => actions.includes(l.action)).length : logs.length;
  };

  const renderItem = ({ item }: { item: AuditLog }) => {
    const icon = ACTION_ICONS[item.action] ?? 'ellipse-outline';
    const label = getActionLabel(item.action);
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
            <Text style={styles.logMeta}>{t('audit.ip_label', { ip: item.details.ipAddress })}</Text>
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
        <Text style={styles.pageTitle}>{t('audit.title')}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {AUDIT_CATEGORIES.map((c) => {
          const active = category === c.key;
          const count = getCount(c.key);
          return (
            <TouchableOpacity
              key={c.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setCategory(c.key)}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{getCategoryLabel(c.key)}</Text>
              {count > 0 && (
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={48} color={colors.neutral[300]} />
              <Text style={styles.emptyText}>{t('audit.empty')}</Text>
              {category !== 'all' && (
                <TouchableOpacity onPress={() => setCategory('all')} style={styles.showAllBtn}>
                  <Text style={styles.showAllText}>{t('common.see_all')}</Text>
                </TouchableOpacity>
              )}
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
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomColor: colors.neutral[100],
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
  },
  filterChipActive: {
    backgroundColor: colors.primary[600],
  },
  filterLabel: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    fontWeight: '500',
  },
  filterLabelActive: {
    color: '#fff',
  },
  chipBadge: {
    backgroundColor: colors.neutral[300],
    borderRadius: borderRadius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chipBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  chipBadgeTextActive: {
    color: '#fff',
  },
  showAllBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
  },
  showAllText: {
    ...typography.bodySmall,
    color: colors.primary[600],
    fontWeight: '600',
  },
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
