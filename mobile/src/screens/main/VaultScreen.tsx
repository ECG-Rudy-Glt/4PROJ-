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
import { useColors, AppColors } from '../../theme/useColors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { vaultService, VaultStatus } from '../../services/vaultService';

export default function VaultScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
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
      Toast.show({ type: 'error', text1: 'Impossible de charger le statut du coffre' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSetup = async () => {
    if (!password || totp.length !== 6) {
      Toast.show({ type: 'error', text1: 'Mot de passe et code TOTP requis' });
      return;
    }
    setActionLoading(true);
    try {
      const res = await vaultService.setup(password, totp);
      setStatus(res.status);
      setMode('idle');
      setPassword('');
      setTotp('');
      Toast.show({ type: 'success', text1: 'Coffre activé' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.error || 'Erreur lors de l\'activation' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!password || totp.length !== 6) {
      Toast.show({ type: 'error', text1: 'Mot de passe et code TOTP requis' });
      return;
    }
    setActionLoading(true);
    try {
      const res = await vaultService.unlock(password, totp);
      setStatus(res.status);
      setMode('idle');
      setPassword('');
      setTotp('');
      Toast.show({ type: 'success', text1: 'Coffre déverrouillé' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.error || 'Mot de passe ou code invalide' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLock = () => {
    Alert.alert('Verrouiller le coffre', 'Confirmer le verrouillage ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Verrouiller',
        onPress: async () => {
          setActionLoading(true);
          try {
            const res = await vaultService.lock();
            setStatus(res.status);
            Toast.show({ type: 'success', text1: 'Coffre verrouillé' });
          } catch {
            Toast.show({ type: 'error', text1: 'Erreur lors du verrouillage' });
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleRotate = async () => {
    if (!password || !newPassword || totp.length !== 6) {
      Toast.show({ type: 'error', text1: 'Tous les champs sont requis' });
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
      Toast.show({ type: 'success', text1: 'Mot de passe du coffre modifié' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.error || 'Erreur' });
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
      <Text style={styles.pageTitle}>Coffre-fort</Text>

      {needsMFA && (
        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={20} color={colors.accent.warm} />
          <Text style={styles.warningText}>
            Le coffre-fort requiert l'authentification à deux facteurs (MFA). Activez le MFA dans les paramètres de sécurité.
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
          {!status?.enabled ? 'Coffre non configuré' : status.unlocked ? 'Coffre déverrouillé' : 'Coffre verrouillé'}
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
          <Text style={styles.primaryBtnText}>Configurer le coffre</Text>
        </TouchableOpacity>
      )}

      {status?.enabled && !status.unlocked && mode === 'idle' && (
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setMode('unlock')} disabled={needsMFA}>
          <Ionicons name="lock-open-outline" size={18} color={colors.white} />
          <Text style={styles.primaryBtnText}>Déverrouiller</Text>
        </TouchableOpacity>
      )}

      {status?.enabled && status.unlocked && mode === 'idle' && (
        <View style={styles.row}>
          <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={handleLock} disabled={actionLoading}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.primary[600]} />
            <Text style={styles.secondaryBtnText}>Verrouiller</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setMode('rotate')}>
            <Ionicons name="key-outline" size={18} color={colors.primary[600]} />
            <Text style={styles.secondaryBtnText}>Changer le mdp</Text>
          </TouchableOpacity>
        </View>
      )}

      {(mode === 'setup' || mode === 'unlock') && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{mode === 'setup' ? 'Configuration du coffre' : 'Déverrouillage'}</Text>
          <Text style={styles.label}>Mot de passe du coffre</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe"
            placeholderTextColor={colors.neutral[400]}
          />
          <Text style={styles.label}>Code TOTP (MFA)</Text>
          <TextInput
            style={styles.input}
            value={totp}
            onChangeText={setTotp}
            placeholder="6 chiffres"
            keyboardType="number-pad"
            maxLength={6}
            placeholderTextColor={colors.neutral[400]}
          />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => { setMode('idle'); setPassword(''); setTotp(''); }}>
              <Text style={styles.secondaryBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1 }]}
              onPress={mode === 'setup' ? handleSetup : handleUnlock}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.primaryBtnText}>{mode === 'setup' ? 'Configurer' : 'Déverrouiller'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {mode === 'rotate' && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Changer le mot de passe</Text>
          <Text style={styles.label}>Mot de passe actuel</Text>
          <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="Actuel" placeholderTextColor={colors.neutral[400]} />
          <Text style={styles.label}>Nouveau mot de passe</Text>
          <TextInput style={styles.input} secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder="Nouveau" placeholderTextColor={colors.neutral[400]} />
          <Text style={styles.label}>Code TOTP</Text>
          <TextInput style={styles.input} value={totp} onChangeText={setTotp} placeholder="6 chiffres" keyboardType="number-pad" maxLength={6} placeholderTextColor={colors.neutral[400]} />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => { setMode('idle'); setPassword(''); setNewPassword(''); setTotp(''); }}>
              <Text style={styles.secondaryBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleRotate} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.primaryBtnText}>Modifier</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.secondary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing['5xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { ...typography.h2, color: c.primary[600], paddingVertical: spacing.md },
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
  warningText: { ...typography.bodySmall, color: c.neutral[700], flex: 1 },
  statusCard: {
    backgroundColor: c.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  statusIcon: { marginBottom: spacing.md },
  statusTitle: { ...typography.h3, color: c.neutral[800] },
  statusSub: { ...typography.bodySmall, color: c.neutral[500], marginTop: spacing.xs },
  formCard: {
    backgroundColor: c.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  formTitle: { ...typography.h4, color: c.neutral[800], marginBottom: spacing.md },
  label: { ...typography.label, color: c.neutral[700], marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    backgroundColor: c.neutral[50],
    borderWidth: 1,
    borderColor: c.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: c.neutral[900],
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: c.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  primaryBtnText: { ...typography.button, color: c.white },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: c.white,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: c.primary[200],
  },
  secondaryBtnText: { ...typography.button, color: c.primary[600] },
  error: { color: c.error },
});
