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
import { useTranslation } from 'react-i18next';
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
import { useI18nStore } from '../../stores/useI18nStore';
import { setLanguage as setAppLanguage } from '../../i18n';

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
  const { t } = useTranslation();

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
  const { lang, setLang } = useI18nStore();
  const [language, setLanguageLocal] = useState<'fr' | 'en'>((user as any)?.language ?? lang);

  const styles = makeStyles(colors);

  useEffect(() => {
    pushService.getPermissionStatus().then((status) => {
      setPushEnabled(status === 'granted');
    });
    // Refresh profile to get accurate mfaEnabled
    authService.getProfile().then(({ user: fresh }) => setUser(fresh)).catch(() => {});
  }, []);

  const setLanguage = (l: 'fr' | 'en') => {
    setLanguageLocal(l);
    setLang(l);
    setAppLanguage(l);
  };

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await api.get('/auth/sessions');
      setSessions(res.data?.data ?? []);
    } catch {
      Toast.show({ type: 'error', text1: t('common.error') });
    } finally {
      setLoadingSessions(false);
    }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: t('settings.avatar_permission') });
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
      Toast.show({ type: 'success', text1: t('settings.avatar_updated') });
    } catch {
      Toast.show({ type: 'error', text1: t('settings.avatar_error') });
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
      Toast.show({ type: 'error', text1: err?.response?.data?.error || t('settings.export_error') });
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
      Toast.show({ type: 'success', text1: t('settings.profile_updated') });
    } catch {
      Toast.show({ type: 'error', text1: t('settings.profile_error') });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      Toast.show({ type: 'error', text1: t('settings.password_empty') });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: 'error', text1: t('settings.password_mismatch') });
      return;
    }
    if (newPassword.length < 12) {
      Toast.show({ type: 'error', text1: t('settings.password_too_short') });
      return;
    }
    setChangingPwd(true);
    try {
      await authService.changePassword(oldPassword, newPassword);
      setShowPasswordChange(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Toast.show({ type: 'success', text1: t('settings.password_changed') });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.error || t('common.error') });
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
        Toast.show({ type: 'success', text1: t('settings.push_disabled') });
      } else {
        const status = await pushService.getPermissionStatus();
        if (status === 'denied') {
          Alert.alert(
            t('settings.push_blocked_title'),
            t('settings.push_blocked_msg'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('settings.open_settings'), onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
        await pushService.subscribe();
        setPushEnabled(true);
        Toast.show({ type: 'success', text1: t('settings.push_enabled') });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.error');
      Toast.show({ type: 'error', text1: message });
    } finally {
      setPushLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    Alert.alert(
      t('settings.sessions_logout_all_title'),
      t('settings.sessions_logout_all_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.sessions_logout_all'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/auth/logout-all');
              logout();
            } catch {
              Toast.show({ type: 'error', text1: t('common.error') });
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.delete_account_title'),
      t('settings.delete_account_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.delete_account_confirm'),
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await api.delete('/auth/account');
              logout();
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.error || t('settings.delete_account_error') });
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(t('settings.logout'), t('common.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';
  const quotaPercent = user ? Math.min(Math.round((user.quotaUsed / user.quotaLimit) * 100), 100) : 0;

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>{t('settings.profile_section')}</Text>

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
          <Text style={styles.sectionTitle}>{t('settings.personal_info')}</Text>
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <Ionicons name={editing ? 'close' : 'create-outline'} size={20} color={colors.primary[600]} />
          </TouchableOpacity>
        </View>

        {editing ? (
          <>
            <Text style={styles.label}>{t('settings.firstname')}</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder={t('settings.firstname')} placeholderTextColor={colors.neutral[400]} />
            <Text style={styles.label}>{t('settings.lastname')}</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder={t('settings.lastname')} placeholderTextColor={colors.neutral[400]} />
            <Text style={styles.label}>{t('settings.language')}</Text>
            <View style={styles.langRow}>
              <TouchableOpacity
                style={[styles.langBtn, language === 'fr' && styles.langBtnActive]}
                onPress={() => setLanguage('fr')}
              >
                <Text style={[styles.langBtnText, language === 'fr' && styles.langBtnTextActive]}>🇫🇷 {t('settings.lang_fr')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                onPress={() => setLanguage('en')}
              >
                <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>🇬🇧 {t('settings.lang_en')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSaveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>{t('common.save')}</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <SettingsRow colors={colors} icon="person-outline" label={t('settings.firstname')} value={user?.firstName || '–'} />
            <SettingsRow colors={colors} icon="person-outline" label={t('settings.lastname')} value={user?.lastName || '–'} />
            <SettingsRow colors={colors} icon="mail-outline" label={t('settings.email')} value={user?.email || '–'} />
            <SettingsRow colors={colors} icon="language-outline" label={t('settings.language')} value={lang === 'en' ? `🇬🇧 ${t('settings.lang_en')}` : `🇫🇷 ${t('settings.lang_fr')}`} />
          </>
        )}
      </View>

      {/* Thème */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.theme_section')}</Text>
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
                {m === 'light' ? t('settings.theme_light') : m === 'dark' ? t('settings.theme_dark') : t('settings.theme_system')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Stockage */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.storage_section')}</Text>
        <SettingsRow colors={colors} icon="cloud-outline" label={t('dashboard.stat_used')} value={user ? formatQuota(user.quotaUsed) : '–'} />
        <SettingsRow colors={colors} icon="pie-chart-outline" label={t('dashboard.quota_title')} value={user ? formatQuota(user.quotaLimit) : '–'} />
        <View style={styles.storageBar}>
          <View style={[styles.storageBarFill, { width: `${quotaPercent}%` }]} />
        </View>
        <Text style={styles.storagePercent}>{quotaPercent}%</Text>
        <TouchableOpacity style={styles.menuRow} onPress={() => setShowPlans(true)}>
          <Ionicons name="diamond-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>{t('settings.upgrade_plan')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>
      </View>

      {/* Sécurité */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.security_section')}</Text>

        <TouchableOpacity style={styles.menuRow} onPress={() => setShowMfa(true)}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>{t('settings.mfa')}</Text>
          <View style={[styles.statusPill, user?.mfaEnabled ? styles.statusPillOn : styles.statusPillOff]}>
            <Text style={[styles.statusPillText, user?.mfaEnabled ? styles.statusPillTextOn : styles.statusPillTextOff]}>
              {user?.mfaEnabled ? t('common.active') : t('common.inactive')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Vault')}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>{t('vault.title')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} onPress={() => setShowPasswordChange(!showPasswordChange)}>
          <Ionicons name="key-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>{t('settings.change_password')}</Text>
          <Ionicons name={showPasswordChange ? 'chevron-up' : 'chevron-down'} size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        {showPasswordChange && (
          <View style={styles.passwordSection}>
            <Text style={styles.label}>{t('settings.old_password')}</Text>
            <TextInput style={styles.input} secureTextEntry value={oldPassword} onChangeText={setOldPassword} placeholder="••••••••" placeholderTextColor={colors.neutral[400]} />
            <Text style={styles.label}>{t('settings.new_password')}</Text>
            <TextInput style={styles.input} secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder={t('auth.register.rule_length')} placeholderTextColor={colors.neutral[400]} />
            <Text style={styles.label}>{t('settings.confirm_password')}</Text>
            <TextInput style={styles.input} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('settings.confirm_password')} placeholderTextColor={colors.neutral[400]} />
            <TouchableOpacity style={[styles.saveBtn, changingPwd && styles.saveBtnDisabled]} onPress={handleChangePassword} disabled={changingPwd}>
              {changingPwd ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>{t('settings.password_change_title')}</Text>}
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
          <Text style={styles.menuLabel}>{t('settings.sessions')}</Text>
          <Ionicons name={showSessions ? 'chevron-up' : 'chevron-down'} size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        {showSessions && (
          <View style={styles.sessionsSection}>
            <Text style={styles.sessionsDesc}>{t('settings.sessions_logout_all_msg')}</Text>
            {loadingSessions ? (
              <ActivityIndicator color={colors.primary[600]} />
            ) : sessions.length === 0 ? (
              <Text style={styles.emptyText}>{t('settings.sessions_loading')}</Text>
            ) : (
              sessions.map((s: any) => (
                <View key={s.id} style={styles.sessionRow}>
                  <Ionicons name="phone-portrait-outline" size={18} color={colors.neutral[400]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionDevice}>{s.deviceInfo ?? t('common.unknown_device')}</Text>
                    <Text style={styles.sessionMeta}>IP : {s.ipAddress ?? '–'} · {s.createdAt ? new Date(s.createdAt).toLocaleDateString('fr-FR') : ''}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(t('settings.sessions_logout_all'), t('common.confirm'), [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('settings.sessions_logout_all'), style: 'destructive', onPress: async () => {
                          try {
                            await api.delete(`/auth/sessions/${s.id}`);
                            Toast.show({ type: 'success', text1: t('settings.session_revoked') });
                            loadSessions();
                          } catch { Toast.show({ type: 'error', text1: t('settings.session_revoke_error') }); }
                        }},
                      ]);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}
            <TouchableOpacity style={styles.logoutAllBtn} onPress={handleLogoutAll}>
              <Ionicons name="log-out-outline" size={16} color={colors.error} />
              <Text style={styles.logoutAllText}>{t('settings.sessions_logout_all')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Raccourcis */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.shortcuts_section')}</Text>

        <View style={styles.menuRow}>
          <Ionicons name="notifications-outline" size={20} color={pushService.isSupported() ? colors.primary[600] : colors.neutral[300]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuLabel, !pushService.isSupported() && { color: colors.neutral[400] }]}>{t('settings.push_notifications')}</Text>
            {!pushService.isSupported() && (
              <Text style={styles.pushUnsupported}>{t('settings.push_blocked_msg')}</Text>
            )}
          </View>
          {pushService.isSupported() && (
            pushLoading ? (
              <ActivityIndicator size="small" color={colors.primary[600]} />
            ) : (
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                trackColor={{ false: colors.neutral[200], true: colors.primary[400] }}
                thumbColor={pushEnabled ? colors.primary[600] : colors.neutral[400]}
              />
            )
          )}
        </View>

        <TouchableOpacity style={styles.menuRow} onPress={() => setShowNotifs(true)}>
          <Ionicons name="notifications-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>{t('settings.notifications_center')}</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Trash')}>
          <Ionicons name="trash-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>{t('settings.trash')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} onPress={() => setShowAccountSwitcher(true)}>
          <Ionicons name="swap-horizontal-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>{t('settings.linked_accounts')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Audit')}>
          <Ionicons name="list-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>{t('settings.audit_logs')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
        </TouchableOpacity>

        {user?.role === 'ADMIN' && (
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Admin')}>
            <Ionicons name="shield-outline" size={20} color={colors.primary[600]} />
            <Text style={styles.menuLabel}>{t('settings.admin_panel')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
          </TouchableOpacity>
        )}
      </View>

      {/* RGPD */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.rgpd_section')}</Text>

        <TouchableOpacity style={styles.menuRow} onPress={handleExportData} disabled={exporting}>
          <Ionicons name="download-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.menuLabel}>{t('settings.export_data')}</Text>
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary[600]} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
          )}
        </TouchableOpacity>
      </View>

      {/* Zone dangereuse */}
      <View style={[styles.section, styles.dangerSection]}>
        <Text style={[styles.sectionTitle, { color: colors.error }]}>{t('settings.danger_section')}</Text>
        <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount} disabled={deletingAccount}>
          {deletingAccount ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={styles.dangerBtnText}>{t('settings.delete_account')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Déconnexion */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>{t('settings.logout')}</Text>
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
    sessionsDesc: {
      ...typography.caption,
      color: colors.neutral[500],
      marginBottom: spacing.sm,
      lineHeight: 18,
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
    pushUnsupported: {
      ...typography.caption,
      color: colors.neutral[400],
      marginTop: 2,
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
