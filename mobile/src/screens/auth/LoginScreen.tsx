import React, { useState } from 'react';
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
  Image,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { useColors, AppColors } from '../../theme/useColors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../stores/useAuthStore';
import { RootStackParamList, MfaRequiredResponse } from '../../types';
import OAuthButtons from '../../components/OAuthButtons';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isDark = useColorScheme() === 'dark';
  const logoSource = isDark
    ? require('../../assets/logo-dark.png')
    : require('../../assets/logo-light.png');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Toast.show({ type: 'error', text1: t('auth.login.error_empty') });
      return;
    }

    setLoading(true);
    try {
      const result = await authService.login({ email: email.trim(), password });

      if (
        ('mfaRequired' in result && result.mfaRequired) ||
        ('mfaSetupRequired' in result && (result as any).mfaSetupRequired)
      ) {
        const mfa = result as MfaRequiredResponse;
        navigation.navigate('MfaVerify', {
          tempToken: mfa.tempToken,
          userId: mfa.userId,
          mfaSetupRequired: (result as any).mfaSetupRequired ?? mfa.mfaSetupRequired,
          qrCode: mfa.qrCode,
          secret: mfa.secret,
        });
        return;
      }

      if ('token' in result && 'user' in result) {
        await setAuth(result.token, result.user, result.authContext, result.refreshToken);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || t('auth.login.error_invalid');
      Toast.show({ type: 'error', text1: t('auth.login.error_prefix'), text2: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={logoSource}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>{t('auth.login.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t('auth.login.email_label')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.login.email_placeholder')}
            placeholderTextColor={colors.neutral[400]}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>{t('auth.login.password_label')}</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="••••••••"
              placeholderTextColor={colors.neutral[400]}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Text style={styles.eyeText}>{showPassword ? t('auth.login.hide_password') : t('auth.login.show_password')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('auth.login.submit')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotRow} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotText}>{t('auth.login.forgot_password')}</Text>
          </TouchableOpacity>

          <OAuthButtons
            onTokenReceived={async (token) => {
              try {
                const { user, session } = await authService.getProfileWithToken(token);
                await setAuth(token, user, session, undefined);
              } catch {
                Toast.show({ type: 'error', text1: t('auth.oauth.error') });
              }
            }}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.login.no_account')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.link}>{t('auth.login.signup')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: c.bg.secondary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['3xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: c.primary[600],
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: c.neutral[500],
    textAlign: 'center',
  },
  card: {
    backgroundColor: c.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.xl,
  },
  label: {
    ...typography.label,
    color: c.neutral[700],
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: c.neutral[50],
    borderWidth: 1,
    borderColor: c.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: c.neutral[900],
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 80,
  },
  eyeBtn: {
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeText: {
    ...typography.caption,
    color: c.primary[500],
    fontWeight: '600',
  },
  button: {
    backgroundColor: c.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.button,
    color: '#fff',
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  forgotText: {
    ...typography.caption,
    color: c.primary[600],
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.bodySmall,
    color: c.neutral[500],
  },
  link: {
    ...typography.bodySmall,
    color: c.primary[600],
    fontWeight: '600',
  },
});
