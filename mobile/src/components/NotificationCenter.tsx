import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { useNotificationStore } from '../stores/useNotificationStore';
import { Notification, NotificationType } from '../types';

const typeConfig: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  SHARE: { icon: 'people-outline', color: '#3B82F6' },
  COMMENT: { icon: 'chatbubble-outline', color: '#8B5CF6' },
  QUOTA: { icon: 'warning-outline', color: colors.warning },
};

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onNavigateToShares?: () => void;
}

export default function NotificationCenter({ visible, onClose, onNavigateToShares }: Props) {
  const { notifications, unreadCount, loading, fetch, markAsRead, markAllAsRead, remove } =
    useNotificationStore();

  useEffect(() => {
    if (visible) fetch();
  }, [visible]);

  const renderItem = ({ item }: { item: Notification }) => {
    const cfg = typeConfig[item.type] || typeConfig.SHARE;

    return (
      <TouchableOpacity
        style={[styles.notifRow, !item.read && styles.notifUnread]}
        onPress={() => {
          markAsRead(item.id);
          if (item.type === 'SHARE' && onNavigateToShares) {
            onClose();
            onNavigateToShares();
          }
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.notifIcon, { backgroundColor: `${cfg.color}15` }]}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={styles.notifTitle}>{item.title}</Text>
          <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.neutral[600]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text style={styles.markAllText}>Tout lire</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  markAllText: {
    ...typography.bodySmall,
    color: colors.primary[600],
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  notifUnread: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    ...typography.body,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  notifMessage: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    marginTop: 2,
  },
  notifTime: {
    ...typography.caption,
    color: colors.neutral[400],
    marginTop: spacing.xs,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.neutral[400],
  },
});
