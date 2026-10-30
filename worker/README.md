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

### 3. Déployer

Allez dans l'onglet **Actions**, choisissez « Déployer la galerie client », puis **Run workflow**. Le workflow :

- crée le stockage R2 et la base D1 s'ils n'existent pas ;
- installe le schéma de la base ;
- déploie le Worker et pose les secrets ;
- génère une clé de signature aléatoire au premier passage ;
- écrit l'adresse du serveur dans `galerie/config.js`.

Les pages `bigbeezarr.github.io/galerie/` et `bigbeezarr.github.io/admin/` sont ensuite opérationnelles. Chaque modification de `worker/` redéploie automatiquement.

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

Le registre npm n'est pas nécessaire pour les tests. Le banc d'essai imite R2 (disque), D1 (SQLite intégré à Node 22) et Rekognition.

```bash
cd worker
node test/sigv4.test.mjs                       # signature AWS contre l'exemple officiel
python3 test/mock_rekognition.py 9911 &        # imitation Rekognition (aucune vraie reconnaissance)
SINGLE_MAX=1048576 PART_SIZE=524288 AWS_ACCESS_KEY_ID=AKIATEST AWS_SECRET_ACCESS_KEY=x \
  AWS_ENDPOINT=http://127.0.0.1:9911/ node --no-warnings test/devserver.mjs 8787 /tmp/bbz-data &
DATA=/tmp/bbz-data node --no-warnings test/api.test.mjs photo1.jpg photo2.jpg fichier.NEF
```
