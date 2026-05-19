import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import api from '../../services/api';
import { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: 'Veuillez saisir votre adresse e-mail' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim(), lang: 'fr' });
      setSent(true);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: err?.response?.data?.error ?? 'Une erreur est survenue' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Mot de passe oublié</Text>
          <Text style={styles.subtitle}>
            Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation.
          </Text>
        </View>

        <View style={styles.card}>
          {sent ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
              <Text style={styles.successTitle}>Demande envoyée</Text>
              <Text style={styles.successMsg}>
                Si un compte est associé à cette adresse, un lien de réinitialisation vous a été envoyé. Vérifiez également vos spams.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Adresse e-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="vous@exemple.com"
                placeholderTextColor={colors.neutral[400]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
              <TouchableOpacity
                style={[styles.button, (loading || !email.trim()) && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={loading || !email.trim()}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.buttonText}>Envoyer le lien</Text>
                }
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.backRow} onPress={() => navigation.navigate('Login')}>
            <Ionicons name="arrow-back" size={16} color={colors.neutral[500]} />
            <Text style={styles.backText}>Retour à la connexion</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.primary[50] },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing['3xl'] },
  header: { alignItems: 'center', marginBottom: spacing['2xl'] },
  logo: { width: 80, height: 80, marginBottom: spacing.lg },
  title: { ...typography.h3, color: colors.primary[600], marginBottom: spacing.xs },
  subtitle: { ...typography.bodySmall, color: colors.neutral[500], textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, ...shadows.xl },
  label: { ...typography.label, color: colors.neutral[700], marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.neutral[50], borderWidth: 1, borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    ...typography.body, color: colors.neutral[900],
  },
  button: {
    backgroundColor: colors.primary[600], borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl, ...shadows.md,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...typography.button, color: colors.white },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xl },
  backText: { ...typography.bodySmall, color: colors.neutral[500] },
  successBox: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  successTitle: { ...typography.h4, color: '#16a34a' },
  successMsg: { ...typography.bodySmall, color: colors.neutral[600], textAlign: 'center' },
});
