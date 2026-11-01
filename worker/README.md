# Galerie client BIGBEEZARR : « Récupérer mes photos »

Livraison de photos en qualité originale, intégrée au portfolio, avec recherche par visage en option.

- **Pages** (GitHub Pages, ce dépôt) : `/galerie/` pour les clients, `/admin/` pour le photographe.
- **Serveur** (`worker/`) : un Cloudflare Worker qui gère les droits d'accès, les liens, les mots de passe, les expirations, les ZIP et les statistiques.
- **Stockage** : Cloudflare R2. Les originaux sont livrés octet par octet : pas de recompression, pas de redimensionnement, métadonnées intactes. Les téléchargements ne sont pas facturés.
- **Base** : Cloudflare D1 (galeries, photos, invités, statistiques).
- **Visages** (optionnel) : Amazon Rekognition, région Canada (Central). Chaque galerie a sa propre collection, et le selfie n'est jamais enregistré.

WeTransfer Pro ne peut pas servir de stockage intégré. Sa documentation développeur indique « Unfortunately we no longer provide support for the WeTransfer API », et ses dépôts officiels sont archivés depuis le 27 octobre 2025.

## Mise en route (une seule fois, environ 15 minutes)

### 1. Cloudflare

1. Créez un compte gratuit sur dash.cloudflare.com.
2. Ouvrez **Workers & Pages** une fois et choisissez votre sous-domaine `workers.dev`.
3. Ouvrez **R2 Object Storage** et activez R2. Cloudflare demande un moyen de paiement, même si les 10 Go gratuits suffisent pour commencer.
4. Le forfait **Workers Paid** (5 $ US par mois) est recommandé dès que la recherche par visage sert. Sa limite de temps processeur par requête est plus large : 10 ms en gratuit, 30 s en payant.
5. Créez un **jeton d'API** (My Profile > API Tokens > Create Token) à partir du modèle « Edit Cloudflare Workers ». Ajoutez-y les permissions **Account > D1 > Edit** et **Account > Workers R2 Storage > Edit**.
6. Notez votre **Account ID**, affiché dans la colonne de droite de la page d'accueil du tableau de bord.

### 2. Secrets GitHub

Dans le dépôt `bigbeezarr/bigbeezarr.github.io`, ouvrez Settings > Secrets and variables > Actions > New repository secret :

| Nom | Valeur |
|---|---|
| `CLOUDFLARE_API_TOKEN` | le jeton créé ci-dessus |
| `CLOUDFLARE_ACCOUNT_ID` | l'identifiant du compte |
| `BBZ_ADMIN_PASSWORD` | le mot de passe du tableau de bord (au moins 10 caractères, unique) |

Secrets **facultatifs** : chaque service ne s'allume que si son secret existe. Sans eux, le site et les galeries fonctionnent.

| Nom | Sert à | Voir |
|---|---|---|
| `BBZ_CONTENT_TOKEN` | modifier le portfolio depuis `/admin/` → Portfolio | « Portfolio » ci-dessous |
| `RESEND_API_KEY`, `NOTIFY_EMAIL` | recevoir un courriel à chaque demande de réservation ou sélection | « Notifications » |
| `NOTIFY_FROM` | expéditeur des notifications (domaine vérifié chez Resend) | « Notifications » |
| `TURNSTILE_SECRET` | vérification anti-robot du formulaire de réservation | « Anti-robot » |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | liens de paiement d'acompte (préparé, inactif) | « Paiements » |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | recherche par visage | « Reconnaissance faciale » |

Et une **variable** (onglet *Variables*, pas *Secrets*) : `FACE_SEARCH`. Tant qu'elle ne vaut pas `on`, la recherche
par visage est coupée sur le serveur, même avec les clés AWS. La remettre à `off` puis relancer le déploiement la coupe.

Retirer un secret de GitHub ne le retire pas du serveur : supprimez-le aussi dans Cloudflare
(Workers & Pages → bbz-galerie → Settings → Variables and Secrets).

### 3. Déployer

Allez dans l'onglet **Actions**, choisissez « Déployer la galerie client », puis **Run workflow**. Le workflow :

- crée le stockage R2 et la base D1 s'ils n'existent pas ;
- installe le schéma de la base ;
- déploie le Worker et pose les secrets ;
- génère une clé de signature aléatoire au premier passage ;
- écrit l'adresse du serveur dans `galerie/config.js`.

