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
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { authService } from '../../services/authService';
import { RootStackParamList } from '../../types';

function validatePassword(password: string) {
  return {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

const PASSWORD_RULES = [
  { key: 'length' as const, label: 'Au moins 12 caractères' },
  { key: 'uppercase' as const, label: 'Une majuscule' },
  { key: 'lowercase' as const, label: 'Une minuscule' },
  { key: 'number' as const, label: 'Un chiffre' },
  { key: 'special' as const, label: 'Un caractère spécial' },
];

type Nav = NativeStackNavigationProp<RootStackParamList, 'Register'>;

export default function RegisterScreen() {
  const navigation = useNavigation<Nav>();

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
      Toast.show({ type: 'error', text1: 'Veuillez remplir tous les champs' });
      return;
    }
    if (!isPasswordValid) {
      Toast.show({ type: 'error', text1: 'Mot de passe trop faible', text2: 'Respectez toutes les règles ci-dessous' });
      return;
    }
    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Les mots de passe ne correspondent pas' });
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
        text1: 'Inscription incomplète',
        text2: 'La configuration MFA est requise pour finaliser le compte.',
      });
    } catch (err: any) {
      const msg = err.response?.data?.error || "Erreur lors de l'inscription";
      Toast.show({ type: 'error', text1: 'Erreur', text2: msg });
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
            source={require('../../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez SUPFILE et stockez vos fichiers en toute sécurité</Text>
        </View>

        <View style={styles.card}>
          {/* Prénom / Nom en ligne */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Prénom</Text>
              <TextInput
                style={styles.input}
                placeholder="Jean"
                placeholderTextColor={colors.neutral[400]}
                autoCapitalize="words"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Nom</Text>
              <TextInput
                style={styles.input}
                placeholder="Dupont"
                placeholderTextColor={colors.neutral[400]}
                autoCapitalize="words"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <Text style={styles.label}>Adresse e-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="nom@exemple.com"
            placeholderTextColor={colors.neutral[400]}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Mot de passe</Text>
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
              <Text style={styles.eyeText}>{showPassword ? 'Masquer' : 'Voir'}</Text>
            </TouchableOpacity>
          </View>

          {password.length > 0 && (
            <View style={styles.passwordRules}>
              {PASSWORD_RULES.map((rule) => (
                <Text
                  key={rule.key}
                  style={[styles.ruleText, pwdChecks[rule.key] ? styles.ruleValid : styles.ruleInvalid]}
                >
                  {pwdChecks[rule.key] ? '✓' : '✗'} {rule.label}
                </Text>
              ))}
            </View>
          )}

          <Text style={styles.label}>Confirmer le mot de passe</Text>
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
              <Text style={styles.buttonText}>Créer mon compte</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>Se connecter</Text>
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
