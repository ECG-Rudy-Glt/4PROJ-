import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  description: string;
  storage: string;
  popular?: boolean;
  features: Array<{ label: string; included: boolean }>;
};

const PLANS: PlanDef[] = [
  {
    id: 'FREE',
    name: 'Gratuit',
    price: '0 €',
    period: '/mois',
    description: 'Pour découvrir SupFile',
    storage: '30 Go',
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
    description: 'Pour les professionnels',
    storage: '200 Go',
    popular: true,
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
    description: 'Pour les équipes',
    storage: '2 To',
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
    description: 'Solutions sur mesure',
    storage: '10 To',
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
          if (state.url?.includes('checkout=success')) onSuccess();
          else if (state.url?.includes('checkout=cancel')) onCancel();
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
      if (plan.id === 'FREE') {
        await api.post('/billing/downgrade-free');
        await refreshProfile();
        Toast.show({ type: 'success', text1: 'Forfait mis à jour', text2: 'Vous êtes maintenant sur le plan Gratuit.' });
        setLoading(null);
        return;
      }

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
        if (code === 'BILLING_NOT_CONFIGURED' || code === 'BILLING_PRICE_NOT_CONFIGURED') {
          if (isAdmin) {
            await api.put('/users/plan', { plan: plan.id });
            await refreshProfile();
            Toast.show({ type: 'success', text1: '✓ Simulation activée', text2: `Plan mis à jour : ${plan.name} (admin bypass)` });
            setLoading(null);
            return;
          }
          Toast.show({ type: 'info', text1: 'Stripe non configuré', text2: 'Le paiement n\'est pas encore disponible.' });
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
                  isCurrent && styles.cardCurrent,
                  plan.popular && !isCurrent && styles.cardPopular,
                ]}
              >
                {/* Badge "Recommandé" */}
                {plan.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>RECOMMANDÉ</Text>
                  </View>
                )}

                {/* En-tête plan */}
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planDescription}>{plan.description}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.planPrice}>{plan.price}</Text>
                    {plan.period && <Text style={styles.planPeriod}>{plan.period}</Text>}
                  </View>
                </View>

                {/* Stockage */}
                <View style={styles.storageRow}>
                  <Ionicons name="server-outline" size={16} color={colors.primary[600]} />
                  <Text style={styles.storageText}>
                    <Text style={styles.storageBold}>{plan.storage}</Text>
                    {' '}de stockage sécurisé
                  </Text>
                </View>

                <View style={styles.divider} />

                {/* Features */}
                <View style={styles.featureList}>
                  {plan.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      {f.included ? (
                        <View style={styles.checkCircle}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      ) : (
                        <Ionicons name="close" size={16} color={colors.neutral[300]} />
                      )}
                      <Text style={[styles.featureText, !f.included && styles.featureTextDim]}>
                        {f.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Bouton */}
                {isCurrent ? (
                  <View style={styles.btnCurrent}>
                    <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                    <Text style={styles.btnCurrentText}>Forfait actuel</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.btn, isLoading && styles.btnDisabled]}
                    onPress={() => handleSelect(plan)}
                    disabled={isLoading || loading !== null}
                    activeOpacity={0.85}
                  >
                    {isLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.btnText}>
                          {plan.id === 'ENTERPRISE' ? 'Nous contacter' : 'Choisir ce forfait'}
                        </Text>
                    }
                  </TouchableOpacity>
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

const GREEN = '#22c55e';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  headerTitle: {
    ...typography.h4,
    color: colors.neutral[800],
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.neutral[500],
    marginBottom: spacing.xl,
    textAlign: 'center',
  },

  // ── Carte ────────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.neutral[100],
    ...shadows.sm,
  },
  cardCurrent: {
    borderColor: GREEN,
    ...shadows.md,
  },
  cardPopular: {
    borderColor: colors.primary[200],
    ...shadows.md,
  },

  // ── Badge populaire ──────────────────────────────────────────────────────────
  popularBadge: {
    alignSelf: 'center',
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1.5,
  },

  // ── En-tête plan ─────────────────────────────────────────────────────────────
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  planName: {
    ...typography.h3,
    color: colors.neutral[900],
    fontWeight: '800',
  },
  planDescription: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: 2,
  },
  planPrice: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.neutral[900],
    lineHeight: 30,
  },
  planPeriod: {
    ...typography.caption,
    color: colors.neutral[400],
    textAlign: 'right',
  },

  // ── Stockage ─────────────────────────────────────────────────────────────────
  storageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  storageText: {
    ...typography.bodySmall,
    color: colors.neutral[600],
  },
  storageBold: {
    fontWeight: '700',
    color: colors.primary[600],
  },

  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginVertical: spacing.md,
  },

  // ── Features ─────────────────────────────────────────────────────────────────
  featureList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    ...typography.bodySmall,
    color: colors.neutral[700],
    flex: 1,
  },
  featureTextDim: {
    color: colors.neutral[400],
  },

  // ── Boutons ──────────────────────────────────────────────────────────────────
  btn: {
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    ...typography.button,
    color: '#fff',
  },
  btnCurrent: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  btnCurrentText: {
    ...typography.button,
    color: GREEN,
  },

  // ── Note admin ───────────────────────────────────────────────────────────────
  adminNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  adminNoteText: {
    ...typography.caption,
    color: colors.primary[700],
    flex: 1,
    lineHeight: 16,
  },
});
