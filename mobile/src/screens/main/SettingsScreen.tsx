import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
  Image,
  Switch,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Toast from 'react-native-toast-message';
import { useColors } from '../../theme/useColors';
import { useThemeStore } from '../../stores/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import api from '../../services/api';
import { useAuthStore } from '../../stores/useAuthStore';
import { authService } from '../../services/authService';
import { RootStackParamList, TabParamList } from '../../types';
import NotificationCenter from '../../components/NotificationCenter';
import MfaSetupModal from '../../components/MfaSetupModal';
import AccountSwitcherModal from '../../components/AccountSwitcherModal';
import PlansModal from '../../components/PlansModal';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { pushService } from '../../services/pushService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TabNav = BottomTabNavigationProp<TabParamList>;

const formatQuota = (bytes: number): string => {
  if (bytes === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { mode: themeMode, setMode: setThemeMode } = useThemeStore();
  const navigation = useNavigation<Nav>();
  const tabNavigation = useNavigation<TabNav>();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [saving, setSaving] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [language, setLanguage] = useState<'fr' | 'en'>((user as any)?.language ?? 'fr');

  const styles = makeStyles(colors);

  useEffect(() => {
    pushService.getPermissionStatus().then((status) => {
      setPushEnabled(status === 'granted');
    });
  }, []);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await api.get('/auth/sessions');
      setSessions(res.data?.data ?? []);
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur lors du chargement des sessions' });
    } finally {
      setLoadingSessions(false);
    }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission refusée pour la galerie' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setUploadingAvatar(true);
    try {
      const { user: updated } = await authService.uploadAvatar(uri);
      setUser(updated);
      Toast.show({ type: 'success', text1: 'Avatar mis à jour' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur lors de l\'upload' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const fileUri = await authService.exportUserData();
      await Share.share({ url: fileUri, message: 'Export RGPD de vos données SupFile' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Erreur lors de l\'export' });
    } finally {
      setExporting(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { user: updated } = await authService.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        language,
      } as any);
      setUser(updated);
      setEditing(false);
      Toast.show({ type: 'success', text1: 'Profil mis à jour' });
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur lors de la mise à jour' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      Toast.show({ type: 'error', text1: 'Veuillez remplir tous les champs' });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Les mots de passe ne correspondent pas' });
      return;
    }
    if (newPassword.length < 12) {
      Toast.show({ type: 'error', text1: 'Le mot de passe doit contenir au moins 12 caractères' });
      return;
    }
    setChangingPwd(true);
    try {
      await authService.changePassword(oldPassword, newPassword);
      setShowPasswordChange(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Toast.show({ type: 'success', text1: 'Mot de passe modifié' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || 'Erreur' });
    } finally {
      setChangingPwd(false);
    }
  };

  const handleTogglePush = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await pushService.unsubscribe();
        setPushEnabled(false);
        Toast.show({ type: 'success', text1: 'Notifications désactivées' });
      } else {
        const status = await pushService.getPermissionStatus();
        if (status === 'denied') {
          Alert.alert(
            'Notifications bloquées',
            'Les notifications ont été refusées. Ouvrez les réglages pour les activer.',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Ouvrir les réglages', onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
        await pushService.subscribe();
        setPushEnabled(true);
        Toast.show({ type: 'success', text1: 'Notifications activées' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur';
      Toast.show({ type: 'error', text1: message });
    } finally {
      setPushLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    Alert.alert(
      'Se déconnecter de tous les appareils',
      'Vous serez déconnecté de tous vos appareils actifs.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/auth/logout-all');
              logout();
            } catch {
              Toast.show({ type: 'error', text1: 'Erreur lors de la déconnexion' });
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Votre compte sera désactivé, anonymisé et vos fichiers personnels supprimés. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await api.delete('/auth/account');
              logout();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.error || 'Erreur' });
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
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
  const quotaPercent = user ? Math.min(Math.round((user.quotaUsed / user.quotaLimit) * 100), 100) : 0;

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Profil</Text>

      {/* Avatar + nom */}
      <View style={styles.profileCard}>
        <TouchableOpacity style={styles.avatar} onPress={handlePickAvatar} disabled={uploadingAvatar}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar.startsWith('http') ? user.avatar : `${api.defaults.baseURL?.replace('/api', '')}${user.avatar}` }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
          {uploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.userName}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        {user?.plan && (
          <View style={styles.planBadge}>
            <Text style={styles.planText}>{user.plan}</Text>
          </View>
        )}
        <Text style={styles.accountId}>ID : {user?.id?.slice(0, 8)}…</Text>
      </View>

      {/* Informations personnelles */}
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
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Prénom" placeholderTextColor={colors.neutral[400]} />
            <Text style={styles.label}>Nom</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Nom" placeholderTextColor={colors.neutral[400]} />
            <Text style={styles.label}>Langue</Text>
            <View style={styles.langRow}>
              <TouchableOpacity
                style={[styles.langBtn, language === 'fr' && styles.langBtnActive]}
                onPress={() => setLanguage('fr')}
              >
                <Text style={[styles.langBtnText, language === 'fr' && styles.langBtnTextActive]}>🇫🇷 Français</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                onPress={() => setLanguage('en')}
              >
                <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>🇬🇧 English</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSaveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <SettingsRow colors={colors} icon="person-outline" label="Prénom" value={user?.firstName || '–'} />
            <SettingsRow colors={colors} icon="person-outline" label="Nom" value={user?.lastName || '–'} />
            <SettingsRow colors={colors} icon="mail-outline" label="Email" value={user?.email || '–'} />
            <SettingsRow colors={colors} icon="language-outline" label="Langue" value={(user as any)?.language === 'en' ? '🇬🇧 English' : '🇫🇷 Français'} />
          </>
        )}
      </View>

      {/* Thème */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thème</Text>
        <View style={styles.themeRow}>
          {(['light', 'dark', 'system'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.themeBtn, themeMode === m && styles.themeBtnActive]}
              onPress={() => setThemeMode(m)}
            >
              <Ionicons
                name={m === 'light' ? 'sunny-outline' : m === 'dark' ? 'moon-outline' : 'phone-portrait-outline'}
                size={18}
                color={themeMode === m ? '#FFFFFF' : colors.neutral[500]}
              />
              <Text style={[styles.themeBtnText, themeMode === m && styles.themeBtnTextActive]}>
                {m === 'light' ? 'Clair' : m === 'dark' ? 'Sombre' : 'Système'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Stockage */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Espace de stockage</Text>
        <SettingsRow colors={colors} icon="cloud-outline" label="Utilisé" value={user ? formatQuota(user.quotaUsed) : '–'} />
        <SettingsRow colors={colors} icon="pie-chart-outline" label="Total" value={user ? formatQuota(user.quotaLimit) : '–'} />
        <View style={styles.storageBar}>
          <View style={[styles.storageBarFill, { width: `${quotaPercent}%` }]} />
        </View>
        <Text style={styles.storagePercent}>{quotaPercent}% utilisé</Text>
        <TouchableOpacity style={styles.menuRow} onPress={() => setShowPlans(true)}>
          <Ionicons name="diamond-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>Forfaits & abonnements</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>
      </View>

      {/* Sécurité */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sécurité</Text>

        <TouchableOpacity style={styles.menuRow} onPress={() => setShowMfa(true)}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>Double authentification (MFA)</Text>
          <View style={[styles.statusPill, user?.mfaEnabled ? styles.statusPillOn : styles.statusPillOff]}>
            <Text style={[styles.statusPillText, user?.mfaEnabled ? styles.statusPillTextOn : styles.statusPillTextOff]}>
              {user?.mfaEnabled ? 'Actif' : 'Inactif'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Vault')}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>Coffre-fort chiffré</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} onPress={() => setShowPasswordChange(!showPasswordChange)}>
          <Ionicons name="key-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>Changer le mot de passe</Text>
          <Ionicons name={showPasswordChange ? 'chevron-up' : 'chevron-down'} size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        {showPasswordChange && (
          <View style={styles.passwordSection}>
            <Text style={styles.label}>Mot de passe actuel</Text>
            <TextInput style={styles.input} secureTextEntry value={oldPassword} onChangeText={setOldPassword} placeholder="••••••••" placeholderTextColor={colors.neutral[400]} />
            <Text style={styles.label}>Nouveau mot de passe</Text>
            <TextInput style={styles.input} secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder="12 caractères minimum" placeholderTextColor={colors.neutral[400]} />
            <Text style={styles.label}>Confirmer le nouveau mot de passe</Text>
            <TextInput style={styles.input} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirmez le mot de passe" placeholderTextColor={colors.neutral[400]} />
            <TouchableOpacity style={[styles.saveBtn, changingPwd && styles.saveBtnDisabled]} onPress={handleChangePassword} disabled={changingPwd}>
              {changingPwd ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>Modifier le mot de passe</Text>}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => {
            setShowSessions(true);
            loadSessions();
          }}
        >
          <Ionicons name="desktop-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>Sessions actives</Text>
          <Ionicons name={showSessions ? 'chevron-up' : 'chevron-down'} size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        {showSessions && (
          <View style={styles.sessionsSection}>
            {loadingSessions ? (
              <ActivityIndicator color={colors.primary[600]} />
            ) : sessions.length === 0 ? (
              <Text style={styles.emptyText}>Aucune session active</Text>
            ) : (
              sessions.map((s: any) => (
                <View key={s.id} style={styles.sessionRow}>
                  <Ionicons name="phone-portrait-outline" size={18} color={colors.neutral[400]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionDevice}>{s.deviceInfo ?? 'Appareil inconnu'}</Text>
                    <Text style={styles.sessionMeta}>IP : {s.ipAddress ?? '–'} · {s.createdAt ? new Date(s.createdAt).toLocaleDateString('fr-FR') : ''}</Text>
                  </View>
                </View>
              ))
            )}
            <TouchableOpacity style={styles.logoutAllBtn} onPress={handleLogoutAll}>
              <Ionicons name="log-out-outline" size={16} color={colors.error} />
              <Text style={styles.logoutAllText}>Se déconnecter de tous les appareils</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Raccourcis */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Raccourcis</Text>

        <View style={styles.menuRow}>
          <Ionicons name="notifications-outline" size={20} color={colors.primary[600]} />
          <Text style={[styles.menuLabel, { flex: 1 }]}>Notifications push</Text>
          {pushLoading ? (
            <ActivityIndicator size="small" color={colors.primary[600]} />
          ) : (
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
              trackColor={{ false: colors.neutral[200], true: colors.primary[400] }}
              thumbColor={pushEnabled ? colors.primary[600] : colors.neutral[400]}
            />
          )}
        </View>

        <TouchableOpacity style={styles.menuRow} onPress={() => setShowNotifs(true)}>
          <Ionicons name="notifications-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>Centre de notifications</Text>
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

        <TouchableOpacity style={styles.menuRow} onPress={() => setShowAccountSwitcher(true)}>
          <Ionicons name="swap-horizontal-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>Comptes liés & délégations</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Audit')}>
          <Ionicons name="list-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>Logs d'audit</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        {user?.role === 'ADMIN' && (
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Admin')}>
            <Ionicons name="shield-outline" size={20} color={colors.primary[600]} />
            <Text style={styles.menuLabel}>Panel administrateur</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
          </TouchableOpacity>
        )}
      </View>

      {/* RGPD */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Protection des données (RGPD)</Text>

        <TouchableOpacity style={styles.menuRow} onPress={handleExportData} disabled={exporting}>
          <Ionicons name="download-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>Exporter mes données</Text>
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary[600]} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
          )}
        </TouchableOpacity>
      </View>

      {/* Zone dangereuse */}
      <View style={[styles.section, styles.dangerSection]}>
        <Text style={[styles.sectionTitle, { color: colors.error }]}>Zone dangereuse</Text>
        <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount} disabled={deletingAccount}>
          {deletingAccount ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={styles.dangerBtnText}>Supprimer mon compte</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Déconnexion */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>

      <NotificationCenter
        visible={showNotifs}
        onClose={() => setShowNotifs(false)}
        onNavigateToShares={() => {
          setShowNotifs(false);
          tabNavigation.navigate('Shared');
        }}
      />
      <MfaSetupModal visible={showMfa} onClose={() => setShowMfa(false)} />
      <AccountSwitcherModal visible={showAccountSwitcher} onClose={() => setShowAccountSwitcher(false)} />
      <PlansModal visible={showPlans} onClose={() => setShowPlans(false)} />
    </ScrollView>
  );
}

function SettingsRow({ colors, icon, label, value }: { colors: ReturnType<typeof useColors>; icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.neutral[400]} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
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
      color: '#FFFFFF',
    },
    avatarImage: {
      width: 72,
      height: 72,
      borderRadius: borderRadius.full,
    },
    avatarOverlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
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
    accountId: {
      ...typography.caption,
      color: colors.neutral[400],
      marginTop: spacing.xs,
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
    dangerSection: {
      borderWidth: 1,
      borderColor: colors.error + '40',
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
    langRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    langBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.neutral[200],
      alignItems: 'center',
    },
    langBtnActive: {
      backgroundColor: colors.primary[600],
      borderColor: colors.primary[600],
    },
    langBtnText: {
      ...typography.bodySmall,
      color: colors.neutral[600],
    },
    langBtnTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    themeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    themeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.neutral[200],
    },
    themeBtnActive: {
      backgroundColor: colors.primary[600],
      borderColor: colors.primary[600],
    },
    themeBtnText: {
      ...typography.caption,
      color: colors.neutral[600],
      fontWeight: '500',
    },
    themeBtnTextActive: {
      color: '#FFFFFF',
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
      color: '#FFFFFF',
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
      width: 70,
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
      color: '#FFFFFF',
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
      marginBottom: spacing.lg,
    },
    logoutText: {
      ...typography.button,
      color: colors.error,
    },
    passwordSection: {
      marginTop: spacing.sm,
    },
    storageBar: {
      height: 8,
      backgroundColor: colors.neutral[100],
      borderRadius: borderRadius.full,
      overflow: 'hidden',
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    storageBarFill: {
      height: '100%',
      backgroundColor: colors.primary[500],
      borderRadius: borderRadius.full,
    },
    storagePercent: {
      ...typography.caption,
      color: colors.neutral[400],
      marginBottom: spacing.sm,
    },
    statusPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
      marginRight: spacing.xs,
    },
    statusPillOn: {
      backgroundColor: '#D1FAE5',
    },
    statusPillOff: {
      backgroundColor: colors.neutral[100],
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '700',
    },
    statusPillTextOn: {
      color: '#065F46',
    },
    statusPillTextOff: {
      color: colors.neutral[500],
    },
    sessionsSection: {
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.neutral[100],
    },
    sessionDevice: {
      ...typography.bodySmall,
      color: colors.neutral[800],
      fontWeight: '500',
    },
    sessionMeta: {
      ...typography.caption,
      color: colors.neutral[400],
    },
    logoutAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    logoutAllText: {
      ...typography.bodySmall,
      color: colors.error,
    },
    emptyText: {
      ...typography.bodySmall,
      color: colors.neutral[400],
      textAlign: 'center',
      paddingVertical: spacing.sm,
    },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.error + '60',
    },
    dangerBtnText: {
      ...typography.body,
      color: colors.error,
    },
  });
}
