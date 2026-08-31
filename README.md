# GERMA — Gérer Mieux Mon Association

> Une association bien gérée, un avenir meilleur.

SaaS multi-association : adhérents, cotisations, comptabilité, événements, gouvernance et
documents, chaque structure étant strictement cloisonnée des autres.

## Démarrer

```bash
npm install
```

Démarrez une base PostgreSQL locale — aucune installation ni Docker requis, elle est fournie
par Prisma :

```bash
npm run db:dev
```

Copiez `.env.example` vers `.env` et reportez-y l'URL affichée par la commande précédente, en
remplaçant la base `template1` par `germa`. Puis :

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

L'application est disponible sur http://localhost:3000.

### Comptes de démonstration

| Compte                  | Mot de passe      | Rôle       |
| ----------------------- | ----------------- | ---------- |
| `demo@germa.fr`      | `Association2026` | Propriétaire |
| `tresorier@germa.fr` | `Association2026` | Trésorier  |

Le second compte sert à constater le RBAC : la rubrique « Paramètres » disparaît de la
navigation, et son accès direct par URL renvoie une page 403.

## Architecture

### Multi-association (multi-tenant)

L'isolation repose sur une colonne `organizationId` portée par chaque modèle métier, et sur
un point de passage unique : `requireOrganization(slug)` dans `src/lib/auth/dal.ts`. C'est la
seule fonction qui vérifie que l'utilisateur connecté appartient bien à l'association
demandée ; toutes les requêtes Prisma filtrent ensuite sur cet `organizationId`.

Deux choix méritent d'être signalés :

- une association inconnue et une association à laquelle on n'appartient pas renvoient
  **toutes deux un 404**. Répondre 403 sur la seconde révélerait son existence ;
- un identifiant d'adhérent appartenant à une autre association, injecté dans sa propre URL,
  renvoie également 404, parce que le `findFirst` porte toujours sur le couple
  `{ id, organizationId }`.

### Authentification

Sessions **opaques stockées en base** plutôt que JWT autoporteurs : le cookie ne contient
qu'un secret aléatoire dont seul le SHA-256 est conservé, ce qui rend les sessions
révocables immédiatement.

Le `proxy.ts` (ex-middleware, renommé dans Next.js 16) ne fait qu'un contrôle *optimiste* de
présence du cookie. Il ne redirige délibérément pas un porteur de cookie hors de la page de
connexion : ne sachant pas si ce cookie est encore valide, il provoquerait une boucle
infinie avec la DAL dès qu'une session expire. Cette redirection est faite par la page de
connexion, qui valide réellement la session.

### Permissions

`src/lib/permissions.ts` définit les permissions `domaine.action` et le socle attaché à
chaque rôle (propriétaire, administrateur, trésorier, secrétaire, responsable, adhérent,
lecteur). Le champ JSON `Membership.permissions` permet d'ajuster ce socle au cas par cas
sans créer de rôle supplémentaire. Les Server Actions qui écrivent appellent
`requirePermission()`.

### Base de données

Schéma éclaté en un fichier par module dans `prisma/schema/` :

| Fichier                | Contenu                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `00-core.prisma`       | Associations, comptes, sessions, rôles, abonnement, journal        |
| `10-members.prisma`    | Adhérents, catégories, barèmes, appels de cotisation               |
| `20-finance.prisma`    | Exercices, plan comptable, écritures, factures, dons, reçus, budget |
| `30-events.prisma`     | Événements, billetterie, inscriptions, ressources                  |
| `40-governance.prisma` | Réunions, présences et pouvoirs, résolutions, votes, mandats, GED  |

Conventions transverses :

- **montants en centimes** (`Int`) et jamais en flottants — l'erreur d'arrondi devient
  visible dès qu'on additionne quelques centaines de cotisations ;
- **statuts en `String` plutôt qu'en `enum`** : les valeurs admises et leurs libellés
  français vivent dans `src/lib/enums.ts`, ce qui permet d'ajouter un statut sans migration ;
