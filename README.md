# Otome

# cd /Users/camelientournu/Otome-game/backend
# php artisan serve --host=127.0.0.1 --port=8001

# cd /Users/camelientournu/Otome-game
# php -S 127.0.0.1:8080 scripts/serve-game.php

Ne pas exposer la racine du dépôt avec un serveur de fichiers générique :
le routeur PHP ne publie que le frontend et bloque les originaux des
illustrations (y compris leurs copies sous `assets/media/illustrations`).

## Tailles des personnages en scène

Dans les dialogues joués, les personnages dont la taille est renseignée sont mis
à l'échelle d'après leurs fiches en base, avec Isaac comme référence. Le champ `taille` édité dans
le studio prime sur l'ancien champ `height` ; les formats `1m82`, `1,82 m`
et `182 cm` sont reconnus. Les marges transparentes des
sprites sont mesurées pour aligner les pieds et calculer les proportions.
Une nouvelle image apparaît une fois chargée et sa taille calculée ; si la
mesure échoue, l'image reste utilisable sans ajustement et l'erreur est signalée.
À trois, les personnages sont cadrés derrière la barre de dialogue.
Les personnages sans taille et les portraits du carnet ne sont pas redimensionnés.
Les tailles absentes ne sont pas inventées ; ce système ne modifie pas la base.
L'extrait public conserve son cadrage actuel.

## Lovomètre en jeu

Le HUD ivoire en haut à gauche de la scène affiche le portrait du personnage
(`portraits.default`, sinon `sprite`), puis le cœur, le nom et le score signé
sur une même ligne, sans capsule. La barre épaisse occupe toute la largeur sous cette ligne.
La barre est vide à −100 %, à moitié remplie à 0 % et pleine à 100 %.
Le même composant sert au jeu et à l'extrait public. Le carnet de relations,
les sauvegardes et la logique de dialogue ne sont pas modifiés.

La carte apparaît en fondu, la barre évolue sans être recréée et les animations
de gain et de perte partent du cœur ou le rejoignent. Le HUD n'intercepte aucun
clic et respecte la préférence de réduction des animations. La largeur maximale
(`--lovo-largeur`), les couleurs et les durées, dont `--lovo-transition`, sont
réglables sur `.lovometre` dans `style.css`.
La version précédente est conservée dans `backups/lovometre-2026-11-16-2335/` :
`gaugeBar.js` est une copie du composant, et `lovometre.css` contient ses styles
et les anciens ajustements de l'extrait. Ces fichiers ne sont pas chargés par le jeu.
Pour revenir en arrière, restaurer le composant à son emplacement d'origine et
remplacer les règles du lovomètre par celles de cette sauvegarde.

## Carnet personnel et compte

`#profil` affiche un carnet ivoire et bordeaux occupant la fenêtre, avec une
fiche d'identité compacte, des onglets contrastés et des cartes de collection.
Les pages peuvent défiler intérieurement si la hauteur est insuffisante.
Les deux pages sont ouvertes sur ordinateur ; sur petit écran ou en faible
hauteur, les commandes Profil / Carnet permettent de les consulter séparément.
Les illustrations sont paginées selon l'espace disponible et seules les
images de la page courante sont chargées. Leurs détails restent consultables
en grand. Les formulaires du compte disposent de leur propre vue de modification.
La sidebar conserve le logo officiel et les accès Mon carnet et Compte.
Le carnet réunit les illustrations, les statistiques réellement suivies et
l'accès Mes relations, qui réutilise le carnet de personnages du jeu avec les
rencontres et les jauges de la dernière partie, sans créer de sauvegarde.
La carte Meilleur Lovomètre indique le meilleur score enregistré, le nom du
personnage correspondant et son portrait, y compris dans l'affichage compact.
Si le portrait est indisponible, la carte affiche son initiale.
Les trophées et les indicateurs Bonnes réponses / Succès ne sont pas proposés
tant que ces fonctionnalités ne sont pas disponibles.
Le logo revient toujours à l'accueil ; un accès Retour au jeu conserve le
contexte d'ouverture lorsqu'on vient d'un épisode ou du dressing.
Sur tous les onglets du carnet et les pages du compte, un bouton Retour à
l'accueil reste visible en bas à gauche et ramène aux épisodes, indépendamment
du contexte d'ouverture. Une bande réservée évite qu'il recouvre le contenu
sur petit écran.
`#galerie` reste compatible et ouvre l'onglet Illustrations ; les alias
`#illustrations`, `#trophees`, `#profil/statistiques`, `#compte` et `#parametres`
survivent également au rechargement (`#trophees` redirige vers le carnet).
Aucun asset graphique de remplacement
n'est utilisé : en l'absence d'avatar enregistré, le profil montre une initiale.
L'upload d'avatar n'est pas proposé, le modèle utilisateur n'en ayant pas.
Le pseudo du compte est le nom unique de l'héroïne (Pommette par défaut), dans
l'accueil, le dressing, les répliques, la narration et les choix utilisant
`{playerName}`. Il remplace l'ancien prénom propre à chaque partie, y compris
pour les sauvegardes existantes et les caches hors ligne, sans effacer la progression.
Changer le pseudo dans Mon compte s'applique aussi au retour dans une partie.
L'API déduit toujours `playerName` du compte : un ancien client ne peut pas
réintroduire un prénom différent en sauvegardant ou en recommençant.

