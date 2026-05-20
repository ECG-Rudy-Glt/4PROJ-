import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { useColors, AppColors } from '../../theme/useColors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { useAuthStore } from '../../stores/useAuthStore';
import { billingService } from '../../services/billingService';
import { Plan } from '../../types';

type PlanDef = {
  id: Plan;
  name: string;
  price: string;
  storage: string;
  popular?: boolean;
  color: string;
  features: Array<{ label: string; included: boolean }>;
};

const PLANS: PlanDef[] = [
  {
    id: 'FREE',
    name: 'Gratuit',
    price: '0 €/mois',
    storage: '30 Go',
    color: '#2563eb',
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
    price: '9,99 €/mois',
    storage: '200 Go',
    popular: true,
    color: '#7c3aed',
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
    price: '24,99 €/mois',
    storage: '2 To',
    color: '#ea580c',
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
    color: '#0f766e',
    features: [
      { label: 'Tout Business', included: true },
      { label: 'Organisations multi-comptes', included: true },
      { label: 'SLA garanti', included: true },
      { label: 'Support prioritaire', included: true },
      { label: 'Déploiement on-premise', included: true },
      { label: 'Versions illimitées', included: true },
    ],
  },
];

export default function PlansScreen() {
  const navigation = useNavigation();
  const colors = useColors();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const currentPlan = useAuthStore((s) => s.user?.plan) ?? 'FREE';
  const [checkoutLoading, setCheckoutLoading] = useState<Plan | null>(null);

  const handleUpgrade = async (planId: Plan) => {
    if (planId === 'ENTERPRISE') {
      await WebBrowser.openBrowserAsync('mailto:contact@supfile.fr');
      return;
    }
    setCheckoutLoading(planId);
    try {
      const { url } = await billingService.createCheckoutSession(planId);
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Toast.show({ type: 'error', text1: 'Impossible d\'ouvrir le paiement' });
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.neutral[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Forfaits</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Choisissez le forfait adapté à vos besoins.</Text>

        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <View key={plan.id} style={[styles.card, isCurrent && styles.cardCurrent, plan.popular && styles.cardPopular]}>
              {plan.popular && (
                <View style={[styles.badge, { backgroundColor: plan.color }]}>
                  <Text style={styles.badgeText}>Populaire</Text>
                </View>
              )}
              {isCurrent && (
                <View style={[styles.badge, styles.badgeCurrent]}>
                  <Text style={styles.badgeText}>Votre forfait</Text>
                </View>
              )}

              <View style={styles.cardTop}>
                <View style={[styles.iconCircle, { backgroundColor: plan.color + '20' }]}>
                  <Ionicons name="cloud-outline" size={24} color={plan.color} />
                </View>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                  <Text style={styles.planStorage}>{plan.storage}</Text>
                </View>
                <Text style={[styles.planPrice, { color: plan.color }]}>{plan.price}</Text>
              </View>

              <View style={styles.divider} />

              {plan.features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Ionicons
                    name={f.included ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={f.included ? '#16a34a' : colors.neutral[300]}
                  />
                  <Text style={[styles.featureText, !f.included && styles.featureTextDim]}>{f.label}</Text>
                </View>
              ))}

              {!isCurrent && (
                <TouchableOpacity
                  style={[styles.upgradeBtn, { backgroundColor: plan.color }, checkoutLoading === plan.id && { opacity: 0.7 }]}
                  onPress={() => handleUpgrade(plan.id)}
                  activeOpacity={0.8}
                  disabled={checkoutLoading !== null}
                >
                  {checkoutLoading === plan.id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.upgradeBtnText}>{plan.id === 'ENTERPRISE' ? 'Nous contacter' : 'Choisir ce forfait'}</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <Text style={styles.note}>
          La gestion des abonnements et le paiement sont disponibles sur l'interface web.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.neutral[50] },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: c.white, borderBottomWidth: 1, borderBottomColor: c.neutral[100],
  },
  headerTitle: { ...typography.h4, color: c.neutral[800] },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  subtitle: { ...typography.bodySmall, color: c.neutral[500], marginBottom: spacing.xl, textAlign: 'center' },
  card: {
    backgroundColor: c.white, borderRadius: borderRadius.xl,
    padding: spacing.xl, marginBottom: spacing.lg, ...shadows.md,
    borderWidth: 1, borderColor: c.neutral[100],
  },
  cardCurrent: { borderColor: c.primary[400], borderWidth: 2 },
  cardPopular: { ...shadows.lg },
  badge: {
    alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 3,
    borderRadius: borderRadius.full, marginBottom: spacing.md,
  },
  badgeCurrent: { backgroundColor: c.primary[600] },
  badgeText: { ...typography.caption, color: c.white, fontWeight: '700', fontSize: 11 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitleRow: { flex: 1 },
  planName: { ...typography.h4, fontWeight: '700' },
  planStorage: { ...typography.caption, color: c.neutral[500], marginTop: 2 },
  planPrice: { ...typography.body, fontWeight: '700' },
  divider: { height: 1, backgroundColor: c.neutral[100], marginVertical: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  featureText: { ...typography.bodySmall, color: c.neutral[700], flex: 1 },
  featureTextDim: { color: c.neutral[400] },
  upgradeBtn: {
    marginTop: spacing.lg, paddingVertical: spacing.md,
    borderRadius: borderRadius.lg, alignItems: 'center',
  },
  upgradeBtnText: { ...typography.button, color: c.white },
  note: {
    ...typography.caption, color: c.neutral[400],
    textAlign: 'center', marginTop: spacing.md,
  },
});
