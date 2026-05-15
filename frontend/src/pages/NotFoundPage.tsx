import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, SearchX } from 'lucide-react';
import Seo from '@/components/Seo';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white flex items-center justify-center px-4 py-10">
      <Seo
        title="Page introuvable - SUPFILE"
        description="La page demandée est introuvable. Retournez à l'accueil SUPFILE ou à votre espace de stockage sécurisé."
        canonicalPath="/404"
        robots="noindex, follow"
      />

      <section className="w-full max-w-2xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
          <SearchX className="h-8 w-8" />
        </div>

        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
          Erreur 404
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Page introuvable
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-gray-600 dark:text-gray-300">
          Cette adresse ne correspond à aucune page SUPFILE. Le lien peut avoir expiré,
          avoir été déplacé ou contenir une erreur.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition-colors hover:bg-primary-700"
          >
            <Home className="h-4 w-4" />
            Retour à l'accueil
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Page précédente
          </button>
        </div>
      </section>
    </main>
  );
}
