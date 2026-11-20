# Pomme d'Amour — studio local

Back-office Laravel 12, Livewire 3 et Tailwind 4, avec une base MariaDB. Le jeu à la racine récupère notamment son catalogue d'apparence depuis l'API du studio.

## Démarrage local

Prérequis : PHP 8.4.1 ou supérieur (dans la série 8.x) avec PDO MySQL, Composer, Node.js et MariaDB.

```sh
cd backend
composer install
npm ci
cp .env.example .env
php artisan key:generate
```

Créer une base `otome_studio_local` et un utilisateur dédié dans MariaDB, puis renseigner son mot de passe dans `.env`. Ne jamais versionner ce fichier.

```sh
php artisan migrate
php artisan studio:admin admin@otome.local
npm run build
composer studio
```

Lors du premier paramétrage sur ce Mac, les dépendances, la base et le fichier `.env` sont déjà préparés. Ne pas écraser ce dernier avec `.env.example`.

## Import des épisodes

```sh
php artisan studio:import /chemin/vers/episodes.json
```

Le fichier attendu est le tableau exporté de Supabase : lignes avec `id`, `title` et `data`. L'import est transactionnel, refuse les identifiants existants et conserve les propriétés narratives, y compris les objets JSON vides. Les épisodes arrivent en **brouillons**, même si l'export les marque publiés. Les variantes `episodes_duplicate` ne sont pas importées automatiquement.

## Fonctionnement du studio

### Parcours de création et d'édition

L'écran d'épisode reprend les cartes et actions de l'ancien back-office, adaptées à l'API Laravel : sélection/création d'épisode, titre, ajout de scènes avec décor, dialogues et choix, personnages à l'écran (trois maximum), musique, illustration, position de bulle, scission de scène, suppression, réponses et effets multiples amour/amitié, destinations, fin et épisode suivant.

Les imports JSON (épisode ou espace de travail) et Word `.docx`, ainsi que les exports épisode/espace de travail sont disponibles dans la barre d'outils. L'import JSON met à jour les épisodes existants dans de nouvelles versions ; l'import Word remplace le contenu de l'épisode sélectionné après confirmation. Le parseur Word est repris de l'ancien studio et Mammoth est installé localement, sans dépendance à un CDN.

Les modifications sont enregistrées automatiquement après un court délai, en brouillon uniquement. L'état et les erreurs sont affichés ; « Enregistrer maintenant » force la synchronisation. Une erreur de synchronisation bloque les envois suivants : exporter le travail puis recharger avant de reprendre, pour éviter les écrasements. La navigation interne conserve les modifications en attente par épisode.

Les scènes et leurs titres sont maintenant persistés dans le document JSON et dans les exports. Une ouverture d'épisode ne crée pas de version et ne normalise pas automatiquement la présence des personnages. L'inférence d'anciennes scènes tient compte du décor hérité. Les aiguillages automatiques restent en lecture seule dans ce parcours, comme dans l'ancien studio.

La publication/dépublication est explicite et reste protégée par les validations et contrôles de concurrence de MariaDB. Le vestiaire et la gestion des fiches personnages ne font pas partie de cette reprise du parcours d'édition d'épisodes. La médiathèque conserve son écran dédié.

Tests du parcours JavaScript et de l'import Word : `node --test tests/js/*.test.mjs`.

- Accès administrateur uniquement, contrôlé sur les routes et les actions Livewire restantes.
- Création d'épisodes, scènes, dialogues et choix dans le parcours décrit ci-dessus.
- Une nouvelle version à chaque synchronisation modifiée.
- Détection des modifications concurrentes pour éviter les écrasements.
- Publication séparée du brouillon, avec contrôle du départ et des liens.
- Export JSON de l'épisode ou de l'espace de travail, incluant les modifications encore en mémoire.
- Aperçu **textuel exploratoire**, sans calcul des jauges, simulation des conditions, images ou sauvegarde joueur. Les routes d'une branche se sélectionnent manuellement.

Attendre l'indication de sauvegarde avant de quitter. L'aperçu attend la fin de la synchronisation ; les exports restent disponibles même en cas d'erreur pour récupérer le travail.

La publication rend l'épisode disponible via l'API publique (`/api/episodes`).

### Médiathèque

L'onglet **Médiathèque** regroupe les décors (thèmes de scène), illustrations, musiques et portraits/sprites. Il permet l'ajout de fichiers, la recherche par nom ou description, l'aperçu image/audio, la modification, le remplacement et l'archivage/restauration.

