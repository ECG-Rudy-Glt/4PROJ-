import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  SafeAreaView, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { shadows } from '../theme/shadows';
import { useAuthStore } from '../stores/useAuthStore';
import { authService } from '../services/authService';
import api from '../services/api';
import { Plan } from '../types';

// ── Données des plans ─────────────────────────────────────────────────────────

type PlanDef = {
  id: Plan;
  name: string;
  price: string;
  period?: string;
  storage: string;
  popular?: boolean;
  accentColor: string;
  features: Array<{ label: string; included: boolean }>;
};

const PLANS: PlanDef[] = [
  {
    id: 'FREE',
    name: 'Gratuit',
    price: '0 €',
    period: '/mois',
    storage: '30 Go',
    accentColor: '#2563eb',
    features: [
      { label: 'Stockage sécurisé', included: true },
      { label: 'Partage de base', included: true },
      { label: 'Hébergement en France', included: true },
      { label: 'Assistant Bobby (IA)', included: false },
      { label: 'Coffre-fort chiffré', included: false },
      { label: 'Édition OnlyOffice', included: false },
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: '9,99 €',
    period: '/mois',
    storage: '200 Go',
    popular: true,
    accentColor: '#7c3aed',
    features: [
      { label: 'Assistant Bobby (IA)', included: true },
      { label: 'Coffre-fort chiffré', included: true },
      { label: 'Partage avancé', included: true },
      { label: 'Édition OnlyOffice', included: true },
      { label: '10 versions par fichier', included: true },
      { label: 'Support e-mail 48h', included: true },
    ],
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    price: '24,99 €',
    period: '/mois',
    storage: '2 To',
    accentColor: '#ea580c',
    features: [
      { label: 'IA avancée', included: true },
      { label: 'Coffre-fort chiffré', included: true },
      { label: 'Partage avancé', included: true },
      { label: 'Édition OnlyOffice', included: true },
      { label: '25 versions par fichier', included: true },
      { label: 'Support e-mail 24h', included: true },
    ],
  },
  {
    id: 'ENTERPRISE',
    name: 'Entreprise',
    price: 'Sur devis',
    storage: '10 To',
    accentColor: '#0f766e',
    features: [
      { label: 'Tout Business inclus', included: true },
      { label: 'Organisations multi-comptes', included: true },
      { label: 'SLA garanti', included: true },
      { label: 'Support prioritaire', included: true },
      { label: 'Déploiement on-premise', included: true },
      { label: 'Versions illimitées', included: true },
    ],
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ── Stripe WebView modal ──────────────────────────────────────────────────────

interface StripeWebViewProps {
  url: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function StripeWebView({ url, onSuccess, onCancel }: StripeWebViewProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={stripeStyles.header}>
        <TouchableOpacity onPress={onCancel} style={stripeStyles.backBtn}>
          <Ionicons name="close" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={stripeStyles.headerTitle}>Paiement sécurisé</Text>
        <View style={{ width: 36 }} />
      </View>
      <WebView
        source={{ uri: url }}
        style={{ flex: 1 }}
        originWhitelist={['*']}
        onNavigationStateChange={(state) => {
          // Détecter les redirections success/cancel de Stripe
          if (state.url?.includes('checkout=success')) {
            onSuccess();
          } else if (state.url?.includes('checkout=cancel')) {
            onCancel();
          }
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={stripeStyles.loader}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={stripeStyles.loaderText}>Chargement du paiement…</Text>
          </View>
        )}
      />
    </View>
  );
}

const stripeStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1f2937', paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: { ...typography.body, color: colors.white, fontWeight: '600' },
  loader: {
    position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white, gap: spacing.md,
  },
  loaderText: { ...typography.bodySmall, color: colors.neutral[500] },
});

// ── Composant principal ───────────────────────────────────────────────────────

export default function PlansModal({ visible, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const currentPlan = user?.plan ?? 'FREE';
  const isAdmin = user?.role === 'ADMIN';

  const [loading, setLoading] = useState<Plan | null>(null);
  const [stripeUrl, setStripeUrl] = useState<string | null>(null);

  const refreshProfile = async () => {
    try {
      const { user: updated } = await authService.getProfile();
      setUser(updated);
    } catch { /* best effort */ }
  };

  const handleSelect = async (plan: PlanDef) => {
    if (plan.id === currentPlan) return;
    if (plan.id === 'ENTERPRISE') {
      Toast.show({ type: 'info', text1: 'Entreprise', text2: 'Contactez-nous à contact@supfile.fr' });
      return;
    }

    setLoading(plan.id);
    try {
      // Downgrade vers FREE
      if (plan.id === 'FREE') {
        await api.post('/billing/downgrade-free');
        await refreshProfile();
        Toast.show({ type: 'success', text1: 'Forfait mis à jour', text2: 'Vous êtes maintenant sur le plan Gratuit.' });
        setLoading(null);
        return;
      }

      // Tentative checkout Stripe
      try {
        const res = await api.post('/billing/checkout-session', { plan: plan.id });
        const { url } = res.data as { id: string; url: string | null };
        if (url) {
          setStripeUrl(url);
          setLoading(null);
          return;
        }
      } catch (err: any) {
        const code = err?.response?.data?.code;
        // Si Stripe n'est pas configuré → mode simulation (admin seulement)
        if (code === 'BILLING_NOT_CONFIGURED' || code === 'BILLING_PRICE_NOT_CONFIGURED') {
          if (isAdmin) {
            await api.put('/users/plan', { plan: plan.id });
            await refreshProfile();
            Toast.show({ type: 'success', text1: '✓ Simulation activée', text2: `Plan mis à jour : ${plan.name} (admin bypass)` });
            setLoading(null);
            return;
          }
          Toast.show({
            type: 'info',
            text1: 'Stripe non configuré',
            text2: 'Le paiement n\'est pas encore disponible sur cette instance.',
          });
          setLoading(null);
          return;
        }
        throw err;
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Erreur', text2: err?.response?.data?.error ?? 'Une erreur est survenue.' });
    } finally {
      setLoading(null);
    }
  };

  const handleStripeSuccess = async () => {
    setStripeUrl(null);
    await refreshProfile();
    Toast.show({ type: 'success', text1: '✓ Paiement réussi', text2: 'Votre forfait a été mis à jour.' });
  };

  const handleStripeCancel = () => {
    setStripeUrl(null);
    Toast.show({ type: 'info', text1: 'Paiement annulé' });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Forfaits</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.neutral[600]} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>Choisissez le forfait adapté à vos besoins.</Text>

          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const isLoading = loading === plan.id;

            return (
              <View
                key={plan.id}
                style={[
                  styles.card,
                  isCurrent && { borderColor: plan.accentColor, borderWidth: 2 },
                  plan.popular && styles.cardPopular,
                ]}
              >
                {/* Badge "Populaire" ou "Votre forfait" */}
                {(plan.popular || isCurrent) && (
                  <View style={[styles.badge, { backgroundColor: isCurrent ? plan.accentColor : plan.accentColor }]}>
                    <Text style={styles.badgeText}>{isCurrent ? 'Votre forfait actuel' : 'Populaire'}</Text>
                  </View>
                )}

                {/* Titre + Prix */}
                <View style={styles.cardTop}>
                  <View style={[styles.iconCircle, { backgroundColor: plan.accentColor + '18' }]}>
                    <Ionicons name="cloud-outline" size={22} color={plan.accentColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, { color: plan.accentColor }]}>{plan.name}</Text>
                    <Text style={styles.planStorage}>{plan.storage} de stockage</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.planPrice, { color: plan.accentColor }]}>{plan.price}</Text>
                    {plan.period && <Text style={styles.planPeriod}>{plan.period}</Text>}
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Features */}
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons
                      name={f.included ? 'checkmark-circle' : 'close-circle-outline'}
                      size={17}
                      color={f.included ? '#16a34a' : colors.neutral[300]}
                    />
                    <Text style={[styles.featureText, !f.included && styles.featureTextDim]}>
                      {f.label}
                    </Text>
                  </View>
                ))}

                {/* Bouton action */}
                {!isCurrent && (
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: plan.accentColor }, isLoading && styles.btnDisabled]}
                    onPress={() => handleSelect(plan)}
                    disabled={isLoading || loading !== null}
                    activeOpacity={0.85}
                  >
                    {isLoading
                      ? <ActivityIndicator color={colors.white} size="small" />
                      : <Text style={styles.btnText}>
                          {plan.id === 'ENTERPRISE' ? 'Nous contacter' : 'Choisir ce forfait'}
                        </Text>
                    }
                  </TouchableOpacity>
                )}

                {isCurrent && (
                  <View style={[styles.btn, styles.btnCurrent]}>
                    <Ionicons name="checkmark-circle" size={18} color={plan.accentColor} />
                    <Text style={[styles.btnText, { color: plan.accentColor }]}>Forfait actuel</Text>
                  </View>
                )}
              </View>
            );
          })}

          {isAdmin && (
            <View style={styles.adminNote}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary[600]} />
              <Text style={styles.adminNoteText}>
                Mode admin : si Stripe n'est pas configuré, les changements de plan s'appliquent directement.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Stripe WebView en overlay */}
        {stripeUrl && (
          <StripeWebView
            url={stripeUrl}
            onSuccess={handleStripeSuccess}
            onCancel={handleStripeCancel}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral[50] },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
  },
  headerTitle: { ...typography.h4, color: colors.neutral[800] },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  subtitle: { ...typography.bodySmall, color: colors.neutral[500], marginBottom: spacing.xl, textAlign: 'center' },
  card: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl,
    padding: spacing.xl, marginBottom: spacing.lg,
    ...shadows.md, borderWidth: 1, borderColor: colors.neutral[100],
  },
  cardPopular: { ...shadows.lg },
  badge: {
    alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 3,
    borderRadius: borderRadius.full, marginBottom: spacing.md,
  },
  badgeText: { ...typography.caption, color: colors.white, fontWeight: '700', fontSize: 11 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  planName: { ...typography.h4, fontWeight: '700' },
  planStorage: { ...typography.caption, color: colors.neutral[500], marginTop: 2 },
  planPrice: { ...typography.h4, fontWeight: '800' },
  planPeriod: { ...typography.caption, color: colors.neutral[400] },
  divider: { height: 1, backgroundColor: colors.neutral[100], marginVertical: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  featureText: { ...typography.bodySmall, color: colors.neutral[700], flex: 1 },
  featureTextDim: { color: colors.neutral[400] },
  btn: {
    marginTop: spacing.lg, paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: spacing.xs,
  },
  btnCurrent: { backgroundColor: colors.neutral[50], borderWidth: 1, borderColor: colors.neutral[200] },
  btnDisabled: { opacity: 0.55 },
  btnText: { ...typography.button, color: colors.white },
  adminNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
    backgroundColor: colors.primary[50], borderRadius: borderRadius.lg,
    padding: spacing.md, marginTop: spacing.sm,
  },
  adminNoteText: { ...typography.caption, color: colors.primary[700], flex: 1, lineHeight: 16 },
});