Avant toute mise en ligne, le workflow lance la batterie de tests (`worker/test/run-all.sh`, sans compte ni réseau) :
un seul échec et rien n'est déployé. Seule la branche `main` déploie ; une demande de fusion ne fait que tester.

Les pages `bigbeezarr.github.io/galerie/` et `bigbeezarr.github.io/admin/` sont ensuite opérationnelles. Chaque modification de `worker/` redéploie automatiquement.

## Réservations, calendrier, clients

- Le bouton « Demander une date » du site envoie la demande au serveur. Sans serveur relié, il prépare un courriel
  à baeypro@gmail.com à la place (rien n'est perdu).
- Protection contre les robots, sans témoin : champ piège invisible, délai minimal de 3 secondes, 5 demandes par heure
  et par adresse, 80 par heure au total. L'adresse IP n'est jamais enregistrée en clair (empreinte salée, pour les limites).
- `/admin/` → **Réservations** : statut, date, prix, acompte, note privée, réponse par courriel, fiche client.
  Une demande n'est jamais confirmée automatiquement. Une date confirmée ou bloquée ne peut pas être confirmée
  une seconde fois (sauf en le forçant).
- **Calendrier** : touchez un jour pour le bloquer. Le formulaire du site affiche les jours pris, sans aucun nom.
- **Clients** : coordonnées, galeries livrées, demandes, historique (galerie ouverte, téléchargements, ZIP, sélections).
- **Archiver** une galerie (onglet Réglages) la ferme aux visiteurs, liens de téléchargement déjà émis compris ;
  les fichiers restent. Désarchiver la rouvre. Les aperçus déjà chargés dans un navigateur restent visibles au plus
  12 heures (durée de leur signature).
- **Sélections** : dans sa galerie, le client choisit des photos (même non téléchargeables) et les envoie avec un mot.
  Vous recevez la liste des noms de fichiers, prête pour le filtre de Lightroom. Interrupteur par galerie.
- **Statistiques** : un compteur par jour, par page et par type d'appareil. Ni témoin, ni identifiant, ni adresse IP ;
  Global Privacy Control et Do Not Track respectés. Conservées 13 mois.

### Notifications (facultatif)

Sans service de courriel, les demandes restent visibles dans `/admin/`. Pour être prévenu par courriel :

1. Créez un compte sur resend.com avec **baeypro@gmail.com**, puis une clé d'API (*Sending access*).
2. Secrets GitHub : `RESEND_API_KEY` = la clé, `NOTIFY_EMAIL` = baeypro@gmail.com. Relancez le déploiement.

Sans domaine vérifié, l'expéditeur par défaut de Resend ne peut écrire qu'à l'adresse du compte Resend : c'est
précisément le cas ici. Avec un domaine à vous (par exemple après l'achat d'un nom de domaine), vérifiez-le chez Resend
et ajoutez `NOTIFY_FROM` = `BIGBEEZARR <reservations@votre-domaine>`. Le bouton « Répondre » de la notification écrit
directement au client.

### Anti-robot (facultatif)

Cloudflare Turnstile ajoute une vérification invisible ou en un clic au formulaire. Les deux moitiés vont ensemble :

1. Cloudflare → Turnstile → *Add widget*, domaine `bigbeezarr.github.io`, mode *Managed*.
2. La **clé publique** (*Site Key*) : `/admin/` → Portfolio → Réglages du site → « Clé publique Turnstile ». Publiez.
3. La **clé secrète** : secret GitHub `TURNSTILE_SECRET`, puis relancez le déploiement.

Mettez la clé publique d'abord : le serveur refuse toute demande sans vérification dès que le secret est posé.
La politique de sécurité (CSP) du site n'autorise le script et le cadre de Cloudflare que si la clé publique est fixée.
Essayé avec une imitation locale du service ; à vérifier sur le site réel après activation.

### Paiements (préparés, inactifs)

Le bouton « Lien de paiement » d'une demande crée une page de paiement Stripe pour l'acompte ou le solde et copie
le lien. Il reste inactif tant que `STRIPE_SECRET_KEY` n'existe pas. À ne poser qu'une fois vos conditions de vente,
d'acompte et de remboursement rédigées et validées. Pour l'activer : compte Stripe vérifié, clé secrète (`sk_live_…`)
en secret GitHub `STRIPE_SECRET_KEY`, puis un point de terminaison de webhook vers
`https://<votre serveur>/api/stripe/webhook` (événement `checkout.session.completed`) et son secret en
`STRIPE_WEBHOOK_SECRET`. La demande passe alors seule à « Acompte payé ». Frais : barème Stripe Canada.

## Portfolio (édition depuis l'administration)

`/admin/` → **Portfolio** modifie les fichiers `content/*.json` de la branche `source` : titres, textes FR/EN,
lieux, rubriques, ordre des photos, projets à la une (5 au plus), historique des éditions, textes alternatifs,
projets masqués, coordonnées. « Publier » enregistre un commit ; le workflow « Publier le portfolio » reconstruit
alors le site (environ deux minutes, plus la mise à jour de GitHub Pages).

Le jeton ne quitte jamais le serveur. Pour le créer (GitHub → Settings → Developer settings → Personal access tokens →
**Fine-grained tokens** → Generate new token) :

- *Repository access* : **Only select repositories** → `bigbeezarr/bigbeezarr.github.io` ;
- *Permissions* → *Repository permissions* → **Contents : Read and write** (rien d'autre) ;
- une date d'expiration (notez-la : à l'échéance, l'éditeur affichera une erreur GitHub et il faudra un nouveau jeton).

Ajoutez-le en secret GitHub `BBZ_CONTENT_TOKEN` (GitHub interdit les noms qui commencent par `GITHUB_`), puis relancez
le déploiement. Ce jeton peut écrire dans tout le dépôt : le serveur ne s'en sert que pour ces trois fichiers, sur
`source`, après vérification de leur contenu (photos en double, identifiants, adresses). Si la tâche planifiée a modifié
le fichier entre-temps, l'enregistrement est refusé au lieu d'écraser son travail : rechargez la page.

## Utilisation

1. `/admin/` → **Nouvelle galerie**. Choisissez un type :
   - **Privée** : un client, lien secret, mot de passe possible.
   - **Événement** : plusieurs participants, liste publique possible, recherche par visage possible.
   - **Restreinte** : chaque invité reçoit son lien et ne télécharge que ses photos attribuées.
2. Glissez des photos ou des dossiers entiers (JPEG, PNG, HEIC, TIFF, RAW).
   - L'import calcule l'empreinte CRC-32 de chaque original, puis crée un aperçu de 2048 px et une vignette de 640 px.
   - Pour les fichiers RAW, l'aperçu vient du JPEG intégré au fichier.
   - Les fichiers de plus de 95 Mo partent en plusieurs parties de 50 Mo.
3. **Copier le lien** et envoyez-le. **Nouveau lien** révoque l'ancien.
4. Réglages disponibles : expiration, suppression automatique à l'expiration, téléchargement autorisé ou non, couverture, mot de passe.

Côté client :

- grille responsive et visionneuse plein écran (clavier et balayage) ;
- sélection, puis téléchargement d'une photo, d'une sélection ou de tout ;
- reprise des téléchargements interrompus (Range) ;
- archives ZIP sans compression, découpées en parties de 400 photos, avec ZIP64 au-delà de 4 Go.

## Reconnaissance faciale

### Avant d'activer (je ne suis pas avocat : faites valider)

- **Québec** : la loi concernant le cadre juridique des technologies de l'information (articles 44 et 45) exige un **consentement exprès**. Elle exige aussi une **déclaration à la Commission d'accès à l'information au moins 60 jours avant** la mise en service d'une banque de caractéristiques biométriques. La Loi 25 demande une évaluation des facteurs relatifs à la vie privée (EFVP), notamment pour un stockage hors Québec. Le consentement vise **toutes les personnes dont le visage est indexé**, pas seulement celle qui cherche : prévoyez-le à l'inscription, dans un formulaire de participation, ou dans une autorisation signée (par exemple pour une équipe comme La Forge).
- **Canada** : la LPRPDE s'applique hors Québec. Le Commissariat a publié en août 2025 une orientation sur la biométrie pour les entreprises.
- **Sénégal** : la loi 2008-12 impose des formalités préalables auprès de la Commission de protection des données personnelles (CDP), et une autorisation pour les transferts hors du pays.

Le tableau de bord refuse d'activer la recherche tant que les trois attestations ne sont pas cochées et que la base du consentement n'est pas notée. La recherche est désactivée par défaut. Désactiver la recherche efface l'index.

Deux verrous s'ajoutent : la variable de dépôt `FACE_SEARCH` (coupée tant qu'elle ne vaut pas `on`) et les clés AWS.
Le guide de la Commission d'accès à l'information demande aussi d'offrir une autre façon de trouver ses photos, sans
biométrie : la galerie reste entièrement consultable et téléchargeable sans la recherche par visage.

### Configuration AWS

1. Créez un compte AWS.
2. Créez un utilisateur IAM `bbz-galerie` (sans accès à la console) avec la stratégie ci-dessous, en remplaçant `ACCOUNT_ID` par votre numéro de compte :

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["rekognition:CreateCollection", "rekognition:DeleteCollection", "rekognition:IndexFaces",
               "rekognition:SearchFacesByImage", "rekognition:DeleteFaces"],
    "Resource": "arn:aws:rekognition:ca-central-1:ACCOUNT_ID:collection/bbz-*"
  }]
}
```

3. Créez une clé d'accès pour cet utilisateur. Ajoutez deux secrets GitHub, `AWS_ACCESS_KEY_ID` et `AWS_SECRET_ACCESS_KEY`, puis relancez le workflow.
4. Recommandé : refusez qu'AWS réutilise vos contenus pour améliorer ses services d'IA, avec une stratégie de refus des services d'IA (AWS Organizations > Policies > AI services opt-out policies).

**Coût indicatif** (tarif public) :

| Élément | Prix |
|---|---|
| Photo indexée | environ 0,001 $ US |
| Recherche | environ 0,001 $ US |
| Stockage des empreintes | 0,00001 $ US par visage et par mois |

Une offre gratuite couvre 1 000 images par mois pendant 12 mois pour les nouveaux comptes.

### Fonctionnement

- **Indexation** : l'onglet « Visages » envoie l'aperçu de chaque photo à Rekognition par lots. Jusqu'à 100 visages sont gardés par photo, avec un filtre de qualité automatique.
- **Recherche** : le visiteur accepte explicitement, puis prend un selfie ou importe une photo, redimensionnée à 1 600 px dans son navigateur. Le serveur compare ce visage à la collection de cette galerie seulement, puis oublie l'image. Les résultats sont triés par similarité :
  - « probables » au-dessus du seuil réglable (90 % par défaut) ;
  - « à vérifier » jusqu'à 15 points sous ce seuil.

  Le visiteur peut élargir ou resserrer la recherche, et retirer les erreurs avec « Pas moi ».
- **Droits** : une correspondance ne montre que des photos que le visiteur voit déjà. Elle ne contourne jamais une galerie privée ou restreinte et ne vaut pas preuve d'identité.
- **« Effacer mon visage »** : n'importe quel participant peut retirer son visage de l'index de la galerie.
- **Conservation** : l'index est effacé automatiquement à la date fixée (30 jours par défaut, réglable de 1 à 365 jours) par la tâche quotidienne du Worker.

## Tests locaux

Le registre npm n'est pas nécessaire pour les tests. Le banc d'essai imite R2 (disque), D1 (SQLite intégré à Node 22),
Rekognition, GitHub, Stripe, Resend et Turnstile : aucun compte, aucun appel réseau.

```bash
cd worker
bash test/run-all.sh      # Node 22+, Python 3 et Pillow ; 125 contrôles en trois configurations
```

- `test/api.test.mjs` : galeries, import simple et en plusieurs parties, liens signés, ZIP vérifiés octet par octet,
  galerie restreinte, visages (imitation), expiration et nettoyage ;
- `test/site.test.mjs` : réservations (validation, robots, limites, Turnstile), disponibilités, double réservation,
  clients, archives, sélections, statistiques sans témoin, contenu du portfolio (conflits, validation), paiements
  (signature du webhook, rejeu) ;
- `test/bare.test.mjs` : sans aucune clé facultative, chaque service préparé refuse clairement au lieu de faire semblant.

Serveur de développement seul : `node --no-warnings test/devserver.mjs 8787 /tmp/bbz-data` (la tâche quotidienne
répond sur le port suivant, `/__cron`). Mot de passe de test : `motdepasse-de-test`.