Les statistiques viennent de `/api/profile/stats`, pour l'utilisateur Sanctum :
collection dédoublonnée entre les acquisitions historiques et les sauvegardes,
et maximum du Lovomètre des crushs dans les sauvegardes/journaux conservés.
Les pics antérieurs à une ancienne réinitialisation ne peuvent pas être
reconstitués si leur journal a été supprimé. Les bonnes réponses et les succès
sont `null`, jamais un pourcentage ou un trophée fictif. Pour les ajouter :
définir éditorialement la correction des options publiées et en journaliser
le résultat immuable côté serveur ; définir un catalogue de succès et une
relation utilisateur/succès avec date d'obtention et règles serveur.
Il n'existe actuellement aucun catalogue de trophées à afficher.

`#compte` utilise les routes privées `GET/PATCH/DELETE /api/account`.
Toute modification exige le mot de passe actuel. Les pseudos (non uniques,
comme à l'inscription) acceptent 3–40 caractères : lettres Unicode, chiffres,
espaces, tirets et traits de soulignement. Les nouveaux mots de passe exigent
8–100 caractères et une confirmation ; Laravel les hache. Modifier e-mail ou
mot de passe révoque les autres jetons et sessions. Aucun circuit d'envoi et
de confirmation d'adresse n'est actuellement branché : la modification
d'e-mail est immédiate après réauthentification, ce que le formulaire indique.
La suppression exige une modale explicite, le mot de passe et `SUPPRIMER` ;
une transaction supprime jetons, sessions et utilisateur, avec cascade vers
sauvegardes, choix et acquisitions. Elle ne s'exécute jamais au premier clic.
La déconnexion attend la sauvegarde, demande confirmation et révoque
uniquement le jeton courant ; elle ne supprime aucune donnée côté serveur.

### Déploiement des illustrations privées — validation requise

La route publique `/api/media/{id}/file` ne sert plus d'illustrations.
`/api/illustrations/{id}/file` exige Sanctum et une acquisition du joueur,
avec cache privé `no-store`. Le frontend charge ces images avec son jeton,
puis utilise des URL Blob révoquées à la fin de session. Le catalogue ne donne
pas de fichier public de remplacement. Le déblocage vérifie que le fichier
existe et que la scène publiée affiche cette image sur le parcours du joueur,
vérifié à partir du journal de choix. Une fiche Studio seule ne débloque rien. Les effets
et flags du journal sont pris dans l'option publiée, pas dans la requête.
Ajouter des identifiants au payload d'une sauvegarde ne crée plus d'acquisition.
La galerie réunit les acquisitions enregistrées pour le compte, toutes parties
confondues. Un identifiant présent uniquement dans une sauvegarde ne compte pas.
Les acquisitions déjà enregistrées sont conservées sans réécriture.
Un ancien journal incompatible avec une version désormais publiée est refusé
explicitement ; sa réconciliation doit être examinée, pas simulée côté client.
Une CG publiée non importée est signalée à son apparition sans empêcher de
continuer l'histoire ; aucun chemin public de secours n'est affiché.
Les extraits promotionnels éphémères n'affichent pas les CG privées.

Préparation non destructive, à valider avant activation sur l'hébergement :

1. Sauvegarder la base et la médiathèque ; exécuter
   `cd backend && php artisan game:audit-illustrations` (lecture seule).
2. S'il manque des copies privées, utiliser l'importeur existant
   `php artisan studio:import-media ../assets` **après validation**.
   Il copie les fichiers sans supprimer les originaux. Ne pas ajouter
   `--link-episodes` sans valider les nouveaux brouillons.
3. Remplacer le serveur statique générique par
   `php -S 127.0.0.1:8080 scripts/serve-game.php` depuis la racine,
   ou appliquer la même liste d'autorisation sur l'hébergement.
   Les seules exceptions publiques du dossier Illustrations sont les trois
   images promotionnelles de l'accueil et des vignettes d'épisodes.
   Ne jamais exposer le disque privé `backend/storage/app/studio-media`.
4. Vérifier anonymement les anciennes URL : les CG et leurs copies doivent
   renvoyer 404 ; les décors, sprites, logo et images promotionnelles restent
   publics. Invalider les anciens caches/CDN : un fichier déjà téléchargé
   lorsqu'il était public ne peut pas être récupéré à distance.

Aucun déplacement d'original ni migration de données réelle n'est exécuté
par cette refonte. Tout serveur statique générique doit être remplacé lors de
cette activation : une protection dans Laravel seule ne peut pas contrôler
les fichiers servis par un autre serveur.

Tests ciblés :
`cd backend && php artisan test --filter='PlayerProfileTest|CharacterMediaApiTest'`
et `node --test backend/tests/js/profile.test.mjs` depuis la racine.

## Entrée du campus

La landing page est construite dans `src/screens/loginScreen.js`, avec les
composants visuels de `src/ui/landingComponents.js` et les styles isolés dans
`styles/connexion.css`. Le premier écran suit la maquette bordeaux, cerise
et crème : navigation fine à icônes, identité à gauche, deux sprites transparents
au centre et connexion à droite, sans décor de campus ni particules.
Le logo est le PNG local d'origine ; Isaac et Aaron sont retrouvés par leur
identifiant dans `/api/characters`, qui fournit leurs sprites versionnés depuis
la médiathèque. Leur ordre ne dépend pas de celui du catalogue, et aucun autre
personnage ne leur est substitué si ces assets manquent.

L'accueil et les cartes de personnages du Studio utilisent des aperçus WebP
transparents (1400 pixels maximum), générés depuis les médias de personnages
du Studio. Les originaux restent inchangés et utilisés en jeu. Les GIF restent
inchangés pour préserver leur animation. Les aperçus sont versionnés après
modification du média et mis en cache dans `backend/storage/app/character-previews` ;
le cache navigateur du Studio est privé. Les illustrations ne passent pas par
ces routes. En cas d'échec de génération, l'erreur est journalisée et l'original
est servi sans mise en cache.

Après déploiement, exécuter `php artisan studio:warm-character-previews`
depuis le dossier de l'application Laravel (`backend` localement, `/app` dans
le conteneur) pour préparer les médias existants avant leur première visite.
La commande signale les fichiers manquants ou erreurs et peut être relancée.
Sans cette préparation, le premier affichage attend la génération ; les aperçus
sont ensuite réutilisés tant que leur cache serveur est conservé. Le stockage
de ce cache doit être persistant si l'on souhaite éviter sa régénération après
redéploiement. PHP nécessite GD avec WebP (inclus dans l'image Docker).
L'extrait jouable est chargé à l'approche de sa section pour ne pas concurrencer
les portraits visibles à l'ouverture.

La section Concept, dans `src/ui/conceptSection.js`, alterne avec le Hero et les
Personnages bordeaux : fond crème `#FFF8F2` et ivoire `#FFF0E4`, titres bordeaux
et cerise, trois fonctionnalités verticales et deux portraits encadrés. Camel et Stella
sont sélectionnés par leur identifiant dans le même catalogue, sans retoucher
leurs sprites. Ruban, enveloppe et pomme d'amour sont des ornements SVG locaux ;
aucune image externe ni illustration de personnage générée n'est utilisée.

Entre le Hero et Concept, une vague SVG bordeaux/crème remplace le bloc
intermédiaire, sans bande vide. Une seconde vague rejoint les Personnages.
L'ancre Concept conserve la vague sous la navbar et active le lien dès celle-ci.
Les sprites du Hero restent les originaux, aux proportions natives (`height: auto`).
Leur conteneur élargi borne le rendu avec `overflow: clip` et un masque
progressif limité à sa boîte : les images ne peuvent plus réapparaître en
rectangle sous le fondu (`mask-clip: no-clip` et les hauteurs forcées sont retirés).
Les animations d'entrée respectent `prefers-reduced-motion`.
Sur desktop, la manche d'Aaron passe devant le bord de la carte de connexion ;
le casting conserve `pointer-events: none` pour laisser les champs et boutons accessibles.

Sur mobile, identité, personnages puis connexion sont empilés. Les sections
existantes restent accessibles sous le hero ; aucune nouvelle section n'est
ajoutée. Les styles restent limités à `.page-connexion` et à son conteneur racine.
Les rencontres, le cadre de l'extrait, l'invitation à jouer et le footer
prolongent la même palette bordeaux, cerise, crème et champagne. Les sept
portraits sont présentés en pied, sans recadrage (`object-fit: contain`), dans
un carrousel natif à cartes rectangulaires : quatre sur desktop, deux sur tablette,
une sur mobile. `src/ui/characterCarousel.js` gère les flèches, les repères,
les extrémités, le redimensionnement et les touches fléchées / Début / Fin.
Le trackpad et le swipe restent natifs, sans détourner le scroll vertical.
La photo décorative à droite des Personnages utilise l'image publiée par
`/api/backgrounds`, identifiée par le `sourcePath` de l'entrée du campus,
et non l'ancien fichier local. Si elle manque, le cadre reste masqué avec
un avertissement console, sans empêcher les portraits ni l'extrait de charger.
Les cœurs sont décoratifs : aucun système de favoris n'existe actuellement.
Seul l'habillage
extérieur de l'extrait change : son interface de jeu reste inchangée.

- Sans session : connexion et inscription via les mêmes services Laravel.
- Après connexion, ou avec une session sans route ou sur `#bienvenue` :
  ouverture directe de `#episodes`, sans écran d'accueil intermédiaire.
  Le pseudo du compte est repris sans demander un second prénom.
- `#accueil` reste un ancien lien compatible, redirigé vers `#episodes`.
  Les routes `#episode/...` et `#dressing` conservent leurs écrans ;
  `#galerie` ouvre les Illustrations dans le carnet personnel.
- Le casting est présenté avant l'extrait dans l'ordre Isaac, Aaron, Camel,
  Mehdi, Liam, Stella, Sasha. Les sprites et descriptions proviennent de la base,
  sélectionnés par identifiant, sans doublons de variantes ni personnage de substitution.
  Les portraits manquants sont signalés. Les boutons conservent leur entrée
  vers la connexion ou la reprise de l'histoire.
- `src/engine/episodePreview.js` extrait le premier choix de relation de l'épisode 1,
  ses trois répliques précédentes et la réponse à chaque option. Il réutilise
  `DialogueEngine` et le véritable écran `dialogueScreen.js` (bulles, avatar,
  lovomètre, boutons de choix et animations), dans un cadre responsive.
- Le mode `ephemere` du moteur ne fait aucune sauvegarde, aucun journal de choix,
  aucun déblocage de carnet ou d'illustration et ne lance pas de musique.
  Les jauges viennent des valeurs initiales des personnages, jamais de la partie
  du joueur. « Revoir l'extrait » recrée un état indépendant.
- La galerie promotionnelle est retirée de cette page. Les actions Créer mon
  compte ouvrent l'inscription ; Connexion mène au formulaire et Essayer un
  extrait à la démo sans sauvegarde. La navigation Concept / Rencontres /
  Extrait jouable ne propose plus deux noms pour la même section.
  Les Illustrations en jeu sont accessibles dans le carnet personnel.

La navigation occupe une ligne de hauteur constante, hors du conteneur
scrollable `.entree-defilement` : les débordements et les contextes d'empilement
des sections ne peuvent pas l'emporter dans le défilement.
L'accueil utilise `100dvh` ; ses ancêtres bornés utilisent `overflow: clip`
plutôt que des conteneurs `hidden` susceptibles de défiler au focus.
Sur desktop de faible hauteur, le logo et les espacements s'adaptent sans
réduire les personnages ; si nécessaire, le Hero grandit et défile normalement.
Les sections conservent leur espacement intérieur sous la barre et l'extrait garde 24 px
de dégagement supplémentaire. L'indicateur actif suit ce défilement interne,
y compris pour l'ancre imbriquée de l'extrait.
Tous les liens utilisent la même fonction de navigation, qui ferme le menu
mobile et appelle `scrollTo` uniquement sur `.entree-defilement`, jamais
`scrollIntoView` sur ses ancêtres. Le Hero revient explicitement à zéro.
Les autres cibles sont positionnées relativement au bord réel du conteneur,
déjà situé sous la navbar, en tenant compte de leur `scroll-margin-top` ;
la hauteur de la barre n'est donc pas soustraite une deuxième fois.
La navigation interne ne modifie pas le hash du routeur. Le menu mobile,
les onglets clavier et les animations respectent les besoins d'accessibilité,
dont `prefers-reduced-motion`.

Tests ciblés :
`node --test backend/tests/js/landing.test.mjs backend/tests/js/episode-preview.test.mjs`.

## Accueil du jeu — épisodes

`#episodes` est l'unique accueil connecté : la page conserve son journal,
ses aperçus et la sélection de l'épisode en cours. L'ancien écran séparé est
supprimé ; `#accueil`, la racine et `#bienvenue` rejoignent directement cette
page avec une session. Sans session, la présentation et la connexion restent
affichées.

Le menu partagé, en haut à droite du journal, donne accès aux relations,
au dressing, au carnet, au compte et à la musique. Il n'affiche pas de lien
Accueil vers la page déjà ouverte. Depuis le dialogue ou le dressing,
Accueil · Épisodes ramène au journal, sans étape intermédiaire.
Le pseudo dans l'en-tête ouvre directement le profil ; le dressing n'est
accessible que dans le menu, sans bouton supplémentaire dans l'en-tête.

L'entrée retrouve la dernière progression et son emplacement sans la
réinitialiser. Les écritures en attente de la session courante sont confirmées
avant de revenir à l'accueil. Les échecs de lecture sont remontés, jamais
interprétés comme l'absence de partie. Le premier épisode utilise directement
le pseudo du compte, sans saisie supplémentaire.

Recommencer l'histoire reste une action secondaire du menu, uniquement avec
une partie existante. Après confirmation, elle conserve le pseudo du compte et réinitialise
l'emplacement principal (0), sans effacer les autres emplacements ni la
collection d'illustrations. Les protections contre les caches hors ligne
non synchronisés restent actives. Les styles des avertissements sont conservés
dans `styles/modales.css`, indépendamment de l'écran supprimé.

Les écrans sont enregistrés dans l'historique du navigateur : Retour / Suivant
restaurent la route sans ajouter d'entrée. Une ancienne URL d'épisode différente
de la partie active ouvre le journal au lieu d'y injecter un point de reprise
incompatible. Les anciens alias de route restent reconnus.

Dans le dressing, quitter une tenue modifiée demande confirmation, y compris
avec Retour navigateur ; refuser conserve le brouillon et la position
d'historique. La fermeture ou le rechargement déclenche l'avertissement natif.
Les achats restent acquis même si la tenue est abandonnée ; une transaction
en cours bloque les sorties internes jusqu'à sa fin.

Tests ciblés : `node --test backend/tests/js/episode-select.test.mjs backend/tests/js/home-save.test.mjs backend/tests/js/game-modal.test.mjs backend/tests/js/landing.test.mjs`.

## Journal des épisodes

Les aperçus des épisodes 1 et 2 utilisent les vignettes locales
`assets/Illustrations/vignette-episode-1.png` et `vignette-episode-2.png`.
Les décors restent utilisés en fond du journal et pour les autres épisodes.
Les épisodes terminés expliquent que le rejeu n'est pas encore disponible,
sans réinitialiser la partie. Changer d'épisode pendant un épisode inachevé
demande confirmation avant de remplacer son point de reprise.
L'accès libre aux épisodes non terminés reste conservé pour le développement ;
aucun nouveau système de déblocage ou de rejeu n'est activé par cette refonte.

## Points d'action

Pour la démo, les PA sont masqués et aucune action ne les consomme. Les valeurs
enregistrées sont conservées sans régénération côté serveur. Pour les réactiver,
passer `PA_ACTIFS` à `true` dans `src/engine/saveSystem.js` et `paEnabled` à
`true` dans `backend/config/game.php`.

## Dressing et boutique

Le dressing conserve les PNG alignés de Pommette et leur ordre de superposition.
`styles/dressing.css` ne s'applique qu'à cet écran. Le repère d'affichage est de
600 × 1200 ; les images téléversées depuis le studio mesurent 3000 × 6000.
Les anciens calques de démonstration (910 × 1727) ne sont pas compatibles.

### Interface 2D et cadrages

- Le dressing réutilise `src/ui/gameMenu.js`, comme les dialogues :
  musique partagée, fiches des personnages, illustrations, journal et accueil.
  Il ne possède pas de navbar dédiée.
- Le fond est un studio abstrait rose poudré/crème, dessiné uniquement en CSS.
  Les décors illustrés et leur sélecteur jour/nuit ont été retirés du dressing ;
  aucune préférence de décor n'est désormais chargée ou enregistrée.
- `src/ui/dressingZoom.js` : cadrages mesurés sur le repère 600 × 1200.
  La pile de calques est redimensionnée à la taille du zoom, de sorte que le
  navigateur dessine directement les PNG d'origine à la bonne taille.
- `src/screens/dressingScreen.js` : catégories, catalogue unique garde-robe/boutique,
  brouillon, achats et résumé des pièces portées. Aucun second catalogue en bas.

Tenues ouvre la vue en pied ; Cheveux, Peau, Yeux, Sourcils et Lèvres cadrent
automatiquement la zone correspondante. Les contrôles permettent d'agrandir,
réduire, rétablir le cadrage de la catégorie ou retrouver la vue en pied.
Les transitions respectent `prefers-reduced-motion`. Sur mobile, la scène et
les catégories restent visibles pendant la consultation du catalogue.

Les catégories vides n'affichent aucun article fictif.
La qualité maximale du zoom reste limitée par la résolution des PNG existants.

Les données sont séparées sans changer le format de sauvegarde existant :

- Catalogue et prix : onglet **Dressing** du back-office, diffusé par `/api/appearance/catalogue`.
- Possessions : `inventory`, avec des clés `wardrobe:<category>:<id>`.
- Apparence validée : `appearance` ; les essayages restent un brouillon.
- Monnaie : `currency`, en gemmes comme dans le reste du jeu. Un versement de
  300 gemmes de démonstration est effectué une seule fois grâce au flag
  `demo-dressing-pieces` (montant dans `src/engine/wardrobe.js`).

Un achat est enregistré immédiatement par la sauvegarde Laravel ; un échec annule
la dépense et réécrit le tampon hors-ligne. Valider sauvegarde l'apparence puis
revient à l'écran précédent. Quitter ou réinitialiser ne retire pas les achats.
Les achats restent dans l'inventaire ; les anciennes apparences statiques
absentes du dressing reviennent au sprite d'origine.

### Ajouter un élément au dressing

Dans le back-office, ouvrir l'onglet **Dressing**, choisir une catégorie
(Peau, Cheveux, Yeux, Sourcils, Bouche, Hauts, Bas, Chaussures, Tenue complète
ou Accessoires), donner un nom et importer un PNG transparent de **3000 × 6000**
aligné sur le sprite. Laisser le prix vide rend l'élément disponible gratuitement
dans la garde-robe, sans l'équiper. Renseigner un prix le place dans la boutique.

Les nouveaux articles, leur image et leur prix sont transmis au jeu par l'API.
Une peau équipée remplace le sprite d'origine de Pommette. Les PNG de la
catégorie Yeux sont des couleurs d'iris : ils passent **derrière** la peau,
qui porte les pupilles et les cils, avec des ouvertures transparentes pour
la couleur. Si le sprite d'origine a déjà des iris opaques, il faut équiper
une peau avec ces ouvertures pour voir la couleur choisie.
Les anciens identifiants d'apparence qui n'existent plus dans le catalogue
reviennent au sprite d'origine plutôt que d'afficher une tenue vide.

Tests ciblés :

```sh
node --test backend/tests/js/wardrobe*.test.mjs backend/tests/js/dressing-zoom.test.mjs
cd backend && php artisan test --compact --filter=WardrobeSaveTest
```