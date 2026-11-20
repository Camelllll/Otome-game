<div>
    <header class="page-header"><div><div class="eyebrow">LE STUDIO / BIBLIOTHÈQUE</div><h1>Tes histoires prennent vie.</h1><p class="muted">Écris, explore et prépare le prochain chapitre.</p></div><span class="pill">ENVIRONNEMENT LOCAL</span></header>
    <section class="summary-grid">
        <div class="summary"><strong>{{ $episodes->count() }}</strong><span>épisodes dans le studio</span></div>
        <div class="summary"><strong>{{ $episodes->whereNotNull('published_version_id')->count() }}</strong><span>versions publiées ici</span></div>
        <div class="summary accent"><strong>Un espace à toi.</strong><span>Le titre, la description et la vignette des épisodes publiés sont visibles dans le jeu.</span></div>
    </section>
    <div class="section-heading"><h2>Bibliothèque d'épisodes</h2><span class="muted">Brouillons et publications séparés</span></div>
    @if($message)<p class="notice" role="status">{{ $message }}</p>@endif
    @if($errors->any())<div class="error-box" role="alert">@foreach($errors->all() as $error)<p>{{ $error }}</p>@endforeach</div>@endif
    <div class="episode-grid">
        @foreach($episodes as $episode)
            <article class="episode-card" wire:key="episode-{{ $episode->id }}">
                <div class="card-art">
                    @if($episode->thumbnail_path)
                        <img src="{{ route('studio.episode-thumbnail', $episode) }}" alt="Vignette de {{ $episode->title }}">
                    @else
                        <span>{{ str_pad($loop->iteration, 2, '0', STR_PAD_LEFT) }}</span><div class="card-orbit"></div>
                    @endif
                </div>
                <div class="card-body">
                    <span class="badge">{{ $episode->published_version_id ? 'Publié' : 'Brouillon' }}</span>
                    <h3>{{ $episode->title }}</h3>
                    <p class="muted">{{ $episode->slug }} · {{ $episode->versions_count }} version(s)</p>
                    @if($episode->description)<p class="muted">{{ $episode->description }}</p>@endif
                    <div class="card-footer"><a href="{{ route('studio.edit', $episode) }}">Ouvrir l'atelier <span>↗</span></a><button type="button" class="text-button" wire:click="edit({{ $episode->id }})">Modifier les infos</button></div>
                </div>
                @if($editingId === $episode->id)
                    <form wire:submit="saveMetadata" class="episode-metadata-form">
                        <h4>Informations de l’épisode</h4>
                        <label>Titre<input wire:model="editTitle" required maxlength="255"></label>
                        <label>Description<textarea wire:model="editDescription" rows="3" maxlength="3000" placeholder="Présente cet épisode aux joueurs…"></textarea></label>
                        <label>Vignette<input type="file" wire:model="thumbnail" accept=".jpg,.jpeg,.png,.webp,.gif"></label>
                        @if($thumbnail)
                            <img class="episode-thumbnail-preview" src="{{ $thumbnail->temporaryUrl() }}" alt="Aperçu de la nouvelle vignette">
                        @elseif($episode->thumbnail_path)
                            <img class="episode-thumbnail-preview" src="{{ route('studio.episode-thumbnail', $episode) }}" alt="Vignette actuelle de {{ $episode->title }}">
                        @endif
                        <p class="muted">JPG, PNG, WebP ou GIF · 10 Mo maximum. Sans nouveau fichier, la vignette actuelle est conservée.</p>
                        <div class="actions"><button class="button primary" wire:loading.attr="disabled" wire:target="thumbnail,saveMetadata">Enregistrer</button><button type="button" class="text-button" wire:click="cancelEdit">Annuler</button></div>
                    </form>
                @endif
            </article>
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