- **comptabilité en partie double** : `TransactionLine` porte un débit ou un crédit,
  l'équilibre étant vérifié applicativement.

## Déploiement (Vercel + Supabase)

PostgreSQL est utilisé en développement comme en production : le déploiement ne change que
les chaînes de connexion.

### 1. Base Supabase

Créez un projet Supabase **en région européenne** (les fiches adhérents contiennent des
données personnelles au sens du RGPD). Dans *Project Settings › Database*, relevez deux
chaînes distinctes :

| Variable       | Chaîne Supabase à utiliser | Pourquoi |
| -------------- | -------------------------- | -------- |
| `DATABASE_URL` | **Transaction pooler** (port 6543) | Chaque fonction serverless ouvre sa connexion ; sans pooling, PostgreSQL épuise son quota. |
| `DIRECT_URL`   | **Direct connection** (port 5432)  | Migrate pose des verrous de session et crée une base fantôme, qu'un pooler en mode transaction ne relaie pas. |

> Si l'application remonte des erreurs de *prepared statements*, basculez `DATABASE_URL` sur
> le **Session pooler** : il les gère, au prix de connexions moins nombreuses.

### 2. Migrations

Elles ne sont **pas** jouées automatiquement au déploiement. Depuis votre poste, une fois
`DIRECT_URL` pointant vers Supabase :

```bash
npm run db:deploy
```

Vous pouvez aussi confier ce rôle à Vercel en réglant sa *Build Command* sur
`npx prisma migrate deploy && npm run build`. Sachez alors qu'un déploiement de
**prévisualisation migrerait la base de production** : ne le faites que si toutes les
branches visent la même base.

### 3. Vercel

Importez le dépôt, choisissez la région **Paris (cdg1)** pour rapprocher les fonctions de la
base, et déclarez `DATABASE_URL`, `DIRECT_URL` et `NEXT_PUBLIC_APP_URL`. Le script
`postinstall` régénère le client Prisma à chaque build — le dossier `src/generated/` n'est
volontairement pas versionné.

### 4. Premier compte

Le seed crée une association de démonstration : ne le jouez pas en production. Créez votre
association réelle via `/inscription`, puis désactivez l'inscription publique si le service
n'est pas ouvert à tous.

## E-mails

Aucune dépendance : l'API REST du prestataire est appelée avec `fetch` (`src/lib/email/`).
Changer de fournisseur revient à réécrire une seule fonction.

Sans `EMAIL_PROVIDER`, **rien n'est envoyé** : chaque message est écrit dans le terminal du
serveur, destinataire et contenu compris. C'est le mode de développement — on relit ses
gabarits sans risquer d'écrire à de vrais adhérents. L'interface le signale explicitement
plutôt que de laisser croire à un envoi.

Pour un envoi réel, renseignez `EMAIL_PROVIDER="resend"`, `RESEND_API_KEY` et `EMAIL_FROM`
— cette dernière devant appartenir à un domaine vérifié chez le prestataire, faute de quoi
les messages partiront en indésirables.

Trois gabarits sont branchés : relance de cotisation, réinitialisation de mot de passe et
invitation ; un quatrième (convocation à une assemblée) est écrit mais pas encore appelé.

L'envoi en lot est **séquentiel** : les prestataires limitent le débit, et paralléliser sur
deux cents adhérents déclencherait un throttling qui ferait perdre des messages. Au-delà de
quelques centaines de destinataires, cette tâche devra sortir de la requête HTTP.

Sur les relances, `remindersSent` n'est incrémenté que pour les envois **réussis** : un
compteur qui avancerait malgré un échec masquerait les adhérents jamais joints. Ceux qui
n'ont pas d'adresse e-mail sont comptés à part dans le compte rendu — ce sont eux qu'il
faudra relancer par courrier.

## Avant une mise en service réelle

Le socle est fonctionnel, mais un service ouvert au public demande encore :

