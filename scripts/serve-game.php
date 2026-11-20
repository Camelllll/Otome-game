<?php

// Routeur du serveur PHP local : seul le frontend est public, jamais les originaux des CG.
require __DIR__.'/public-game.php';

$root = dirname(__DIR__);
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$relative = ltrim($path === '/' ? '/index.html' : $path, '/');
$file = str_contains($relative, "\0") ? false : realpath($root.'/'.$relative);
if (! isPublicGameFile($relative) || ! $file || ! is_file($file) || ! str_starts_with($file, $root.DIRECTORY_SEPARATOR)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Ressource introuvable.';

    return;
}
$type = match (strtolower(pathinfo($file, PATHINFO_EXTENSION))) {
    'html' => 'text/html; charset=UTF-8',
    'js' => 'text/javascript; charset=UTF-8',
    'css' => 'text/css; charset=UTF-8',
    'json' => 'application/json; charset=UTF-8',
    'svg' => 'image/svg+xml',
    default => (new finfo(FILEINFO_MIME_TYPE))->file($file),
};
header('Content-Type: '.$type);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-cache');
readfile($file);
