import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { Check, X, Zap, Database, Server } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { billingService } from '@/services/billingService';
import { PlanId, PLAN_STORAGE_LABELS } from '@/constants/plans';

type PaidPlanId = Exclude<PlanId, 'FREE'>;

const plans: Array<{
  id: PlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  storage: string;
  features: Array<{ name: string; included: boolean }>;
  icon: any;
  color: string;
  buttonColor: string;
  popular?: boolean;
}> = [
  {
    id: 'FREE',
    name: 'Gratuit',
    price: '0€',
    period: '/mois',
    description: 'Pour demarrer',
    storage: PLAN_STORAGE_LABELS.FREE,
    features: [
      { name: 'Stockage Cloud securise', included: true },
      { name: 'Partage de fichiers', included: true },
      { name: 'Support standard', included: true },
      { name: "Historique d'audit", included: false },
      { name: 'Coffre-fort securise', included: false },
      { name: 'Support prioritaire', included: false },
    ],
    icon: Database,
    color: 'bg-blue-100 text-blue-600',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: '9.99€',
    period: '/mois',
    description: 'Pour les professionnels',
    storage: PLAN_STORAGE_LABELS.PRO,
    features: [
      { name: 'Stockage Cloud securise', included: true },
      { name: 'Partage de fichiers', included: true },
      { name: 'Support standard', included: true },
      { name: "Historique d'audit", included: true },
      { name: 'Coffre-fort securise', included: true },
      { name: 'Support prioritaire', included: true },
    ],
    icon: Zap,
    color: 'bg-purple-100 text-purple-600',
    buttonColor: 'bg-purple-600 hover:bg-purple-700',
    popular: true,
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    price: '29.99€',
    period: '/mois',
    description: 'Pour les equipes',
    storage: PLAN_STORAGE_LABELS.BUSINESS,
    features: [
      { name: 'Stockage Cloud securise', included: true },
      { name: 'Partage de fichiers', included: true },
      { name: 'Support standard', included: true },
      { name: "Historique d'audit", included: true },
      { name: 'Coffre-fort securise', included: true },
      { name: 'Support prioritaire 24/7', included: true },
    ],
    icon: Server,
    color: 'bg-orange-100 text-orange-600',
    buttonColor: 'bg-orange-600 hover:bg-orange-700',
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: '99.99€',
    period: '/mois',
    description: 'Pour les organisations exigeantes',
    storage: PLAN_STORAGE_LABELS.ENTERPRISE,
    features: [
      { name: 'Stockage Cloud securise', included: true },
      { name: 'Partage avance et gouvernance', included: true },
      { name: 'Support dedie', included: true },
      { name: "Historique d'audit complet", included: true },
      { name: 'Coffre-fort securise', included: true },
      { name: 'SLA entreprise', included: true },
    ],
    icon: Server,
    color: 'bg-gray-200 text-gray-700',
    buttonColor: 'bg-gray-800 hover:bg-gray-900',
  },
];

export default function PlansPage() {
  const { user, refreshProfile } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const checkoutState = searchParams.get('checkout');
    if (!checkoutState) return;

    if (checkoutState === 'success') {
      toast.success('Paiement confirme. Votre abonnement est en cours de synchronisation.');
      refreshProfile().catch(() => undefined);
    } else if (checkoutState === 'cancel') {
      toast('Paiement annule');
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('checkout');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, refreshProfile]);

  const handlePlanSelection = async (planId: PlanId) => {
    if (user?.plan === planId) return;

    setLoading(planId);
    try {
      if (user?.role === 'ADMIN') {
        await api.put('/users/plan', { plan: planId });
        await refreshProfile();
        toast.success(`Plan ${planId} applique (bypass admin)`);
        return;
      }

      if (planId === 'FREE') {
        await api.put('/users/plan', { plan: 'FREE' });
        await refreshProfile();
        toast.success('Passage au plan FREE effectue');
        return;
      }

      const { url } = await billingService.createCheckoutSession(planId as PaidPlanId);
      if (!url) {
        throw new Error('Stripe checkout URL not returned');
      }

      window.location.href = url;
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Echec de la mise a jour du plan');
    } finally {
      setLoading(null);
    }
  };

  const handleOpenBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const { url } = await billingService.createPortalSession();
      window.location.href = url;
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Impossible d ouvrir le portail Stripe');
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Plans et Tarifs
        </h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Choisissez le plan adapte a vos besoins de stockage et de securite.
        </p>
        {user?.role === 'ADMIN' && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Mode admin: les changements de plan contournent Stripe.
          </p>
        )}
        {user?.role !== 'ADMIN' && user?.plan && user.plan !== 'FREE' && (
          <button
            onClick={handleOpenBillingPortal}
            disabled={portalLoading}
            className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60"
          >
            {portalLoading ? 'Ouverture...' : 'Gerer ma facturation'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mt-12">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan = user?.plan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl border-2 transition-transform hover:scale-105 ${isCurrentPlan ? 'border-primary-500 ring-4 ring-primary-500/10' : 'border-transparent'
                }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 -mr-2 -mt-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                  POPULAIRE
                </div>
              )}

              <div className="p-8 space-y-6">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${plan.color}`}>
                  <Icon className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                  <div className="flex items-baseline mt-2">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">{plan.price}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">{plan.period}</span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">{plan.description}</p>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30">
                      <Database className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">{plan.storage}</span>
                  </div>

                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      {feature.included ? (
                        <div className="p-1 rounded-full bg-primary-100 dark:bg-primary-900/30">
                          <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        </div>
                      ) : (
                        <div className="p-1 rounded-full bg-gray-100 dark:bg-gray-700">
                          <X className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <span className={`text-sm ${feature.included ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handlePlanSelection(plan.id)}
                  disabled={isCurrentPlan || loading !== null}
                  className={`w-full py-4 px-6 rounded-xl text-white font-semibold transition-all shadow-lg hover:shadow-xl ${isCurrentPlan ? 'bg-gray-400 cursor-not-allowed' : plan.buttonColor
                    } ${loading === plan.id ? 'opacity-75 cursor-wait' : ''}`}
                >
                  {isCurrentPlan
                    ? 'Plan actuel'
                    : loading === plan.id
                      ? 'Redirection...'
                      : user?.role === 'ADMIN'
                        ? 'Activer (Admin)'
                        : plan.id === 'FREE'
                          ? 'Basculer vers FREE'
                          : 'Choisir ce plan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

