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
import { useTranslation } from 'react-i18next';
import { useColors, AppColors, useIsDark } from '../../theme/useColors';
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
  const { t } = useTranslation();
  const colors = useColors();
  const isDark = useIsDark();
  const styles = React.useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const route = useRoute<Route>();
  const { tempToken, mfaSetupRequired } = route.params;
  const setAuth = useAuthStore((s) => s.setAuth);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<MFASetupResponse | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);
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
          text1: t('common.error'),
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
      Toast.show({ type: 'error', text1: t('auth.mfa.error_empty') });
      return;
    }

    setLoading(true);
    try {
      if (mfaSetupRequired && setupData) {
        const { token, refreshToken } = await mfaService.verifySetup(
          code,
          setupData.secret,
          setupData.backupCodes,
          false,
        ) as { token: string; refreshToken?: string };
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const profile = await authService.getProfile();
        await setAuth(token, profile.user, profile.session, refreshToken);
        await SecureStore.deleteItemAsync('tempToken');
        Toast.show({ type: 'success', text1: t('common.success') });
      } else {
        const { token, refreshToken } = await authService.verifyMfa({
          tempToken,
          code,
          trustDevice: false,
        });
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const profile = await authService.getProfile();
        await setAuth(token, profile.user, profile.session, refreshToken);
        await SecureStore.deleteItemAsync('tempToken');
        Toast.show({ type: 'success', text1: t('common.success') });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || t('auth.mfa.error_invalid');
      Toast.show({ type: 'error', text1: t('common.error'), text2: msg });
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

          <Text style={styles.title}>
            {mfaSetupRequired ? t('auth.mfa.setup_title') : t('auth.mfa.verify_title')}
          </Text>
          <Text style={styles.subtitle}>
            {mfaSetupRequired ? t('auth.mfa.setup_subtitle') : t('auth.mfa.verify_subtitle')}
          </Text>
        </View>

        <View style={styles.card}>
          {mfaSetupRequired && (
            loadingSetup ? (
              <View style={styles.qrLoading}>
                <ActivityIndicator color={colors.primary[600]} />
                <Text style={styles.qrLoadingText}>{t('auth.mfa.qr_loading')}</Text>
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
                          text1: t('common.error'),
                          text2: t('auth.mfa.copy_secret'),
                        });
                      });
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addAuthButtonText}>{t('auth.mfa.add_to_app')}</Text>
                </TouchableOpacity>

                <View style={styles.secretBox}>
                  <Text style={styles.secretLabel}>{t('auth.mfa.copy_secret')}</Text>
                  <Text style={styles.secretCode} selectable>{setupData.secret}</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => {
                      Clipboard.setString(setupData.secret);
                      Toast.show({ type: 'success', text1: t('auth.mfa.copied') });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.copyButtonText}>{t('auth.mfa.copy')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>{t('auth.mfa.warning')}</Text>
                </View>
              </View>
            ) : null
          )}

          <Text style={styles.label}>{t('auth.mfa.code_label')}</Text>
          <View style={styles.codeRow}>
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
                value={digit}
                onChangeText={(text) => handleDigitChange(text, i)}
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
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('auth.mfa.submit')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: AppColors, isDark: boolean) => StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: c.bg.secondary },
  scrollContent: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing['3xl'],
  },
  header: { alignItems: 'center', marginBottom: spacing['2xl'] },
  iconCircle: {
    width: 64, height: 64, borderRadius: borderRadius.full,
    backgroundColor: c.white, justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.lg, ...shadows.lg,
  },
  iconText: { fontSize: 28 },
  title: { ...typography.h3, color: c.primary[600], marginBottom: spacing.xs, textAlign: 'center' },
  subtitle: { ...typography.bodySmall, color: c.neutral[500], textAlign: 'center', paddingHorizontal: spacing.lg },
  card: { backgroundColor: c.white, borderRadius: borderRadius.xl, padding: spacing.xl, ...shadows.xl },
  qrSection: { alignItems: 'center', marginBottom: spacing.xl },
  qrLoading: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  qrLoadingText: { ...typography.bodySmall, color: c.neutral[500] },
  addAuthButton: {
    backgroundColor: c.primary[600], borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.xl,
    alignItems: 'center', width: '100%', marginBottom: spacing.lg, ...shadows.md,
  },
  addAuthButtonText: { ...typography.button, color: '#fff' },
  secretBox: { backgroundColor: c.neutral[50], borderRadius: borderRadius.md, padding: spacing.md, width: '100%' },
  secretLabel: { ...typography.caption, color: c.neutral[500], marginBottom: spacing.xs },
  secretCode: { ...typography.body, fontWeight: '600', color: c.primary[600], textAlign: 'center', letterSpacing: 2 },
  copyButton: {
    marginTop: spacing.sm, backgroundColor: c.neutral[200],
    borderRadius: borderRadius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    alignSelf: 'center',
  },
  copyButtonText: { ...typography.caption, color: c.neutral[700], fontWeight: '600' },
  warningBox: {
    backgroundColor: isDark ? 'rgba(251,191,36,0.12)' : '#FEF3C7',
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? '#FBBF24' : 'transparent',
    borderRadius: borderRadius.md,
    padding: spacing.md, marginTop: spacing.md, width: '100%',
  },
  warningText: { ...typography.caption, color: isDark ? c.warning : '#92400E', lineHeight: 18 },
  label: { ...typography.label, color: c.neutral[700], marginBottom: spacing.md },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xl },
  codeInput: {
    flex: 1, height: 56, backgroundColor: c.neutral[50],
    borderWidth: 2, borderColor: c.neutral[200], borderRadius: borderRadius.lg,
    textAlign: 'center', fontSize: 22, fontWeight: '700', color: c.neutral[900],
  },
  codeInputFilled: { borderColor: c.primary[500], backgroundColor: c.primary[50] },
  button: {
    backgroundColor: c.primary[600], borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg, alignItems: 'center', ...shadows.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...typography.button, color: '#fff' },
});
