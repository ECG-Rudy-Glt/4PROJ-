import React, { useEffect } from 'react';
import {
  View, Text, Modal, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, AppColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { useNotificationStore } from '../stores/useNotificationStore';
import { Notification, NotificationType } from '../types';

const typeConfig: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  SHARE:   { icon: 'people-outline',      color: '#3B82F6' },
  COMMENT: { icon: 'chatbubble-outline',  color: '#8B5CF6' },
  QUOTA:   { icon: 'warning-outline',     color: '#F59E0B' },
};

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${Math.floor(hours / 24)}j`;
};

const getDataString = (data: Record<string, unknown> | undefined, key: string): string | undefined => {
  const value = data?.[key];
  return typeof value === 'string' ? value : undefined;
};

const formatNotification = (notification: Notification) => {
  const data = notification.data;
  const usage = typeof data?.usage === 'number' ? data.usage : undefined;
  if (notification.title === 'notifications.share.file_received.title')
    return { title: 'Nouveau fichier partagé', message: `${getDataString(data, 'userName') ?? 'Quelqu\'un'} vous a partagé un fichier.` };
  if (notification.title === 'notifications.share.folder_received.title')
    return { title: 'Nouveau dossier partagé', message: `${getDataString(data, 'userName') ?? 'Quelqu\'un'} vous a partagé un dossier.` };
  if (notification.title.startsWith('notifications.comment.'))
    return { title: 'Nouveau commentaire', message: `${getDataString(data, 'userName') ?? 'Quelqu\'un'} a commenté ${getDataString(data, 'fileName') ?? 'un fichier'}.` };
  if (notification.title.startsWith('notifications.quota.'))
    return { title: 'Quota presque atteint', message: typeof usage === 'number' ? `Votre quota est utilisé à ${usage}%.` : 'Votre espace de stockage approche de sa limite.' };
  return { title: notification.title, message: notification.message };
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onNavigateToShares?: () => void;
}

export default function NotificationCenter({ visible, onClose, onNavigateToShares }: Props) {
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const { notifications, unreadCount, loading, fetch, markAsRead, markAllAsRead, remove } =
    useNotificationStore();

  useEffect(() => { if (visible) fetch(); }, [visible]);

  const renderItem = ({ item }: { item: Notification }) => {
    const cfg = typeConfig[item.type] || typeConfig.SHARE;
    const display = formatNotification(item);
    return (
      <TouchableOpacity
        style={[styles.notifRow, !item.read && styles.notifUnread]}
        onPress={() => {
          markAsRead(item.id);
          if (item.type === 'SHARE' && onNavigateToShares) { onClose(); onNavigateToShares(); }
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.notifIcon, { backgroundColor: `${cfg.color}22` }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={styles.notifTitle}>{display.title}</Text>
          <Text style={styles.notifMessage} numberOfLines={2}>{display.message}</Text>
          <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        <TouchableOpacity onPress={() => remove(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={16} color={colors.neutral[300]} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.neutral[600]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text style={styles.markAllText}>Tout lire</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 60 }} />}
        </View>
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={48} color={colors.neutral[300]} />
                <Text style={styles.emptyText}>Aucune notification</Text>
              </View>
            ) : null
          }
        />
      </View>
    </Modal>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.secondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: c.white, borderBottomWidth: 1, borderBottomColor: c.neutral[100],
    ...shadows.sm,
  },
  closeBtn: { padding: spacing.xs },
  headerTitle: { ...typography.h4, color: c.neutral[800] },
  markAllText: { ...typography.bodySmall, color: c.primary[600], fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  notifRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: c.white, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.sm, gap: spacing.md, ...shadows.sm,
  },
  notifUnread: { borderLeftWidth: 3, borderLeftColor: c.primary[600] },
  notifIcon: {
    width: 36, height: 36, borderRadius: borderRadius.full,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  notifContent: { flex: 1 },
  notifTitle: { ...typography.body, color: c.neutral[800], fontWeight: '600' },
  notifMessage: { ...typography.bodySmall, color: c.neutral[500], marginTop: 2 },
  notifTime: { ...typography.caption, color: c.neutral[400], marginTop: spacing.xs },
  empty: { alignItems: 'center', paddingVertical: spacing['5xl'], gap: spacing.md },
  emptyText: { ...typography.body, color: c.neutral[400] },
});
