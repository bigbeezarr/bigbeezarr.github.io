# Galerie client BIGBEEZARR : « Récupérer mes photos »

Livraison de photos en qualité originale, intégrée au portfolio.

- **Pages** (GitHub Pages, ce dépôt) : `/galerie/` pour les clients, `/admin/` pour le photographe.
- **Serveur** (`worker/`) : un Cloudflare Worker qui gère les droits d'accès, les liens, les mots de passe, les expirations, les ZIP et les statistiques.
- **Stockage** : Cloudflare R2. Les originaux sont livrés octet par octet : pas de recompression, pas de redimensionnement, métadonnées intactes. Les téléchargements ne sont pas facturés.
- **Base** : Cloudflare D1 (galeries, photos, invités, statistiques).

WeTransfer Pro ne peut pas servir de stockage intégré. Sa documentation développeur indique « Unfortunately we no longer provide support for the WeTransfer API », et ses dépôts officiels sont archivés depuis le 27 octobre 2025.

## Mise en route (une seule fois)

Déjà fait le 1er novembre 2026 sur le compte Cloudflare de baeypro@gmail.com : le domaine **bigbeezarr.com** (zone active,
enregistrements DNS de GitHub Pages et de Resend), le domaine d'envoi Resend (vérifié) et le widget Turnstile
« BIGBEEZARR reservations » (clé publique déjà dans `content/site.json`). Le serveur répondra sur **https://api.bigbeezarr.com** :
le déploiement crée lui-même cet enregistrement DNS, son certificat, le stockage R2 et la base D1.

### 1. Secrets GitHub

Dans le dépôt `bigbeezarr/bigbeezarr.github.io` : Settings > Secrets and variables > Actions > New repository secret.

| Nom | Valeur | Où la trouver |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | `5ced07d1addac100cb8c4a05a1d43014` | tableau de bord Cloudflare, page d'accueil du compte |
| `CLOUDFLARE_API_TOKEN` | un jeton d'API | Cloudflare → My Profile → API Tokens → Create Token → modèle « Edit Cloudflare Workers » ; ajoutez **Account > D1 > Edit** et **Account > Workers R2 Storage > Edit** ; *Zone Resources* : **bigbeezarr.com** (le modèle donne déjà « Zone > Workers Routes > Edit », nécessaire pour api.bigbeezarr.com) |
| `BBZ_ADMIN_PASSWORD` | le mot de passe de `/admin/` | à choisir : au moins 10 caractères, utilisé nulle part ailleurs |
| `RESEND_API_KEY` | une clé d'API Resend | resend.com → API Keys → Create API Key, permission *Sending access*, domaine bigbeezarr.com |
| `TURNSTILE_SECRET` | la clé secrète du widget | Cloudflare → Turnstile → « BIGBEEZARR reservations » → Settings → Secret key |
| `BBZ_CONTENT_TOKEN` | un jeton GitHub à accès précis | voir « Portfolio » ci-dessous |

Les trois premiers sont indispensables ; chacun des trois autres n'allume son service que s'il existe. L'expéditeur
(`reservations@bigbeezarr.com`) et le destinataire des notifications (baeypro@gmail.com) sont des réglages publics
de `wrangler.template.toml`, pas des secrets.

Retirer un secret de GitHub ne le retire pas du serveur : supprimez-le aussi dans Cloudflare
(Workers & Pages → bbz-galerie → Settings → Variables and Secrets).

### 2. Déployer

Onglet **Actions** → « Déployer la galerie client » → **Run workflow**. Le workflow :

- lance la batterie de tests (`worker/test/run-all.sh`, sans compte ni réseau) : un seul échec et rien n'est déployé ;
- crée le stockage R2 et la base D1 s'ils n'existent pas, puis installe le schéma de la base ;
- déploie le Worker sur api.bigbeezarr.com, pose les secrets et génère une clé de signature au premier passage ;
- attend que le serveur réponde (le certificat d'un nouveau sous-domaine prend quelques minutes) ;
- écrit l'adresse du serveur dans `galerie/config.js` et dans `content/site.json` (branche `source`), puis relance
  « Publier le portfolio » : le formulaire « Demander une date » passe alors du courriel au serveur.

Seule la branche `main` déploie ; une demande de fusion ne fait que tester. Ensuite, `bigbeezarr.com/galerie/` et
`bigbeezarr.com/admin/` sont opérationnelles, et chaque modification de `worker/` redéploie automatiquement.
Si un envoi du workflow échoue avec une erreur 403 : Settings → Actions → General → Workflow permissions → **Read and write**.

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

### Notifications

Sans clé Resend, les demandes restent visibles dans `/admin/`. Avec `RESEND_API_KEY`, chaque demande de réservation ou
sélection envoie un courriel de `BIGBEEZARR <reservations@bigbeezarr.com>` (domaine vérifié chez Resend le
1er novembre 2026) à baeypro@gmail.com. Le bouton « Répondre » de la notification écrit directement au client.

### Anti-robot

Cloudflare Turnstile ajoute une vérification invisible ou en un clic au formulaire. Les deux moitiés vont ensemble :
la clé publique est déjà dans `content/site.json` (modifiable dans `/admin/` → Portfolio → Réglages du site), la clé
secrète devient le secret GitHub `TURNSTILE_SECRET`. Gardez cet ordre : le serveur refuse toute demande sans
vérification dès que le secret est posé. La politique de sécurité (CSP) du site n'autorise le script et le cadre de
Cloudflare que si la clé publique est fixée, et le script ne se charge que si le serveur est relié.
Essayé avec une imitation locale du service ; à vérifier sur le site réel après activation.

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
   - **Événement** : plusieurs participants, liste publique possible.
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

## Tests locaux

Le registre npm n'est pas nécessaire pour les tests. Le banc d'essai imite R2 (disque), D1 (SQLite intégré à Node 22),
GitHub, Resend et Turnstile : aucun compte, aucun appel réseau.

```bash
cd worker
bash test/run-all.sh      # Node 22+, Python 3 et Pillow ; 99 contrôles en trois passes
```

- `test/api.test.mjs` : galeries, import simple et en plusieurs parties, liens signés, ZIP vérifiés octet par octet,
  galerie restreinte, expiration et nettoyage ;
- `test/site.test.mjs` : réservations (validation, robots, limites, Turnstile), disponibilités, double réservation,
  clients, archives, sélections, statistiques sans témoin, contenu du portfolio (conflits, validation) ;
- `test/bare.test.mjs` : sans aucune clé facultative, chaque service préparé refuse clairement au lieu de faire semblant.

Serveur de développement seul : `node --no-warnings test/devserver.mjs 8787 /tmp/bbz-data` (la tâche quotidienne
répond sur le port suivant, `/__cron`). Mot de passe de test : `motdepasse-de-test`.
