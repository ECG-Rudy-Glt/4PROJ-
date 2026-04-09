import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
  Clipboard,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { authService } from '../../services/authService';
import { mfaService, MFASetupResponse } from '../../services/mfaService';
import { useAuthStore } from '../../stores/useAuthStore';
import { RootStackParamList } from '../../types';
import api from '../../services/api';

type Route = RouteProp<RootStackParamList, 'MfaVerify'>;

const CODE_LENGTH = 6;

export default function MfaVerifyScreen() {
  const route = useRoute<Route>();
  const { tempToken, userId, mfaSetupRequired } = route.params;
  const setAuth = useAuthStore((s) => s.setAuth);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<MFASetupResponse | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);
  // Guard : n'appeler setupMFA qu'une seule fois même si l'effet re-run (Fast Refresh)
  const setupCalled = useRef(false);

  useEffect(() => {
    if (!mfaSetupRequired || setupCalled.current) return;
    setupCalled.current = true;

    const init = async () => {
      setLoadingSetup(true);
      try {
        await SecureStore.setItemAsync('tempToken', tempToken);
        const data = await mfaService.setupMFA();
        setSetupData(data);
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: 'Erreur de configuration MFA',
          text2: err?.response?.data?.error || err?.message,
        });
      } finally {
        setLoadingSetup(false);
      }
    };
    init();
    return () => {
      SecureStore.deleteItemAsync('tempToken');
    };
  }, []);

  const handleDigitChange = (text: string, index: number) => {
    const cleaned = text.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    if (cleaned.length === CODE_LENGTH) {
      const next = cleaned.split('');
      setDigits(next);
      inputs.current[CODE_LENGTH - 1]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = cleaned[0];
    setDigits(next);
    if (index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
    }
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length !== CODE_LENGTH) {
      Toast.show({ type: 'error', text1: 'Veuillez entrer le code complet' });
      return;
    }

    setLoading(true);
    try {
      if (mfaSetupRequired && setupData) {
        // Valider la configuration MFA avec le code saisi
        const { token } = await mfaService.verifySetup(
          code,
          setupData.secret,
          setupData.backupCodes,
          false,
        );
        // Récupérer le profil avec le nouveau token
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const { user } = await authService.getProfile();
        await setAuth(token, user);
        Toast.show({ type: 'success', text1: 'Double authentification configurée !' });
      } else {
        // MFA déjà configuré — vérification du code
        const { token, user } = await mfaService.verifyMFA(userId, code, false);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const profile = await authService.getProfile();
        await setAuth(token, profile.user);
        Toast.show({ type: 'success', text1: 'Authentification réussie' });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Code invalide';
      Toast.show({ type: 'error', text1: 'Erreur', text2: msg });
      setDigits(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🔐</Text>
          </View>
          <Text style={styles.title}>
            {mfaSetupRequired ? 'Configurer la double authentification' : 'Vérification MFA'}
          </Text>
          <Text style={styles.subtitle}>
            {mfaSetupRequired
              ? "Ajoutez SupFile à votre application d'authentification"
              : "Entrez le code à 6 chiffres de votre application d'authentification"}
          </Text>
        </View>

        <View style={styles.card}>
          {/* Setup MFA : QR code */}
          {mfaSetupRequired && (
            loadingSetup ? (
              <View style={styles.qrLoading}>
                <ActivityIndicator color={colors.primary[600]} />
                <Text style={styles.qrLoadingText}>Génération du QR code…</Text>
              </View>
            ) : setupData ? (
              <View style={styles.qrSection}>
                <TouchableOpacity
                  style={styles.addAuthButton}
                  onPress={() => {
                    if (setupData.otpauthUrl) {
                      Linking.openURL(setupData.otpauthUrl).catch(() => {
                        Toast.show({
                          type: 'error',
                          text1: 'Impossible d\'ouvrir l\'app',
                          text2: 'Copiez la clé secrète ci-dessous et ajoutez-la manuellement.',
                        });
                      });
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addAuthButtonText}>Ajouter à mon app d'authentification</Text>
                </TouchableOpacity>

                <View style={styles.secretBox}>
                  <Text style={styles.secretLabel}>Ou copiez la clé secrète :</Text>
                  <Text style={styles.secretCode} selectable>{setupData.secret}</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => {
                      Clipboard.setString(setupData.secret);
                      Toast.show({ type: 'success', text1: 'Clé copiée !' });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.copyButtonText}>Copier la clé</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    ⚠️ Appuyez sur le bouton ci-dessus pour ajouter SupFile à votre app d'authentification (Google Authenticator, Authy, Apple Mots de passe…).{'\n'}
                    Si vous avez déjà une entrée "SupFile", supprimez-la avant d'ajouter celle-ci.
                  </Text>
                </View>
              </View>
            ) : null
          )}

          {/* Champs OTP */}
          <Text style={styles.label}>Code de vérification</Text>
          <View style={styles.codeRow}>
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
                value={digit}
                onChangeText={(t) => handleDigitChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, (loading || loadingSetup) && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading || loadingSetup || (mfaSetupRequired && !setupData)}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>
                {mfaSetupRequired ? 'Confirmer la configuration' : 'Vérifier'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.primary[50] },
  scrollContent: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing['3xl'],
  },
  header: { alignItems: 'center', marginBottom: spacing['2xl'] },
  iconCircle: {
    width: 64, height: 64, borderRadius: borderRadius.full,
    backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.lg, ...shadows.lg,
  },
  iconText: { fontSize: 28 },
  title: { ...typography.h3, color: colors.primary[600], marginBottom: spacing.xs, textAlign: 'center' },
  subtitle: { ...typography.bodySmall, color: colors.neutral[500], textAlign: 'center', paddingHorizontal: spacing.lg },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, ...shadows.xl },
  qrSection: { alignItems: 'center', marginBottom: spacing.xl },
  qrLoading: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  qrLoadingText: { ...typography.bodySmall, color: colors.neutral[500] },
  addAuthButton: {
    backgroundColor: colors.primary[600], borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.xl,
    alignItems: 'center', width: '100%', marginBottom: spacing.lg, ...shadows.md,
  },
  addAuthButtonText: { ...typography.button, color: colors.white },
  secretBox: { backgroundColor: colors.neutral[50], borderRadius: borderRadius.md, padding: spacing.md, width: '100%' },
  secretLabel: { ...typography.caption, color: colors.neutral[500], marginBottom: spacing.xs },
  secretCode: { ...typography.body, fontWeight: '600', color: colors.primary[600], textAlign: 'center', letterSpacing: 2 },
  copyButton: {
    marginTop: spacing.sm, backgroundColor: colors.neutral[200],
    borderRadius: borderRadius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    alignSelf: 'center',
  },
  copyButtonText: { ...typography.caption, color: colors.neutral[700], fontWeight: '600' },
  hint: { ...typography.caption, color: colors.neutral[400], textAlign: 'center', marginTop: spacing.md },
  warningBox: {
    backgroundColor: '#FEF3C7', borderRadius: borderRadius.md,
    padding: spacing.md, marginTop: spacing.md, width: '100%',
  },
  warningText: { ...typography.caption, color: '#92400E', lineHeight: 18 },
  label: { ...typography.label, color: colors.neutral[700], marginBottom: spacing.md },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xl },
  codeInput: {
    flex: 1, height: 56, backgroundColor: colors.neutral[50],
    borderWidth: 2, borderColor: colors.neutral[200], borderRadius: borderRadius.lg,
    textAlign: 'center', fontSize: 22, fontWeight: '700', color: colors.neutral[900],
  },
  codeInputFilled: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  button: {
    backgroundColor: colors.primary[600], borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg, alignItems: 'center', ...shadows.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...typography.button, color: colors.white },
});
