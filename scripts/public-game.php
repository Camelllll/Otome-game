<?php

function isPublicGameFile(string $relative): bool
{
    return in_array($relative, ['index.html', 'style.css', 'carnet.css'], true)
        || preg_match('#^src/[A-Za-z0-9_/-]+\.js$#D', $relative)
        || preg_match('#^styles/[A-Za-z0-9_-]+\.css$#D', $relative)
        || preg_match('#^assets/(?:logo|Personnages|Décors|media/characters|media/backgrounds)/.+\.(?:png|jpe?g|webp|gif|svg)$#iuD', $relative)
        || in_array($relative, [
            'assets/Illustrations/accueil-campus.png',
            'assets/Illustrations/vignette-episode-1.png',
            'assets/Illustrations/vignette-episode-2.png',
        ], true);
}
