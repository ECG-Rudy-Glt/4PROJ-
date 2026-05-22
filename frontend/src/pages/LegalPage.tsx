import { Link } from 'react-router-dom';
import Seo from '@/components/Seo';

type LegalPageKind = 'privacy' | 'terms' | 'contact' | 'legal';

interface LegalPageProps {
  kind: LegalPageKind;
}

const updatedAt = '18 mai 2026';

const pages: Record<LegalPageKind, {
  title: string;
  description: string;
  sections: Array<{ heading: string; body: string }>;
}> = {
  legal: {
    title: 'Mentions légales',
    description: 'Informations d’édition, d’hébergement et de contact pour SUPFile.',
    sections: [
      {
        heading: 'Éditeur du service',
        body: 'SUPFile est un projet web de stockage cloud sécurisé réalisé dans un cadre pédagogique. Le service est exploité en préproduction pour démonstration, validation fonctionnelle et soutenance. Pour toute demande, l’adresse de contact est contact@supfile.tech.',
      },
      {
        heading: 'Hébergement',
        body: 'L’instance de démonstration est destinée à être hébergée sur une infrastructure située en France. Les fichiers, métadonnées et journaux techniques sont traités par les composants nécessaires au fonctionnement de l’application, notamment PostgreSQL, MinIO, le backend SUPFile, le frontend web et les services de collaboration configurés.',
      },
      {
        heading: 'Nature du service',
        body: 'SUPFile permet de créer un compte, stocker des fichiers, organiser des dossiers, partager des contenus, utiliser l’authentification multifacteur, activer certains forfaits et accéder à des fonctionnalités avancées selon le plan choisi. Les informations publiques de cette page doivent rester cohérentes avec les droits réellement appliqués par l’application.',
      },
      {
        heading: 'Propriété intellectuelle',
        body: 'Les marques, interfaces, textes, visuels et éléments logiciels propres à SUPFile ne peuvent pas être réutilisés sans autorisation. Les utilisateurs restent propriétaires des fichiers qu’ils déposent et responsables des droits associés à ces contenus.',
      },
      {
        heading: 'Signalement',
        body: 'Pour signaler une erreur, un contenu problématique ou une vulnérabilité, contactez contact@supfile.tech en décrivant les étapes de reproduction, l’impact observé et les comptes concernés, sans publier de secret ni de donnée personnelle inutile.',
      },
    ],
  },
  privacy: {
    title: 'Politique de confidentialité',
    description: 'Données traitées par SUPFile dans le cadre du projet de stockage sécurisé.',
    sections: [
      {
        heading: 'Responsable et périmètre',
        body: 'Cette politique concerne l’instance web SUPFile de préproduction. Elle décrit les traitements nécessaires aux comptes, aux fichiers, aux partages, à la sécurité et aux fonctions de démonstration. Pour toute demande relative aux données personnelles, contactez contact@supfile.tech.',
      },
      {
        heading: 'Données traitées',
        body: 'SUPFile traite les données de compte, l’adresse e-mail, le nom affiché, les paramètres de sécurité, les métadonnées de fichiers et dossiers, les partages, les abonnements, les journaux d’audit, les sessions, les appareils et les informations strictement nécessaires au support.',
      },
      {
        heading: 'Finalités',
        body: 'Ces données servent à fournir le stockage, l’authentification, la MFA, les partages, le coffre-fort, l’édition documentaire, les exports RGPD, la suppression de compte, la facturation Stripe en mode test et la sécurité du service.',
      },
      {
        heading: 'Sécurité',
        body: 'Les mots de passe sont hachés, les jetons sensibles sont stockés sous forme hachée ou chiffrée, les secrets MFA sont protégés, et les fichiers sont chiffrés au repos. Les accès aux routes privées passent par les middlewares d’authentification et les journaux ne doivent pas exposer de secret complet.',
      },
      {
        heading: 'Sous-traitants et services externes',
        body: 'Selon la configuration, SUPFile peut utiliser Stripe en mode test pour les abonnements, Google ou GitHub pour l’OAuth, un serveur SMTP pour les e-mails, OnlyOffice pour l’édition et l’infrastructure d’hébergement choisie pour la préproduction. Aucun secret OAuth, Stripe ou SMTP ne doit être publié dans le dépôt Git.',
      },
      {
        heading: 'Durées de conservation',
        body: 'Les données sont conservées tant que le compte est actif ou nécessaires à la sécurité, aux preuves techniques et à la démonstration. Une suppression de compte anonymise l’utilisateur, révoque les sessions et purge les données personnelles et fichiers possédés dans la mesure prévue par l’application.',
      },
      {
        heading: 'Vos droits',
        body: 'Un utilisateur peut demander l’accès, l’export, la rectification ou la suppression de ses données via les paramètres de l’application ou par e-mail à contact@supfile.tech. Les demandes peuvent nécessiter une vérification d’identité pour éviter une suppression ou divulgation non autorisée.',
      },
      {
        heading: 'Cookies et stockage local',
        body: 'L’application peut utiliser le stockage local du navigateur et des cookies techniques pour maintenir la session, gérer l’authentification et améliorer la sécurité. Aucun suivi publicitaire n’est nécessaire au fonctionnement de SUPFile.',
      },
    ],
  },
  terms: {
    title: 'Conditions générales d’utilisation',
    description: 'Règles d’usage du service SUPFile pour la préproduction de démonstration.',
    sections: [
      {
        heading: 'Périmètre de la préproduction',
        body: 'SUPFile est fourni dans un cadre de démonstration et de projet école. L’application peut être modifiée, interrompue, sauvegardée, restaurée ou purgée pour validation, correction de sécurité ou préparation de soutenance.',
      },
      {
        heading: 'Compte et sécurité',
        body: 'L’utilisateur doit fournir des informations exactes, protéger ses identifiants, activer la MFA lorsque c’est pertinent et ne pas contourner les restrictions d’accès. Toute suspicion de compromission doit être signalée rapidement à contact@supfile.tech.',
      },
      {
        heading: 'Forfaits',
        body: 'Les droits appliqués par l’application font foi. À ce jour, le plan Gratuit inclut 30 Go sans versioning, Pro inclut 1 To, Business inclut 10 To et Enterprise inclut 10 To avec un accompagnement sur devis. Certaines fonctions comme Bobby, le coffre-fort, OnlyOffice, le versioning, les partages protégés et l’audit avancé dépendent du forfait.',
      },
      {
        heading: 'Paiement test',
        body: 'Les abonnements payants de la préproduction utilisent Stripe en mode test. Les cartes de test Stripe servent à valider le parcours Checkout, les webhooks et le portail client. Aucun paiement réel ne doit être déclenché sur cette instance de démonstration.',
      },
      {
        heading: 'Contenus et partages',
        body: 'Chaque utilisateur reste responsable des fichiers téléversés, des droits associés et des personnes avec lesquelles il partage un lien ou un dossier. Les contenus illicites, dangereux, malveillants ou déposés sans droit d’usage sont interdits.',
      },
      {
        heading: 'Fonctions avancées',
        body: 'Bobby analyse les documents selon la configuration locale prévue par le projet. OnlyOffice permet l’édition documentaire lorsque le forfait et la configuration serveur le permettent. Ces fonctions peuvent être désactivées en cas d’incident, maintenance ou limite technique.',
      },
      {
        heading: 'Disponibilité',
        body: 'La préproduction n’est pas une offre commerciale avec garantie de disponibilité. Des interruptions peuvent avoir lieu pour tests, déploiements, sauvegardes, restauration, migration ou correction de sécurité.',
      },
      {
        heading: 'Suppression et export',
        body: 'L’utilisateur peut exporter ses données et demander la suppression de son compte depuis les paramètres. La suppression révoque les sessions, anonymise le compte et purge les données personnelles selon les règles implémentées par l’application.',
      },
      {
        heading: 'Responsabilité',
        body: 'SUPFile est fourni pour validation pédagogique. L’utilisateur doit éviter d’y déposer des données critiques, uniques ou impossibles à restaurer sans sauvegarde externe. Les tests doivent rester compatibles avec la loi, les règles de l’école et les droits des tiers.',
      },
    ],
  },
  contact: {
    title: 'Contact et support',
    description: 'Canaux de contact pour SUPFile.',
    sections: [
      {
        heading: 'Support',
        body: 'Pour une question de compte, d’accès, de partage, de paiement test ou de démonstration, écrivez à contact@supfile.tech avec le contexte utile et une description claire du problème.',
      },
      {
        heading: 'Sécurité',
        body: 'Pour signaler une faille, indiquez les étapes de reproduction, l’impact observé, le navigateur utilisé et les comptes concernés. Ne transmettez pas de mot de passe, jeton complet, clé privée ou secret Stripe/OAuth/SMTP.',
      },
      {
        heading: 'Données personnelles',
        body: 'Pour une demande RGPD, précisez le compte concerné et la demande souhaitée : accès, export, correction ou suppression. Une vérification peut être demandée avant toute action sensible.',
      },
      {
        heading: 'Préproduction',
        body: 'Cette instance est destinée à la validation et à la soutenance. Les données de test peuvent être réinitialisées entre deux démonstrations, et les intégrations externes doivent rester en mode test tant que le projet n’est pas ouvert commercialement.',
      },
    ],
  },
};

export default function LegalPage({ kind }: LegalPageProps) {
  const page = pages[kind];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <Seo title={`${page.title} - SUPFile`} description={page.description} canonicalPath={`/${kind}`} robots="index, follow" />

      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <Link to="/" className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
          Retour à SUPFile
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
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Dernière mise à jour : {updatedAt}
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
          <Link to="/legal" className="text-primary-600 hover:text-primary-700 dark:text-primary-400">Mentions légales</Link>
          <Link to="/privacy" className="text-primary-600 hover:text-primary-700 dark:text-primary-400">Confidentialité</Link>
          <Link to="/terms" className="text-primary-600 hover:text-primary-700 dark:text-primary-400">CGU</Link>
          <Link to="/contact" className="text-primary-600 hover:text-primary-700 dark:text-primary-400">Contact</Link>
        </div>
      </div>
    </main>
  );
}
