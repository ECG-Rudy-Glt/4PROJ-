import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { vaultService, VaultStatus } from '../../services/vaultService';

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [mode, setMode] = useState<'idle' | 'setup' | 'unlock' | 'rotate'>('idle');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vaultService.getStatus();
      setStatus(res.status);
    } catch {
      Toast.show({ type: 'error', text1: t('vault.error') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSetup = async () => {
    if (!password || totp.length !== 6) {
      Toast.show({ type: 'error', text1: t('vault.empty') });
      return;
    }
    setActionLoading(true);
    try {
      const res = await vaultService.setup(password, totp);
      setStatus(res.status);
      setMode('idle');
      setPassword('');
      setTotp('');
      Toast.show({ type: 'success', text1: t('vault.setup_success') });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.error || t('vault.error') });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!password || totp.length !== 6) {
      Toast.show({ type: 'error', text1: t('vault.empty') });
      return;
    }
    setActionLoading(true);
    try {
      const res = await vaultService.unlock(password, totp);
      setStatus(res.status);
      setMode('idle');
      setPassword('');
      setTotp('');
      Toast.show({ type: 'success', text1: t('vault.unlock_success') });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.error || t('vault.error') });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLock = () => {
    Alert.alert(t('vault.lock_btn'), t('common.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('vault.lock_btn'),
        onPress: async () => {
          setActionLoading(true);
          try {
            const res = await vaultService.lock();
            setStatus(res.status);
            Toast.show({ type: 'success', text1: t('vault.lock_success') });
          } catch {
            Toast.show({ type: 'error', text1: t('vault.error') });
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleRotate = async () => {
    if (!password || !newPassword || totp.length !== 6) {
      Toast.show({ type: 'error', text1: t('vault.empty') });
      return;
    }
    setActionLoading(true);
    try {
      const res = await vaultService.rotatePassword(password, newPassword, totp);
      setStatus(res.status);
      setMode('idle');
      setPassword('');
      setNewPassword('');
      setTotp('');
      Toast.show({ type: 'success', text1: t('vault.change_success') });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.error || t('vault.error') });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  const needsMFA = status ? !status.mfaEnabled : false;

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>{t('vault.title')}</Text>

      {needsMFA && (
        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={20} color={colors.accent.warm} />
          <Text style={styles.warningText}>
            {t('vault.warning_text')}
          </Text>
        </View>
      )}

      <View style={styles.statusCard}>
        <View style={styles.statusIcon}>
          <Ionicons
            name={status?.enabled ? (status.unlocked ? 'lock-open' : 'lock-closed') : 'lock-closed-outline'}
            size={32}
            color={status?.enabled ? (status.unlocked ? colors.primary[500] : colors.neutral[600]) : colors.neutral[400]}
          />
        </View>
        <Text style={styles.statusTitle}>
          {!status?.enabled ? t('vault.status_unset') : status.unlocked ? t('vault.status_unlocked') : t('vault.status_locked')}
        </Text>
        {status?.unlockUntil && (
          <Text style={styles.statusSub}>
            Expire le {new Date(status.unlockUntil).toLocaleString('fr-FR')}
          </Text>
        )}
        {status?.lockedUntil && (
          <Text style={[styles.statusSub, { color: colors.error }]}>
            Bloqué jusqu'au {new Date(status.lockedUntil).toLocaleString('fr-FR')}
          </Text>
        )}
      </View>

      {!status?.enabled && !needsMFA && mode === 'idle' && (
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setMode('setup')}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.white} />
          <Text style={styles.primaryBtnText}>{t('vault.setup_btn')}</Text>
        </TouchableOpacity>
      )}

      {status?.enabled && !status.unlocked && mode === 'idle' && (
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setMode('unlock')} disabled={needsMFA}>
          <Ionicons name="lock-open-outline" size={18} color={colors.white} />
          <Text style={styles.primaryBtnText}>{t('vault.unlock_btn')}</Text>
        </TouchableOpacity>
      )}

      {status?.enabled && status.unlocked && mode === 'idle' && (
        <View style={styles.row}>
          <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={handleLock} disabled={actionLoading}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.primary[600]} />
            <Text style={styles.secondaryBtnText}>{t('vault.lock_btn')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setMode('rotate')}>
            <Ionicons name="key-outline" size={18} color={colors.primary[600]} />
            <Text style={styles.secondaryBtnText}>{t('vault.change_password_btn')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {(mode === 'setup' || mode === 'unlock') && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{mode === 'setup' ? t('vault.setup_btn') : t('vault.unlock_btn')}</Text>
          <Text style={styles.label}>{t('vault.password_label')}</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder={t('vault.password_label')}
            placeholderTextColor={colors.neutral[400]}
          />
          <Text style={styles.label}>{t('auth.mfa.code_label')}</Text>
          <TextInput
            style={styles.input}
            value={totp}
            onChangeText={setTotp}
            placeholder={t('auth.mfa.code_placeholder')}
            keyboardType="number-pad"
            maxLength={6}
            placeholderTextColor={colors.neutral[400]}
          />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => { setMode('idle'); setPassword(''); setTotp(''); }}>
              <Text style={styles.secondaryBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1 }]}
              onPress={mode === 'setup' ? handleSetup : handleUnlock}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.primaryBtnText}>{mode === 'setup' ? t('vault.setup_btn') : t('vault.unlock_btn')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {mode === 'rotate' && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{t('vault.change_password_btn')}</Text>
          <Text style={styles.label}>{t('settings.old_password')}</Text>
          <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder={t('settings.old_password')} placeholderTextColor={colors.neutral[400]} />
          <Text style={styles.label}>{t('vault.new_password_label')}</Text>
          <TextInput style={styles.input} secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder={t('vault.new_password_label')} placeholderTextColor={colors.neutral[400]} />
          <Text style={styles.label}>{t('auth.mfa.code_label')}</Text>
          <TextInput style={styles.input} value={totp} onChangeText={setTotp} placeholder={t('auth.mfa.code_placeholder')} keyboardType="number-pad" maxLength={6} placeholderTextColor={colors.neutral[400]} />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => { setMode('idle'); setPassword(''); setNewPassword(''); setTotp(''); }}>
              <Text style={styles.secondaryBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleRotate} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.primaryBtnText}>{t('common.edit')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing['5xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { ...typography.h2, color: colors.primary[600], paddingVertical: spacing.md },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FFF8F0',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#FFD9B3',
  },
  warningText: { ...typography.bodySmall, color: colors.neutral[700], flex: 1 },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  statusIcon: { marginBottom: spacing.md },
  statusTitle: { ...typography.h3, color: colors.neutral[800] },
  statusSub: { ...typography.bodySmall, color: colors.neutral[500], marginTop: spacing.xs },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  formTitle: { ...typography.h4, color: colors.neutral[800], marginBottom: spacing.md },
  label: { ...typography.label, color: colors.neutral[700], marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  primaryBtnText: { ...typography.button, color: colors.white },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  secondaryBtnText: { ...typography.button, color: colors.primary[600] },
  error: { color: colors.error },
});
