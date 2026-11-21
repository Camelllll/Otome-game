# Pomme d'Amour — contexte du projet

## Projet

Jeu otome web en JavaScript, avec un Studio d'administration Laravel 12 / Livewire 3 et une base MariaDB. Le jeu récupère son contenu et les médias du Studio par l'API.

- `src/` : logique du jeu, écrans, interface et accès à l'API.
- `styles/`, `style.css`, `index.html` : présentation du jeu.
- `backend/app/` : composants du Studio, contrôleurs API, modèles et services.
- `backend/resources/` : interfaces du Studio ; `backend/routes/` : routes web et API.
- `backend/database/migrations/` : schéma de la base.
- `tests/`, `backend/tests/` : tests du jeu et du Studio.
- `Dockerfile`, `deploy/` : configuration de production Railway.

Consulter le `README.md` concerné pour les détails avant de modifier un domaine.

## Façon de travailler

- Répondre en français. Lire le code et les tests concernés avant de changer quoi que ce soit.
- Faire des modifications ciblées, respecter les usages existants et tester le comportement modifié.
- Vérifier l'état Git et préserver les modifications déjà présentes. Ne pas les annuler sans demande explicite.
- Ne pas masquer les erreurs. Indiquer clairement ce qui a été testé, ce qui reste à faire et si un déploiement est nécessaire.
- Pour une tâche longue, avancer par étapes. En cas d'interruption, vérifier les fichiers et l'état Git avant de reprendre.
- Ne pas exposer de secrets, modifier `.env`, toucher à la base de production, déployer ou effectuer une opération destructive sans demande explicite.

## Règles importantes

- Utiliser les fiches et fichiers de la médiathèque du Studio comme source des illustrations du jeu, pas les images présentes dans le dépôt. Respecter l'accès privé aux illustrations.
- Ne pas servir la racine du dépôt avec un serveur de fichiers générique : utiliser le routeur `scripts/serve-game.php`.
- Le Studio distingue brouillons et épisodes publiés. Préserver les données existantes et les sauvegardes des joueurs lors des changements et migrations.
- Les fichiers médias sont stockés séparément de la base, sur le disque `studio`. Préserver le volume Railway et les anciens fichiers lors des modifications.
- Dans le Dressing, les yeux sont des couleurs d'iris affichées derrière la peau, qui porte les pupilles et les cils ; conserver l'ordre des calques.

## Commandes utiles

Depuis la racine :

```sh
php -S 127.0.0.1:8080 scripts/serve-game.php
node --test tests/*.test.mjs
```

Depuis `backend/` :

```sh
composer studio
php artisan test
node --test tests/js/*.test.mjs
```

Préférer les tests ciblés au besoin. `composer studio` démarre le Studio local sur le port 8000 avec les limites d'import configurées ; pour relier le jeu local à l'API sur le port 8001, consulter les README. Ne pas écraser le `.env` existant.
