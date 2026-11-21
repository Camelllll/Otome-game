# Audit d'accessibilité

Objectif : améliorer progressivement l'accessibilité du jeu vers WCAG 2.2 AA.
Les constats ci-dessous ne constituent pas une certification : les parcours,
les lecteurs d'écran et les contenus du Studio doivent aussi être vérifiés.

| Problème | Gravité | Écran | Fichiers | Cause probable | Correction prévue | Validation |
|---|---|---|---|---|---|---|
| La réduction des animations ne peut pas être activée dans le menu. | Important | Jeu, menus | `src/ui/accessibilite.js`, `src/ui/gameMenu.js` | Préférence existante sans commande dans le panneau. | Exposer la préférence et son état. | Clavier, persistance et animation réduite. |
| Le panneau d'accessibilité se déclare modal sans retenir le focus. | Important | Menu de jeu | `src/ui/gameMenu.js` | `aria-modal` sans gestion de Tab. | Appliquer une sémantique cohérente au comportement réel. | Tab, Maj+Tab et Échap. |
| Les messages narratifs ne sont pas explicitement annoncés lors de leur remplacement. | Important | Dialogues | `src/ui/dialogueBox.js` | Remplacement du contenu sans région d'annonce. | Ajouter une annonce adaptée sans interrompre les choix. | Lecteur d'écran et progression clavier. |
| Les animations de cœurs sont créées malgré le réglage manuel de mouvement réduit. | Important | Lovomètre | `src/ui/gaugeBar.js`, `styles/accessibilite.css` | Le code ne vérifie que la préférence système ; les particules masquées peuvent rester présentes. | Respecter aussi les préférences du jeu et nettoyer les particules. | Tests des modes et changements en cours de jeu. |
| Le carnet se déclare modal sans confinement du focus. | Important | Carnet de relations | `src/ui/carnetRelations.js` | Gestion d'Échap sans cycle Tab. | Confiner et restituer le focus, y compris dans la visionneuse. | Tab, Maj+Tab, Échap et retour au contrôle initial. |
| Les onglets et cartes du carnet perdent le focus après leur reconstruction. | Important | Carnet de relations | `src/ui/carnetRelations.js` | Le rendu remplace les contrôles actifs, y compris au chargement asynchrone. | Restaurer le contrôle équivalent. | Sélection clavier et chargement retardé. |
| L'illustration affichée pendant l'histoire ne bloque pas le focus en arrière-plan et n'a pas d'alternative. | Bloquant | Jeu narratif | `src/screens/dialogueScreen.js` | Voile non modal, sans gestion de focus ni description d'image. | Rendre le dialogue modal et nommer l'image sans inventer sa description. | Ouverture, Tab, Échap et fermeture au clavier. |
| Une narration longue et une bulle défilante peuvent être inaccessibles au clavier. | Bloquant | Jeu narratif | `style.css`, `src/ui/dialogueBox.js` | Barre non bornée et bulle non focalisable. | Borner et permettre le défilement sans masquer le texte. | Longs textes à 200 %, mobile et clavier. |
| Le nom du lovomètre est tronqué et ses changements ne sont pas annoncés. | Important | Jeu narratif | `style.css`, `src/ui/gaugeBar.js` | Ellipse et absence de région d'annonce. | Retour à la ligne et annonce textuelle des variations. | Nom long et gain/perte au lecteur d'écran. |
| Le focus se perd après une pagination, un achat ou la fermeture d'une illustration. | Important | Boutique et illustrations | `src/screens/dressingScreen.js`, `src/screens/illustrationGalleryScreen.js` | Contrôle d'origine désactivé ou remplacé au rendu. | Restaurer une cible existante une fois disponible. | Achat simulé, pagination et retour de visionneuse au clavier. |
| Le bouton Retour du carnet perd son nom sur mobile. | Important | Carnet de relations | `src/ui/carnetRelations.js`, `carnet.css` | Texte masqué et icône décorative. | Fournir un nom explicite. | Arbre d'accessibilité en largeur mobile. |
| La barre d'accueil et son titre sont coupés à 200 % sur mobile. | Bloquant | Connexion / accueil | `styles/connexion.css` | Largeurs minimales, barre fixe et mots trop larges. | Réorganiser la barre et autoriser les retours à la ligne. | 375 × 812 à 100 %, 150 % et 200 %, clavier. |
| Les couleurs propres du carnet ne suivent pas le contraste élevé. | Important | Carnet de relations | `carnet.css`, `styles/accessibilite.css` | Palette locale et badges à faible contraste. | Prévoir des couleurs et bordures explicites en contraste élevé. | Mesures de contraste et contrôle des états. |
| Des badges de rareté ont un contraste inférieur à 4,5:1 ; les titres de la collection sont limités à deux lignes. | Important | Carnet et illustrations | `carnet.css`, `styles/profil.css` | Dégradés clairs et troncature des descriptions. | Renforcer les contrastes et permettre la lecture complète. | Mesure des couleurs et titre long à 200 %. |
| Les tests du routeur échouent avant les corrections. | Important | Accueil | `backend/tests/js/landing.test.mjs`, `src/main.js` | Le contexte de test ne fournit pas l'initialisation d'accessibilité ajoutée dans l'arbre de travail. | Adapter le double de test sans changer le routeur. | Relancer les tests du routeur. |
| Les colonnes et contrôles du dressing peuvent déborder lorsque le texte grandit. | Bloquant | Dressing et boutique | `styles/dressing.css`, `src/screens/dressingScreen.js` | Anciennes dimensions et positions rigides. | Réorganiser selon l'espace disponible et maintenir le focus visible. | Desktop et mobile, 100–200 %, clavier et fonds opaques. |

