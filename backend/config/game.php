<?php

return [
    // Règles de jeu appliquées par le serveur (portées depuis les fonctions SQL game_* de Supabase).
    'rules' => [
        'gaugeMin' => -100,
        'gaugeMax' => 100,
        'gaugeMaxDelta' => 50, // progression maximale d'une jauge en une seule sauvegarde
        'paEnabled' => false, // Désactivés pendant la démo, comme PA_ACTIFS côté jeu.
        'paMax' => 25,
        'paRegenSeconds' => 300,
        'currencyMax' => 1000000,
        'maxHistory' => 2000,
        'maxChoices' => 500,
        'maxFlags' => 500,
        'maxInventory' => 200,
        'maxCharacters' => 200,
        'maxCompletedEpisodes' => 200,
    ],

    // Boutique (ancien data/shop.json et table shop_items).
    'shop' => [
        'currency' => ['name' => 'Gemmes', 'id' => 'gemmes'],
        'items' => [
            [
                'id' => 'haut_pull_rose',
                'name' => 'Pull rose pastel',
                'slot' => 'haut',
                'price' => 50,
                'sprite' => 'assets/Personnages/Perso principal.png',
            ],
            [
                'id' => 'bas_jean_clair',
                'name' => 'Jean clair',
                'slot' => 'bas',
                'price' => 40,
                'sprite' => 'assets/Personnages/Perso principal.png',
            ],
            [
                'id' => 'coiffure_couette',
                'name' => 'Couettes',
                'slot' => 'coiffure',
                'price' => 30,
                'sprite' => 'assets/Personnages/Perso principal.png',
            ],
        ],
    ],
];