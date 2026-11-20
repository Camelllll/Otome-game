<?php

return [
    'demo' => env('GAME_DEMO', false),

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

    // Monnaie historique de la boutique ; ses articles viennent du dressing en base.
    'shop' => [
        'currency' => ['name' => 'Gemmes', 'id' => 'gemmes'],
    ],
];
