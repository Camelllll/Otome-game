<?php

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    // Origines autorisées à appeler l'API depuis le navigateur (le front statique, ex. python3 -m http.server 8080).
    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:8080,http://127.0.0.1:8080,http://localhost:8001,http://127.0.0.1:8001'))
    ))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 600,
    // Authentification par jeton Bearer : pas de cookies.
    'supports_credentials' => false,
];