- Images : JPG, PNG, WebP, GIF ; audio : MP3, WAV, OGG, M4A. Maximum : **100 Mo par fichier** (102 400 Ko), partagé par l'application et les envois temporaires Livewire.
- Utiliser `composer studio` (ou `composer dev`) pour démarrer en local : PHP est configuré pour ce processus avec `upload_max_filesize=100M`, `post_max_size=110M`, `memory_limit=512M` et des délais de 600 secondes. Le PHP global du Mac n'est pas modifié. `php artisan serve` seul conserve les limites du PHP système.
- En production, configurer également les limites du serveur HTTP et de PHP pour autoriser un fichier de 100 Mo avec sa surcharge multipart. La médiathèque affiche les limites PHP réellement actives.
- Stockage dans `storage/app/studio-media`, sur le disque Laravel `studio`. Sauvegarder ce dossier **avec** la base MariaDB. Aucun lien symbolique public n'est nécessaire.
- Les fichiers de la médiathèque restent servis par une route administrateur ; les éléments actifs du Dressing disposent aussi d'une route API publique pour le jeu.
- Les URL restent stables lors d'un remplacement. Cela modifie le rendu de tous les épisodes référençant ce média, y compris les versions publiées ; les documents narratifs ne sont pas modifiés.
- Les anciens fichiers remplacés sont conservés et leurs chemins sont enregistrés dans `previous_files`, pour éviter une suppression irréversible. Ils ne sont pas accessibles par l'interface.
- Archiver masque le média des nouveaux choix, sans supprimer le fichier ni invalider les références existantes.
- Les décors, musiques et illustrations actifs sont sélectionnables dans l'édition guidée. Les personnages proposés proviennent du catalogue commun en base, pour tous les épisodes, plus l'héroïne, la narration et les éventuels locuteurs historiques hors catalogue. Les personnages portant le même nom sont distingués par leur identifiant. La catégorie portraits ne crée pas de fiche personnage.
- Le décor se choisit au niveau de la scène ; musique, illustration et personnages présents se règlent dans les cartes de dialogue.
- Aucun import automatique des médias Supabase : les fichiers sont ajoutés manuellement.

### Dressing

L'onglet **Dressing** permet d'ajouter les catégories Peau, Cheveux, Yeux, Sourcils, Bouche, Hauts, Bas, Chaussures, Tenue complète et Accessoires. Chaque article comprend un nom et un PNG transparent de 3000 × 6000 pixels, aligné sur le sprite de Pommette ; le jeu l'affiche sur son repère 600 × 1200. Un prix vide rend l'article gratuit ; un prix renseigné l'ajoute à la boutique. Le premier article gratuit de chaque catégorie principale devient automatiquement le choix de départ. Le catalogue complet est diffusé par `/api/appearance/catalogue` ; l'archivage retire un article sans supprimer le fichier.

### Reprise des fichiers du projet

```sh
php artisan studio:import-media ../assets --link-episodes
```

Cette commande copie les images de `Décors`, `Illustrations`, `Personnages` et les fichiers audio d'un éventuel dossier `Musiques` vers le stockage du studio. Les documents et le logo restent hors bibliothèque. Elle utilise les types MIME réels, conserve les originaux et ne réimporte pas les mêmes chemins lors d'une relance ; les remplacements manuels ne sont pas écrasés.

L'option `--link-episodes` remplace les chemins `assets/...` correspondants dans de **nouvelles versions brouillons**. Les textes, liens narratifs, anciennes versions et publications ne sont pas modifiés. Les références locales manquantes sont signalées. Les URL Supabase ne sont pas rapprochées approximativement par nom.

Ensuite, la rédactrice utilise uniquement la médiathèque : ajouter un fichier, changer son nom/description, le remplacer ou l'archiver. Aucun accès aux fichiers du projet n'est nécessaire. Les portraits sont des médias ; la création/édition des fiches personnages reste distincte.

### Catalogue des personnages

`php artisan studio:import-characters /chemin/characters.json` importe un tableau de lignes avec `id`, `is_player`, `is_secondary` et `data` (fiche originale complète). Les fiches existantes ne sont jamais écrasées et une relance ne crée pas de doublon. L'import initial utilise les 20 fiches de la sauvegarde SQL, plus complète que le JSON historique local. Les épisodes ne sont pas modifiés par cet import. L'administration visuelle des fiches reste une étape distincte.

Les épisodes importés peuvent contenir des liens invalides hérités de la sauvegarde. Ils restent éditables, mais ces liens doivent être corrigés avant publication.

## Vérifications locales

```sh
php artisan test --compact
vendor/bin/pint --test
npm run build
```

Les tests utilisent SQLite en mémoire et ne modifient pas la base MariaDB locale. Le contrôle d'import réel vérifie séparément les documents dans MariaDB.

---

## Documentation Laravel

<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework. You can also check out [Laravel Learn](https://laravel.com/learn), where you will be guided through building a modern Laravel application.

If you don't feel like reading, [Laracasts](https://laracasts.com) can help. Laracasts contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

## Laravel Sponsors

We would like to extend our thanks to the following sponsors for funding Laravel development. If you are interested in becoming a sponsor, please visit the [Laravel Partners program](https://partners.laravel.com).

### Premium Partners

- **[Vehikl](https://vehikl.com)**
- **[Tighten Co.](https://tighten.co)**
- **[Kirschbaum Development Group](https://kirschbaumdevelopment.com)**
- **[64 Robots](https://64robots.com)**
- **[Curotec](https://www.curotec.com/services/technologies/laravel)**
- **[DevSquad](https://devsquad.com/hire-laravel-developers)**
- **[Redberry](https://redberry.international/laravel-development)**
- **[Active Logic](https://activelogic.com)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
