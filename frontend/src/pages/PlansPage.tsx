import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { Check, X, Zap, Database, Server } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { PlanId, PLAN_STORAGE_LABELS } from '@/constants/plans';

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
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const checkoutState = searchParams.get('checkout');
    if (!checkoutState) return;

    if (checkoutState === 'success') {
      toast.success('Paiement confirmé. Votre abonnement est actif.');
      refreshProfile().catch(() => undefined);
    } else if (checkoutState === 'cancel') {
      toast('Paiement annulé');
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('checkout');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, refreshProfile]);

  const handlePlanSelection = async (planId: PlanId) => {
    if (user?.plan === planId) return;

    setLoading(planId);
    try {
      if (planId === 'FREE') {
        await api.post('/billing/downgrade-free');
        await refreshProfile();
        toast.success('Retour au plan gratuit effectué');
        return;
      }

      // Simulation Stripe Checkout
      setIsRedirecting(true);
      
      const response = await api.post('/billing/checkout-session', { plan: planId });
      
      // Simuler le délai de paiement "en cours"
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (response.data.url && !response.data.url.includes('/plans?checkout=success')) {
        window.location.href = response.data.url;
      } else {
        // En mode simulation, le plan est déjà activé sur le backend
        await refreshProfile();
        setIsRedirecting(false);
        toast.success('Paiement confirmé. Votre abonnement est actif.');
      }
    } catch (error: any) {
      setIsRedirecting(false);
      toast.error(error.response?.data?.error || 'Échec de la transition vers le paiement');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Choisissez votre forfait
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          Des solutions de stockage adaptées à tous vos besoins, du personnel au professionnel.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = user?.plan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative bg-white dark:bg-gray-800 rounded-3xl p-8 border-2 transition-all duration-300 hover:shadow-2xl ${isCurrentPlan 
                ? 'border-primary-500 ring-4 ring-primary-500/5' 
                : 'border-gray-100 dark:border-gray-700 hover:border-primary-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-xl uppercase tracking-widest">
                  Recommandé
                </div>
              )}

              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-gray-900 dark:text-white">{plan.price}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">{plan.period}</span>
                  </div>
                </div>

                <div className="py-6 border-t border-gray-100 dark:border-gray-700 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                      {plan.storage}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">de stockage sécurisé</span>
                  </div>

                  <div className="space-y-3">
                    {plan.features.slice(0, 4).map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        {feature.included ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-gray-300" />
                        )}
                        <span className={`text-sm ${feature.included ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
                          {feature.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handlePlanSelection(plan.id)}
                  disabled={isCurrentPlan || loading !== null}
                  className={`w-full py-4 px-6 rounded-2xl font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                    isCurrentPlan 
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed' 
                      : 'bg-gray-900 dark:bg-white dark:text-gray-900 text-white hover:bg-gray-800 dark:hover:bg-gray-100 shadow-xl'
                  } ${loading === plan.id ? 'opacity-50 animate-pulse' : ''}`}
                >
                  {isCurrentPlan ? 'Plan actuel' : loading === plan.id ? 'Activation...' : 'Sélectionner'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isRedirecting && (
        <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 p-10 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-100 dark:border-gray-700 rounded-full"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Paiement en cours...</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Nous traitons votre demande d'abonnement.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

