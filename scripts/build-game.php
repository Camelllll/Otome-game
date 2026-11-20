<?php

require __DIR__.'/public-game.php';

$root = dirname(__DIR__);
$output = $argv[1] ?? '';

if ($output === '' || !mkdir($output, 0755, true)) {
    fwrite(STDERR, "Indiquer un dossier de sortie inexistant.\n");
    exit(1);
}

$files = ['index.html', 'style.css', 'carnet.css'];
foreach (['src', 'styles', 'assets'] as $directory) {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'/'.$directory, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        $relative = substr($file->getPathname(), strlen($root) + 1);
        if ($file->isFile() && !$file->isLink() && isPublicGameFile($relative)) {
            $files[] = $relative;
        }
    }
}

foreach ($files as $relative) {
    $destination = $output.'/'.$relative;
    $directory = dirname($destination);
    if ((!is_dir($directory) && !mkdir($directory, 0755, true)) || !copy($root.'/'.$relative, $destination)) {
        fwrite(STDERR, "Impossible de copier $relative.\n");
        exit(1);
    }
}