## Vérifications déjà réalisées

- Socle : commandes de réduction des animations, des scintillements et des
  cœurs ajoutées au menu ; panneau replié à la largeur disponible. Les valeurs
  de texte affichent désormais leur pourcentage.
- Tests du socle et de l'accueil : 48 réussis après adaptation du double de
  test du routeur. Le sous-panneau d'accessibilité est un groupe non modal.
- Connexion : contrôles et titre mesurés sans débordement à 100 %, 150 %
  et 200 % sur desktop et à 100 % et 200 % sur 375 et 320 pixels.
- Modale d'avertissement longue : défilement, contraste élevé et retour du
  focus avec Échap vérifiés sur un écran de 320 × 568 pixels à 200 %.
- Dialogue : région d'annonce ajoutée, bulle focalisable et narration longue
  défilable à grande taille. À 320 × 568 et 200 %, la touche Fin atteint le
  bas d'une narration fictive longue. L'annonce reste à valider avec un lecteur
  d'écran, notamment lors des choix et des transitions.
- Lovomètre : le nom peut passer à la ligne et les particules ne sont plus
  créées en mouvement réduit ou lorsque les animations de cœurs sont réduites
  ou désactivées. Les variations ne sont pas encore annoncées textuellement.
- Carnet : focus confiné et restitué, y compris après reconstruction des
  onglets et cartes ; bouton Retour nommé. Contrôle partiel au clavier et
  onglets mesurés sans débordement à 320 pixels et 200 %, avec données fictives.
  La visionneuse et le contraste de tous les états restent à vérifier.
- Collection : les titres et descriptions ne sont plus limités à deux lignes ;
  une carte fictive à 200 % a été mesurée dans une grille défilante. Retour du
  focus de la visionneuse et pagination améliorés, à vérifier avec l'API réelle.
- Dressing : retour du focus prévu après achat et après annulation d'une sortie ;
  le parcours d'achat réel reste à vérifier.
- Suite ciblée après ces modifications : 97 tests réussis ; syntaxe JavaScript
  et `git diff --check` vérifiées.
- Dressing : dimensions et navigation clavier vérifiées sur un catalogue fictif,
  de 100 % à 200 %, en contraste élevé et avec fonds opaques.
- Tests ciblés du dressing, du cadrage et des préférences : 24 réussis.
- Limite : les médias réels et parcours connectés n'ont pas été vérifiés lors de
  ce premier contrôle ; l'API locale était inaccessible depuis le port de test.
- Le Studio possède ses propres composants et styles : les réglages du jeu
  ne s'y appliquent pas. Son utilisation au zoom et au clavier reste à auditer.
- L'illustration affichée pendant l'histoire n'est pas encore une fenêtre
  modale accessible. Le contraste élevé, les fonds opaques et le clavier
  doivent encore être vérifiés sur tous les écrans et avec des médias réels.

## Checklist pour les prochaines interfaces

- Tester à 200 %, sur mobile et au zoom navigateur, sans masquer le contenu.
- Associer les champs à leurs libellés, nommer les icônes et conserver l'ordre du focus.
- Prévoir des états lisibles autrement que par la couleur et un focus contrasté.
- Respecter les réglages de contraste, d'opacité et de mouvement réduit.
- Vérifier Tab, Maj+Tab, Entrée, Espace et Échap sur les parcours concernés.
