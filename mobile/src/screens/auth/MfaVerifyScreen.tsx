import React, { useState, useRef } from 'react';
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
import { useRoute, RouteProp } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../stores/useAuthStore';
import { RootStackParamList } from '../../types';

type Route = RouteProp<RootStackParamList, 'MfaVerify'>;

const CODE_LENGTH = 6;

export default function MfaVerifyScreen() {
  const route = useRoute<Route>();
  const { tempToken, mfaSetupRequired, qrCode, secret } = route.params;
  const setAuth = useAuthStore((s) => s.setAuth);

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleDigitChange = (text: string, index: number) => {
    const cleaned = text.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    // Support pasting full code
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
      const result = await authService.verifyMfa({ tempToken, code });
      await setAuth(result.token, result.user, result.authContext);
      Toast.show({ type: 'success', text1: 'Authentification réussie' });
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Code invalide';
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🔐</Text>
          </View>
          <Text style={styles.title}>
            {mfaSetupRequired ? 'Configurer la double authentification' : 'Vérification MFA'}
          </Text>
          <Text style={styles.subtitle}>
            {mfaSetupRequired
              ? "Scannez le QR code avec votre application d'authentification"
              : "Entrez le code à 6 chiffres de votre application d'authentification"}
          </Text>
        </View>

        <View style={styles.card}>
          {/* QR code pour le setup */}
          {mfaSetupRequired && qrCode && (
            <View style={styles.qrSection}>
              <Image
                source={{ uri: qrCode }}
                style={styles.qrImage}
                resizeMode="contain"
              />
              {secret && (
                <View style={styles.secretBox}>
                  <Text style={styles.secretLabel}>Clé secrète (saisie manuelle) :</Text>
                  <Text style={styles.secretCode} selectable>{secret}</Text>
                </View>
              )}
            </View>
          )}

          {/* Champs code OTP */}
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
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Vérifier</Text>
            )}
          </TouchableOpacity>
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
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    ...typography.h3,
    color: colors.primary[600],
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.xl,
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  secretBox: {
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '100%',
  },
  secretLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    marginBottom: spacing.xs,
  },
  secretCode: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary[600],
    textAlign: 'center',
    letterSpacing: 2,
  },
  label: {
    ...typography.label,
    color: colors.neutral[700],
    marginBottom: spacing.md,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  codeInput: {
    flex: 1,
    height: 56,
    backgroundColor: colors.neutral[50],
    borderWidth: 2,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  codeInputFilled: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  button: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.button,
    color: colors.white,
  },
});