- **téléversement de fichiers** — la GED stocke des URL, pas encore les documents ;
- **limitation du nombre de tentatives de connexion** ;
- **invitation d'un co-administrateur** — le gabarit et le modèle `Invitation` existent,
  l'écran qui les relie non ;
- **paiement en ligne** — `OrgSubscription` prévoit les identifiants d'un prestataire, sans
  intégration ;
- **sauvegardes** de la base, et registre RGPD des traitements.

## Vérifications

```bash
npx tsc --noEmit
```

```bash
npx eslint src prisma
```

```bash
npm run build
```

## État d'avancement

Fonctionnel de bout en bout : inscription, connexion, déconnexion, création d'associations
supplémentaires, tableau de bord agrégé, fichier des adhérents (recherche, filtres,
pagination), fiche adhérent, cotisations, comptabilité avec suivi budgétaire, événements et
billetterie, gouvernance avec quorum et dépouillement des votes, GED, paramètres.

**Écriture disponible** sur les adhérents : création, modification et radiation, avec
validation serveur, attribution automatique du numéro d'adhérent et journalisation de
l'auteur et des champs modifiés (visible dans Paramètres › Journal d'activité).

**Écriture disponible** sur les cotisations : barèmes (création, modification, archivage),
émission en masse des appels, enregistrement des règlements et exonérations.

L'émission en masse est **rejouable sans risque** : un adhérent qui a déjà un appel
chevauchant la période est ignoré, jamais facturé deux fois. Un adhérent dont la catégorie
n'a pas de barème est également ignoré plutôt qu'appelé à zéro euro. Le compte rendu
distingue explicitement ces deux cas.

L'écriture comptable d'un règlement est **proposée, jamais générée en silence** : produire
des écritures à l'insu du trésorier fausserait une comptabilité dont il est seul
responsable. Quand l'option est retenue, le rapprochement se fait par numéro de compte du
PCG — débit 512 banque, ou 530 caisse pour un encaissement en espèces, crédit 756
cotisations. Si ces comptes sont absents du plan, le règlement est enregistré et l'absence
d'écriture est signalée plutôt que silencieuse.

Le numéro d'adhérent suit la règle « plus grand numéro existant + 1 », afin de ne jamais
réattribuer un numéro libéré — les cotisations et reçus fiscaux passés y font référence. Une
association qui réserve des plages par catégorie (9000+ pour les personnes morales, par
exemple) doit donc saisir le numéro à la main.

**Écriture disponible** sur les événements : création et modification, publication et
annulation, tarifs, inscriptions, désinscriptions et pointage des présences.

La jauge est gérée de bout en bout. Au-delà de la capacité, une inscription part en **liste
d'attente** plutôt que d'être refusée, et l'événement bascule en « complet ». Une
désinscription **repêche automatiquement** la première personne en attente, dans l'ordre
d'inscription et seulement si sa réservation tient dans la place libérée — promouvoir une
réservation de quatre places sur une seule place libre recréerait un sur-booking. La jauge ne
peut pas non plus descendre sous le nombre de places déjà confirmées : l'action refuse
plutôt que de trancher à la place du responsable.

Annuler un événement annule aussi ses inscriptions : les laisser « confirmées » produirait
des feuilles de présence pour une soirée qui n'aura pas lieu.

Restent en **lecture seule** : saisie libre d'écritures comptables, convocations aux
assemblées et vote en ligne. Elles s'ajoutent en Server Actions derrière
`requirePermission()`, sur le modèle de `src/app/[org]/evenements/actions.ts`.

## Identité visuelle

Le logo se trouve dans `public/germa-logo.jpg` et s'affiche via `src/components/logo.tsx`.
Le fichier fourni est un JPEG **à fond noir opaque** : le composant le pose donc sur une
plaque noire, dont le raccord est invisible. Fournir un PNG détouré permettrait de retirer
cette plaque et de poser le logo directement sur fond clair.

La variante `mark` recadre sur le seul mot « GERMA » pour les emplacements étroits (barre
latérale, en-tête), où le slogan ne serait plus lisible.
