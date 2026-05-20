import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image, useColorScheme,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing as sp, borderRadius as br } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import api from '../../services/api';
import { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ResetPassword'>;
type RouteT = RouteProp<RootStackParamList, 'ResetPassword'>;

function validatePassword(password: string) {
  return (
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const token = route.params?.token ?? '';

  const isDark = useColorScheme() === 'dark';
  const logoSource = isDark
    ? require('../../assets/logo-dark.png')
    : require('../../assets/logo-light.png');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [dekRequired, setDekRequired] = useState(false);
  const [forceReset, setForceReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) { setCheckingToken(false); return; }
    api.get(`/auth/reset-password-info?token=${token}`)
      .then((res) => {
        setMfaRequired(res.data?.data?.mfaEnabled ?? res.data?.mfaEnabled ?? false);
        setTokenValid(true);
      })
      .catch(() => setTokenValid(false))
      .finally(() => setCheckingToken(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('auth.register.error_empty') });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: 'error', text1: t('auth.register.error_mismatch') });
      return;
    }
    if (!validatePassword(newPassword)) {
      Toast.show({ type: 'error', text1: t('auth.register.error_weak'), text2: t('auth.register.error_weak_detail') });
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword,
        mfaCode: mfaRequired ? mfaCode : undefined,
        forceReset: forceReset || undefined,
      });
      setSuccess(true);
      setTimeout(() => navigation.navigate('Login'), 3000);
    } catch (err: any) {
      const code = err.response?.data?.code as string | undefined;
      const msg = err.response?.data?.error as string | undefined;
      if (code === 'DEK_RECOVERY_REQUIRED' || code === 'VAULT_RECOVERY_REQUIRED') {
        setDekRequired(true);
      } else if (msg?.toLowerCase().includes('mfa')) {
        Toast.show({ type: 'error', text1: t('auth.mfa.error_invalid') });
      } else {
        Toast.show({ type: 'error', text1: msg || t('common.error') });
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!token || !tokenValid) {
    return (
      <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Image source={logoSource} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.card}>
            <View style={styles.errorBox}>
              <Ionicons name="close-circle" size={48} color={colors.error} />
              <Text style={styles.errorTitle}>{t('auth.reset_password.invalid_token_title')}</Text>
              <Text style={styles.errorMsg}>{t('auth.reset_password.invalid_token_msg')}</Text>
            </View>
            <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.buttonText}>{t('auth.reset_password.request_new')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (success) {
    return (
      <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Image source={logoSource} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.card}>
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
              <Text style={styles.successTitle}>{t('common.success')}</Text>
              <Text style={styles.successMsg}>{t('auth.reset_password.success')}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const canSubmit = !!newPassword && !!confirmPassword && (!mfaRequired || !!mfaCode) && (!dekRequired || forceReset);

  return (
    <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image source={logoSource} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{t('auth.reset_password.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.reset_password.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          {/* Nouveau mot de passe */}
          <Text style={styles.label}>{t('settings.new_password')}</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="••••••••"
              placeholderTextColor={colors.neutral[400]}
              secureTextEntry={!showPassword}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
              <Text style={styles.eyeText}>
                {showPassword ? t('auth.login.hide_password') : t('auth.login.show_password')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Confirmer */}
          <Text style={styles.label}>{t('settings.confirm_password')}</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.neutral[400]}
            secureTextEntry={!showPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {/* MFA */}
          {mfaRequired && (
            <>
              <Text style={styles.label}>{t('auth.mfa.code_label')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.mfa.code_placeholder')}
                placeholderTextColor={colors.neutral[400]}
                keyboardType="number-pad"
                maxLength={6}
                value={mfaCode}
                onChangeText={setMfaCode}
              />
            </>
          )}

          {/* Avertissement DEK/coffre */}
          {dekRequired && (
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>{t('auth.reset_password.dek_title')}</Text>
              <Text style={styles.warningMsg}>{t('auth.reset_password.dek_msg')}</Text>
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setForceReset((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, forceReset && styles.checkboxChecked]}>
                  {forceReset && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={styles.checkLabel}>{t('auth.reset_password.dek_confirm')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.buttonText}>{t('auth.reset_password.submit')}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.backRow} onPress={() => navigation.navigate('Login')}>
            <Ionicons name="arrow-back" size={16} color={colors.neutral[500]} />
            <Text style={styles.backText}>{t('auth.forgot_password.back')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.primary[50] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary[50] },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: sp.xl, paddingVertical: sp['3xl'] },
  header: { alignItems: 'center', marginBottom: sp['2xl'] },
  logo: { width: 80, height: 80, marginBottom: sp.lg },
  title: { ...typography.h3, color: colors.primary[600], marginBottom: sp.xs },
  subtitle: { ...typography.bodySmall, color: colors.neutral[500], textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: br.xl, padding: sp.xl, ...shadows.xl },
  label: { ...typography.label, color: colors.neutral[700], marginBottom: sp.xs, marginTop: sp.md },
  input: {
    backgroundColor: colors.neutral[50], borderWidth: 1, borderColor: colors.neutral[200],
    borderRadius: br.lg, paddingHorizontal: sp.lg, paddingVertical: sp.md,
    ...typography.body, color: colors.neutral[900],
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 80 },
  eyeBtn: { position: 'absolute', right: sp.lg, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { ...typography.caption, color: colors.primary[500], fontWeight: '600' },
  button: {
    backgroundColor: colors.primary[600], borderRadius: br.lg,
    paddingVertical: sp.lg, alignItems: 'center', marginTop: sp.xl, ...shadows.md,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...typography.button, color: colors.white },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp.xs, marginTop: sp.xl },
  backText: { ...typography.bodySmall, color: colors.neutral[500] },
  successBox: { alignItems: 'center', gap: sp.md, paddingVertical: sp.lg },
  successTitle: { ...typography.h4, color: '#16a34a' },
  successMsg: { ...typography.bodySmall, color: colors.neutral[600], textAlign: 'center' },
  errorBox: { alignItems: 'center', gap: sp.md, paddingVertical: sp.lg },
  errorTitle: { ...typography.h4, color: colors.error },
  errorMsg: { ...typography.bodySmall, color: colors.neutral[600], textAlign: 'center' },
  warningBox: {
    marginTop: sp.lg,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: br.lg,
    padding: sp.md,
    gap: sp.sm,
  },
  warningTitle: { ...typography.bodySmall, color: '#92400e', fontWeight: '700' },
  warningMsg: { ...typography.caption, color: '#b45309', lineHeight: 18 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sp.sm, marginTop: sp.xs },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 2,
    borderColor: '#d97706', backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#d97706', borderColor: '#d97706' },
  checkLabel: { ...typography.caption, color: '#92400e', flex: 1, lineHeight: 18 },
});
