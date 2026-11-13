# Otome

# cd /Users/camelientournu/Otome-game/backend
# php artisan serve --host=127.0.0.1 --port=8001

# cd /Users/camelientournu/Otome-game
# python3 -m http.server 8080

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
- Après connexion, ou avec une session sans route ou sur `#bienvenue` : prénom
  et épisode de la sauvegarde, reprise de l'histoire et dressing.
- Les routes de jeu existantes (`#accueil`, `#episodes`, `#episode/...`,
  `#dressing`, `#galerie`) conservent leurs écrans.
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
- La galerie promotionnelle est retirée de cette page. Le bouton « Jouer » final
  remonte au hero sans démarrer la partie ; la galerie en jeu reste inchangée.

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

## Dressing et boutique

Le dressing conserve les PNG alignés de Sucrette et leur ordre de superposition.
`styles/dressing.css` ne s'applique qu'à cet écran. Les anciens calques de démonstration
(910 × 1727) ne sont pas compatibles avec le catalogue actuel (600 × 1200).

### Interface 2D et cadrages

- Le dressing réutilise `src/ui/gameMenu.js`, comme les dialogues :
  musique partagée, fiches des personnages, illustrations, journal et accueil.
  Il ne possède pas de navbar dédiée.
- Le fond est un studio abstrait rose poudré/crème, dessiné uniquement en CSS.
  Les décors illustrés et leur sélecteur jour/nuit ont été retirés du dressing ;
  aucune préférence de décor n'est désormais chargée ou enregistrée.
- `src/ui/dressingZoom.js` : cadrages mesurés sur les PNG 600 × 1200.
  Une unique transformation CSS porte tout le conteneur des calques (et le
  sprite d'origine), sans moteur 3D ni modification des images.
- `src/screens/dressingScreen.js` : catégories, catalogue unique garde-robe/boutique,
  brouillon, achats et résumé des pièces portées. Aucun second catalogue en bas.

Tenues ouvre la vue en pied ; Cheveux, Visage, Yeux, Sourcils et Lèvres cadrent
automatiquement la zone correspondante. Les contrôles permettent d'agrandir,
réduire, rétablir le cadrage de la catégorie ou retrouver la vue en pied.
Les transitions respectent `prefers-reduced-motion`. Sur mobile, la scène et
les catégories restent visibles pendant la consultation du catalogue.

Pour distinguer les sous-catégories sans modifier la sauvegarde, une entrée peut
préciser `subcategory: "coat"` pour un haut, `"set"` pour un ensemble ou
`"jewelry"` pour un accessoire. Sans précision, un `outfit` est une robe.
Le `thumbFocus` individuel d'un accessoire sert aussi au cadrage automatique
de sa zone. Les catégories vides n'affichent aucun vêtement fictif.
La qualité maximale du zoom reste limitée par la résolution des PNG existants.

Les données sont séparées sans changer le format de sauvegarde existant :

- Catalogue et prix : `data/appearance/catalogue.json`.
- Possessions : `inventory`, avec des clés `wardrobe:<category>:<id>`.
- Apparence validée : `appearance` ; les essayages restent un brouillon.
- Monnaie : `currency`, en gemmes comme dans le reste du jeu. Un versement de
  300 gemmes de démonstration est effectué une seule fois grâce au flag
  `demo-dressing-pieces` (montant dans `src/engine/wardrobe.js`).

Un achat est enregistré immédiatement par la sauvegarde Laravel ; un échec annule
la dépense et réécrit le tampon hors-ligne. Valider sauvegarde l'apparence puis
revient à l'écran précédent. Quitter ou réinitialiser ne retire pas les achats.
Un objet déjà porté dans une ancienne sauvegarde reste possédé après migration.

### Ajouter un vêtement à vendre

Déposer un vrai PNG transparent **600 × 1200**, aligné sur le corps existant, dans
`assets/Personnages/Sucrette/v2/`, puis ajouter une entrée au catalogue, par exemple
(chemin à remplacer par celui du fichier réellement ajouté) :

```json
{
  "id": "pull-creme",
  "category": "top",
  "label": "Pull crème",
  "layers": [{ "slot": "top", "file": "hauts/pull-creme.png" }],
  "unlock": { "type": "shop", "price": 120 }
}
```

Le prix doit être un entier positif ou nul. `unlock.type: "default"` indique un
objet possédé par défaut. `previewAsset` peut fournir le chemin complet d'une
miniature dédiée ; sinon le dressing recadre les calques avec `thumbFocus`.
Les catégories sont `skin`, `hair`, `eyes`, `eyebrows`, `mouth`, `top`, `bottom`,
`outfit`, `shoes`, `accessory`. Une coiffure peut fournir des slots `hair-back`
et `hair-front`. Les chaussures et accessoires n'apparaissent dans les listes
que lorsqu'un vrai asset a été ajouté ; aucun faux vêtement n'est généré.

Une condition facultative se place dans `unlock.requires` :
`{ "type": "flag", "flag": "bal", "hint": "Après le bal" }`,
`{ "type": "episode", "episode": "episode2" }` ou
`{ "type": "level", "level": 3 }` (lit `stats.level`).
La boutique est une démonstration utilisant la sauvegarde existante, pas un
système de paiement : le serveur borne les données mais ne vérifie pas encore
les prix et possessions contre le catalogue.

Tests ciblés :

```sh
node --test backend/tests/js/wardrobe*.test.mjs backend/tests/js/dressing-zoom.test.mjs
cd backend && php artisan test --compact --filter=WardrobeSaveTest
```