<div>
    <header class="page-header"><div><div class="eyebrow">LE STUDIO / BIBLIOTHÈQUE</div><h1>Tes histoires prennent vie.</h1><p class="muted">Écris, explore et prépare le prochain chapitre.</p></div><span class="pill">ENVIRONNEMENT LOCAL</span></header>
    <section class="summary-grid">
        <div class="summary"><strong>{{ $episodes->count() }}</strong><span>épisodes dans le studio</span></div>
        <div class="summary"><strong>{{ $episodes->whereNotNull('published_version_id')->count() }}</strong><span>versions publiées ici</span></div>
        <div class="summary accent"><strong>Un espace à toi.</strong><span>Les modifications ne touchent pas au jeu actuel.</span></div>
    </section>
    <div class="section-heading"><h2>Bibliothèque d'épisodes</h2><span class="muted">Brouillons et publications séparés</span></div>
    <div class="episode-grid">
        @foreach($episodes as $episode)
            <a class="episode-card" href="{{ route('studio.edit', $episode) }}" wire:key="episode-{{ $episode->id }}">
                <div class="card-art"><span>{{ str_pad($loop->iteration, 2, '0', STR_PAD_LEFT) }}</span><div class="card-orbit"></div></div>
                <div class="card-body"><span class="badge">{{ $episode->published_version_id ? 'Publié' : 'Brouillon' }}</span><h3>{{ $episode->title }}</h3><p class="muted">{{ $episode->slug }} · {{ $episode->versions_count }} version(s)</p><div class="card-footer">Ouvrir l'atelier <span>↗</span></div></div>
            </a>
        @endforeach
    </div>
    <section class="create-panel">
        <div><div class="eyebrow">LA SUITE T'APPARTIENT</div><h2>Un nouveau chapitre ?</h2><p class="muted">L'identifiant reste stable pour préserver les liens du jeu.</p></div>
        <form wire:submit="create" class="create-form">
            <label>Titre<input wire:model="title" placeholder="Épisode 7 — Une rencontre inattendue" required maxlength="255"></label>
            <label>Identifiant<input wire:model="slug" placeholder="episode7" pattern="[a-zA-Z0-9_-]+" required maxlength="100"></label>
            <button class="button primary" wire:loading.attr="disabled">Créer l'épisode</button>
            @foreach($errors->all() as $error)<p class="error">{{ $error }}</p>@endforeach
        </form>
    </section>
</div>
