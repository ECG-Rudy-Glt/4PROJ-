import { Link } from 'react-router-dom';
import Seo from '@/components/Seo';

type LegalPageKind = 'privacy' | 'terms' | 'contact';

interface LegalPageProps {
  kind: LegalPageKind;
}

const pages: Record<LegalPageKind, {
  title: string;
  description: string;
  sections: Array<{ heading: string; body: string }>;
}> = {
  privacy: {
    title: 'Politique de confidentialite',
    description: 'Donnees traitees par SUPFile dans le cadre du projet de stockage securise.',
    sections: [
      {
        heading: 'Donnees collectees',
        body: 'SUPFile traite les donnees de compte, les metadonnees de fichiers, les journaux de securite et les informations necessaires aux partages. Les contenus de fichiers sont stockes chiffres au repos.',
      },
      {
        heading: 'Finalites',
        body: "Ces donnees servent a fournir le stockage, l'authentification, la securite MFA, les partages, l'audit et les fonctions de support du service.",
      },
      {
        heading: 'Securite',
        body: 'Les mots de passe, jetons sensibles et codes de recuperation sont stockes sous forme hashee ou chiffree. Les exports RGPD masquent les identifiants techniques sensibles.',
      },
      {
        heading: 'Contact',
        body: 'Pour toute demande relative aux donnees personnelles, contactez contact@supfile.tech.',
      },
    ],
  },
  terms: {
    title: 'Conditions d utilisation',
    description: 'Regles d usage du service SUPFile pour la preproduction de demonstration.',
    sections: [
      {
        heading: 'Usage autorise',
        body: 'Le service est prevu pour une demonstration de projet ecole et des essais fonctionnels. Les utilisateurs doivent conserver leurs identifiants confidentiels.',
      },
      {
        heading: 'Contenus',
        body: 'Chaque utilisateur reste responsable des fichiers televerses et partages. Les contenus illicites, dangereux ou sans droit d usage sont interdits.',
      },
      {
        heading: 'Disponibilite',
        body: 'La preproduction peut etre interrompue pour maintenance, sauvegarde, tests ou correction de securite.',
      },
      {
        heading: 'Paiement test',
        body: 'Les plans payants utilises dans cette preproduction passent par Stripe en mode test et ne declenchent aucun paiement reel.',
      },
    ],
  },
  contact: {
    title: 'Contact et support',
    description: 'Canaux de contact pour SUPFile.',
    sections: [
      {
        heading: 'Support',
        body: 'Pour une question de compte, de partage ou de demonstration, ecrivez a contact@supfile.tech.',
      },
      {
        heading: 'Securite',
        body: 'Pour signaler une faille, indiquez les etapes de reproduction, l impact observe et les comptes concernes sans publier de secret.',
      },
      {
        heading: 'Preproduction',
        body: 'Cette instance est destinee a la validation et a la soutenance. Les donnees de test peuvent etre purgees entre deux demonstrations.',
      },
    ],
  },
};

export default function LegalPage({ kind }: LegalPageProps) {
  const page = pages[kind];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <Seo title={`${page.title} - SUPFile`} description={page.description} canonicalPath={`/${kind}`} />

      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <Link to="/" className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
          Retour a SUPFile
        </Link>

        <header className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
            SUPFile
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
            {page.title}
          </h1>
          <p className="mt-4 text-base text-gray-600 dark:text-gray-300">
            {page.description}
          </p>
        </header>

        <div className="mt-10 space-y-8">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold">{section.heading}</h2>
              <p className="mt-2 leading-7 text-gray-700 dark:text-gray-300">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-4 text-sm">
          <Link to="/privacy" className="text-primary-600 hover:text-primary-700 dark:text-primary-400">Confidentialite</Link>
          <Link to="/terms" className="text-primary-600 hover:text-primary-700 dark:text-primary-400">Conditions</Link>
          <Link to="/contact" className="text-primary-600 hover:text-primary-700 dark:text-primary-400">Contact</Link>
        </div>
      </div>
    </main>
  );
}
