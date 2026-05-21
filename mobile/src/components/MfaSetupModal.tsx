import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Share as RNShare,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useColors, AppColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { mfaService, MFAStatusResponse, MFASetupResponse } from '../services/mfaService';
import { useAuthStore } from '../stores/useAuthStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step = 'loading' | 'status' | 'qr' | 'verify' | 'done' | 'disable';

export default function MfaSetupModal({ visible, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState<Step>('loading');
  const [status, setStatus] = useState<MFAStatusResponse | null>(null);
  const [setup, setSetup] = useState<MFASetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setStep('loading');
      setCode('');
      setSetup(null);
      setBackupCodes([]);
      setStatus(null);
      loadStatus();
    }
  }, [visible]);

  const loadStatus = async () => {
    setStep('loading');
    try {
      const s = await mfaService.getMFAStatus();
      setStatus(s);
      setStep('status');
    } catch {
      Toast.show({ type: 'error', text1: 'Impossible de charger le statut MFA' });
      onClose();
    }
  };

  const handleStartSetup = async () => {
    setLoading(true);
    try {
      const res = await mfaService.setupMFA();
      setSetup(res);
      setStep('qr');
    } catch {
      Toast.show({ type: 'error', text1: 'Erreur lors de l\'initialisation' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (!setup || code.length !== 6) {
      Toast.show({ type: 'error', text1: 'Entrez les 6 chiffres' });
      return;
    }
    setLoading(true);
    try {
      await mfaService.verifySetup(code, setup.secret, setup.backupCodes, false);
      setBackupCodes(setup.backupCodes);
      if (user) setUser({ ...user, mfaEnabled: true });
      Toast.show({ type: 'success', text1: 'MFA activé' });
      setStep('done');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.error || 'Code invalide' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (code.length !== 6) {
      Toast.show({ type: 'error', text1: 'Entrez les 6 chiffres' });
      return;
    }
    setLoading(true);
    try {
      await mfaService.disableMFA(code);
      if (user) setUser({ ...user, mfaEnabled: false });
      Toast.show({ type: 'success', text1: 'MFA désactivé' });
      onClose();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.error || 'Code invalide' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = () => {
    Alert.prompt(
      'Régénérer les codes',
      'Entrez un code TOTP à 6 chiffres pour confirmer',
      async (token) => {
        if (!token || token.length !== 6) return;
        try {
          const res = await mfaService.regenerateBackupCodes(token);
          setBackupCodes(res.backupCodes);
          setStep('done');
          Toast.show({ type: 'success', text1: 'Nouveaux codes générés' });
        } catch {
          Toast.show({ type: 'error', text1: 'Erreur' });
        }
      },
      'plain-text',
      '',
      'number-pad',
    );
  };

  const handleShareBackupCodes = async () => {
    try {
      await RNShare.share({
        message:
          'Codes de récupération SUPFILE (à conserver précieusement) :\n\n' +
          backupCodes.join('\n'),
      });
    } catch {
      /* cancelled */
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.kavContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary[600]} />
            <Text style={styles.title}>Authentification à deux facteurs</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.neutral[500]} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
            {step === 'loading' && (
              <View style={styles.centered}>
                <ActivityIndicator color={colors.primary[600]} />
              </View>
            )}

            {/* STATUS */}
            {step === 'status' && status && (
              <View>
                <View style={[styles.statusCard, status.mfaEnabled ? styles.statusOn : styles.statusOff]}>
                  <Ionicons
                    name={status.mfaEnabled ? 'checkmark-circle' : 'alert-circle-outline'}
                    size={28}
                    color={status.mfaEnabled ? colors.primary[600] : colors.neutral[500]}
                  />
                  <Text style={styles.statusText}>
                    {status.mfaEnabled ? 'MFA activé' : 'MFA désactivé'}
                  </Text>
                </View>
                {status.mfaEnabled && (
                  <>
                    <Text style={styles.info}>
                      Codes de récupération restants : {status.remainingBackupCodes}
                    </Text>
                    <Text style={styles.info}>
                      Appareils de confiance : {status.activeTrustedDevices}
                    </Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleRegenerate}>
                      <Text style={styles.primaryBtnText}>Régénérer les codes de récupération</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: colors.error }]}
                      onPress={() => setStep('disable')}
                    >
                      <Text style={styles.primaryBtnText}>Désactiver le MFA</Text>
                    </TouchableOpacity>
                  </>
                )}
                {!status.mfaEnabled && (
                  <>
                    <Text style={styles.body}>
                      Activez le MFA pour sécuriser votre compte avec une application comme
                      Google Authenticator, 1Password ou Authy.
                    </Text>
                    <TouchableOpacity
                      style={[styles.primaryBtn, loading && styles.btnDisabled]}
                      onPress={handleStartSetup}
                      disabled={loading}
                    >
                      <Text style={styles.primaryBtnText}>
                        {loading ? 'Initialisation…' : 'Activer le MFA'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* QR */}
            {step === 'qr' && setup && (
              <View>
                <Text style={styles.body}>
                  Scannez ce QR code dans votre application d'authentification.
                </Text>
                <View style={styles.qrWrap}>
                  <Image source={{ uri: setup.qrCodeDataUrl }} style={styles.qrImage} />
                </View>
                <Text style={styles.label}>Ou saisissez cette clé manuellement :</Text>
                <Text selectable style={styles.secret}>{setup.secret}</Text>

                <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('verify')}>
                  <Text style={styles.primaryBtnText}>Continuer</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* VERIFY */}
            {step === 'verify' && (
              <View>
                <Text style={styles.body}>Entrez le code à 6 chiffres affiché par votre application.</Text>
                <TextInput
                  style={styles.codeInput}
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  placeholderTextColor={colors.neutral[300]}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, (code.length !== 6 || loading) && styles.btnDisabled]}
                  onPress={handleVerifySetup}
                  disabled={code.length !== 6 || loading}
                >
                  <Text style={styles.primaryBtnText}>{loading ? 'Vérification…' : 'Activer le MFA'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* DONE - show backup codes */}
            {step === 'done' && backupCodes.length > 0 && (
              <View>
                <Text style={styles.body}>
                  Conservez ces codes de récupération en lieu sûr. Chacun est utilisable une seule fois.
                </Text>
                <View style={styles.codesBox}>
                  {backupCodes.map((c) => (
                    <Text key={c} selectable style={styles.backupCode}>{c}</Text>
                  ))}
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleShareBackupCodes}>
                  <Ionicons name="share-outline" size={18} color={colors.white} />
                  <Text style={styles.primaryBtnText}>Partager / sauvegarder</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.neutral[200] }]} onPress={onClose}>
                  <Text style={[styles.primaryBtnText, { color: colors.neutral[800] }]}>Terminer</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* DISABLE */}
            {step === 'disable' && (
              <View>
                <Text style={styles.body}>
                  Entrez un code à 6 chiffres pour confirmer la désactivation du MFA.
                </Text>
                <TextInput
                  style={styles.codeInput}
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  placeholderTextColor={colors.neutral[300]}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.error }, (code.length !== 6 || loading) && styles.btnDisabled]}
                  onPress={handleDisable}
                  disabled={code.length !== 6 || loading}
                >
                  <Text style={styles.primaryBtnText}>{loading ? '…' : 'Désactiver'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  kavContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
    ...shadows['2xl'],
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.neutral[200],
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h4,
    color: c.neutral[800],
    flex: 1,
  },
  centered: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  statusOn: {
    backgroundColor: c.primary[50],
  },
  statusOff: {
    backgroundColor: c.neutral[50],
  },
  statusText: {
    ...typography.body,
    color: c.neutral[800],
    fontWeight: '600',
  },
  body: {
    ...typography.body,
    color: c.neutral[600],
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  info: {
    ...typography.bodySmall,
    color: c.neutral[600],
    marginBottom: spacing.xs,
  },
  qrWrap: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: c.white,
    borderRadius: borderRadius.lg,
    marginVertical: spacing.md,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  label: {
    ...typography.caption,
    color: c.neutral[500],
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  secret: {
    ...typography.bodySmall,
    fontFamily: 'Menlo',
    color: c.neutral[800],
    backgroundColor: c.neutral[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    textAlign: 'center',
    letterSpacing: 2,
  },
  codeInput: {
    backgroundColor: c.neutral[50],
    borderWidth: 1,
    borderColor: c.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 6,
    color: c.neutral[900],
    marginVertical: spacing.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: c.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  primaryBtnText: {
    ...typography.button,
    color: c.white,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  codesBox: {
    backgroundColor: c.neutral[50],
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  backupCode: {
    ...typography.body,
    fontFamily: 'Menlo',
    color: c.neutral[800],
    textAlign: 'center',
    letterSpacing: 2,
  },
});
