<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? "Pomme d'Amour — Studio" }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body>
    <div class="studio-shell">
        <aside class="sidebar">
            <a class="brand" href="{{ route('studio.index') }}"><span class="brand-mark">P</span><span>Pomme d'Amour<small>STUDIO NARRATIF</small></span></a>
            <div class="nav-label">ESPACE DE CRÉATION</div>
            <a class="nav-link {{ request()->routeIs('studio.index', 'studio.edit', 'studio.preview') ? 'nav-active' : '' }}" href="{{ route('studio.index') }}">Épisodes <span>↗</span></a>
            <a class="nav-link {{ request()->routeIs('studio.characters') ? 'nav-active' : '' }}" href="{{ route('studio.characters') }}">Personnages <span>↗</span></a>
            <a class="nav-link {{ request()->routeIs('studio.media*') ? 'nav-active' : '' }}" href="{{ route('studio.media') }}">Médiathèque <span>↗</span></a>
            <div class="sidebar-note">Ton prochain chapitre<br>commence ici.<p>Studio local · MariaDB<br>Le jeu existant reste indépendant.</p></div>
            @auth
                <div class="account">{{ auth()->user()->name }}<small>Administrateur</small>
                    <form action="{{ route('logout') }}" method="post">@csrf<button class="text-button">Se déconnecter</button></form>
                </div>
            @endauth
        </aside>
        <main class="workspace">{{ $slot }}</main>
    </div>
    @livewireScripts
</body>
</html>
