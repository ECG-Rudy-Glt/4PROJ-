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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../stores/useAuthStore';
import { RootStackParamList } from '../../types';
import OAuthButtons from '../../components/OAuthButtons';

function validatePassword(password: string) {
  return {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

type PasswordRuleKey = 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';

const PASSWORD_RULE_KEYS: PasswordRuleKey[] = ['length', 'uppercase', 'lowercase', 'number', 'special'];

type Nav = NativeStackNavigationProp<RootStackParamList, 'Register'>;

export default function RegisterScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const pwdChecks = validatePassword(password);
  const isPasswordValid = Object.values(pwdChecks).every(Boolean);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      Toast.show({ type: 'error', text1: t('auth.register.error_empty') });
      return;
    }
    if (!isPasswordValid) {
      Toast.show({ type: 'error', text1: t('auth.register.error_weak'), text2: t('auth.register.error_weak_detail') });
      return;
    }
    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: t('auth.register.error_mismatch') });
      return;
    }

    setLoading(true);
    try {
      const result = await authService.register({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      if ('mfaSetupRequired' in result && result.mfaSetupRequired) {
        navigation.navigate('MfaVerify', {
          tempToken: result.tempToken,
          userId: result.userId,
          mfaSetupRequired: true,
        });
        return;
      }

      Toast.show({
        type: 'error',
        text1: t('auth.register.error_incomplete'),
        text2: t('auth.register.error_incomplete_detail'),
      });
    } catch (err: any) {
      const msg = err.response?.data?.error || t('common.error');
      Toast.show({ type: 'error', text1: t('common.error'), text2: msg });
    } finally {
      setLoading(false);
    }
  };

  const getRuleLabel = (key: PasswordRuleKey): string => {
    return t(`auth.register.rule_${key}`);
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
            source={require('../../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>{t('auth.register.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>{t('auth.register.firstname_label')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.register.firstname_placeholder')}
                placeholderTextColor={colors.neutral[400]}
                autoCapitalize="words"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>{t('auth.register.lastname_label')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.register.lastname_placeholder')}
                placeholderTextColor={colors.neutral[400]}
                autoCapitalize="words"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <Text style={styles.label}>{t('auth.register.email_label')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.register.email_placeholder')}
            placeholderTextColor={colors.neutral[400]}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>{t('auth.register.password_label')}</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="8 caractères minimum"
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

          {password.length > 0 && (
            <View style={styles.passwordRules}>
              {PASSWORD_RULE_KEYS.map((key) => (
                <Text
                  key={key}
                  style={[styles.ruleText, pwdChecks[key] ? styles.ruleValid : styles.ruleInvalid]}
                >
                  {pwdChecks[key] ? '✓' : '✗'} {getRuleLabel(key)}
                </Text>
              ))}
            </View>
          )}

          <Text style={styles.label}>{t('auth.register.confirm_password_label')}</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.neutral[400]}
            secureTextEntry={!showPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>{t('auth.register.submit')}</Text>
            )}
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
            <Text style={styles.footerText}>{t('auth.register.have_account')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>{t('auth.register.signin')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.primary[50],
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
    color: colors.primary[600],
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.xl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  label: {
    ...typography.label,
    color: colors.neutral[700],
    marginBottom: spacing.xs,
    marginTop: spacing.md,
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
    color: colors.primary[500],
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.primary[600],
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
    color: colors.white,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.neutral[500],
  },
  link: {
    ...typography.bodySmall,
    color: colors.primary[600],
    fontWeight: '600',
  },
  passwordRules: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    gap: 2,
  },
  ruleText: {
    ...typography.caption,
    fontSize: 12,
  },
  ruleValid: {
    color: colors.primary[600],
  },
  ruleInvalid: {
    color: colors.neutral[400],
  },
});
