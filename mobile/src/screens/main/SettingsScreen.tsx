import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { useAuthStore } from '../../stores/useAuthStore';
import { authService } from '../../services/authService';
import { RootStackParamList } from '../../types';
import NotificationCenter from '../../components/NotificationCenter';
import { useNotificationStore } from '../../stores/useNotificationStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [saving, setSaving] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { user: updated } = await authService.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setUser(updated);
      setEditing(false);
      Toast.show({ type: 'success', text1: 'Profil mis à jour' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur lors de la mise à jour' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Profil</Text>

      {/* Avatar + nom */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.userName}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        {user?.plan && (
          <View style={styles.planBadge}>
            <Text style={styles.planText}>{user.plan}</Text>
          </View>
        )}
      </View>

      {/* Édition profil */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Informations personnelles</Text>
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <Ionicons name={editing ? 'close' : 'create-outline'} size={20} color={colors.primary[600]} />
          </TouchableOpacity>
        </View>

        {editing ? (
          <>
            <Text style={styles.label}>Prénom</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Prénom"
              placeholderTextColor={colors.neutral[400]}
            />
            <Text style={styles.label}>Nom</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Nom"
              placeholderTextColor={colors.neutral[400]}
            />
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <SettingsRow icon="person-outline" label="Prénom" value={user?.firstName || '–'} />
            <SettingsRow icon="person-outline" label="Nom" value={user?.lastName || '–'} />
            <SettingsRow icon="mail-outline" label="Email" value={user?.email || '–'} />
          </>
        )}
      </View>

      {/* Raccourcis */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Raccourcis</Text>

        <TouchableOpacity style={styles.menuRow} onPress={() => setShowNotifs(true)}>
          <Ionicons name="notifications-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Trash')}>
          <Ionicons name="trash-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>Corbeille</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>
      </View>

      {/* Déconnexion */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>

      <NotificationCenter visible={showNotifs} onClose={() => setShowNotifs(false)} />
    </ScrollView>
  );
}

function SettingsRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.neutral[400]} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  pageTitle: {
    ...typography.h2,
    color: colors.primary[600],
    paddingVertical: spacing.md,
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    ...typography.h2,
    color: colors.white,
  },
  userName: {
    ...typography.h3,
    color: colors.neutral[800],
  },
  userEmail: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    marginTop: 2,
  },
  planBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  planText: {
    ...typography.caption,
    color: colors.primary[600],
    fontWeight: '700',
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.neutral[800],
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.neutral[700],
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.neutral[900],
  },
  saveBtn: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.white,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    gap: spacing.sm,
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    width: 60,
  },
  infoValue: {
    ...typography.body,
    color: colors.neutral[800],
    flex: 1,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  menuLabel: {
    ...typography.body,
    color: colors.neutral[800],
    flex: 1,
  },
  badge: {
    backgroundColor: colors.error,
    minWidth: 20,
    height: 20,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    ...shadows.sm,
  },
  logoutText: {
    ...typography.button,
    color: colors.error,
  },
});
