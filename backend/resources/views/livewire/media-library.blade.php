<div>
    <header class="page-header"><div><div class="eyebrow">LE STUDIO / MÉDIATHÈQUE</div><h1>Le décor de tes histoires.</h1><p class="muted">Tes lieux, illustrations et musiques, prêts à sélectionner dans les épisodes. Les images des personnages se gèrent dans la page Personnages.</p></div><span class="pill">STOCKAGE LOCAL</span></header>
    <nav class="media-tabs" aria-label="Catégories de médias">
        @foreach($categories as $key => $name)
            <button class="button {{ $category === $key ? 'primary' : '' }}" wire:click="chooseCategory('{{ $key }}')">{{ $name }} <span class="tab-count">{{ $counts[$key] ?? 0 }}</span></button>
        @endforeach
    </nav>
    @if($message)<p class="notice" role="status">{{ $message }}</p>@endif
    @if($errors->any())<div class="error-box" role="alert">@foreach($errors->all() as $error)<p>{{ $error }}</p>@endforeach</div>@endif
    @if($category === 'illustrations')
        <section class="carnet-bar" aria-label="Carnet de relations">
            <div>
                <strong>Carnet de relations</strong>
                <p class="muted">Indique quels personnages apparaissent sur une illustration et à quel moment le joueur la découvre.</p>
            </div>
            <div class="actions">
                <button type="button" class="button primary" wire:click="openCarnet">Ajouter les informations d'une illustration</button>
                @if($showCarnet)<button type="button" class="text-button" wire:click="closeCarnet">Retour aux images</button>@endif
            </div>
        </section>
    @endif
    @if($category === 'illustrations' && $showCarnet)
        <livewire:illustrations :asset-id="$carnetAssetId" :key="'carnet-'.$carnetNonce" />
    @else
    <div class="library-layout">
        <section>
            <div class="library-filters"><input type="search" aria-label="Rechercher un média" placeholder="Rechercher un nom ou une description…" wire:model.live.debounce.300ms="search"><label class="check"><input type="checkbox" wire:model.live="showArchived"> Archives</label></div>
            <div class="media-grid">
                @forelse($assets as $asset)
                    <article class="media-card" wire:key="media-{{ $asset->id }}-{{ md5($asset->file_path) }}">
                        <div class="media-preview">
                            @if($asset->category === 'music')
                                <div class="audio-art" aria-hidden="true">♫</div>
                                <audio controls preload="none" src="{{ $asset->url() }}" aria-label="{{ $asset->label }}"></audio>
                            @else
                                <img src="{{ $asset->url() }}" alt="{{ $asset->label }}" loading="lazy">
                            @endif
                        </div>
                        <div class="card-body"><span class="badge">{{ $categories[$asset->category] }} · {{ number_format($asset->size / 1024, 0, ',', ' ') }} Ko</span><h3>{{ $asset->label }}</h3><p class="muted media-description">{{ $asset->description ?: 'Aucune description' }}</p>
                            <div class="actions"><button class="button" wire:click="edit({{ $asset->id }})">Modifier</button>@if($asset->category === 'illustrations')<button class="button" wire:click="openCarnet({{ $asset->id }})">Infos du carnet</button>@endif<button class="text-button" wire:click="archive({{ $asset->id }})" wire:confirm="{{ $asset->is_archived ? 'Restaurer ce média ?' : 'Archiver ce média ? Les épisodes existants garderont leur lien.' }}">{{ $asset->is_archived ? 'Restaurer' : 'Archiver' }}</button></div>
                        </div>
                    </article>
                @empty
                    <div class="library-empty"><h2>{{ $search !== '' ? 'Aucun résultat' : ($showArchived ? 'Aucune archive' : 'La bibliothèque attend tes créations.') }}</h2><p class="muted">{{ $search !== '' ? 'Essaie un autre nom ou une autre description.' : 'Ajoute un premier fichier avec le formulaire à droite.' }}</p></div>
                @endforelse
            </div>
            <div class="pagination">{{ $assets->links() }}</div>
        </section>
        <aside class="library-form">
            <div class="eyebrow">{{ $editingId ? 'MODIFIER UN MÉDIA' : 'ENRICHIR LA BIBLIOTHÈQUE' }}</div><h2>{{ $editingId ? 'Un nouveau regard.' : 'Ajoute un média.' }}</h2>
            <p class="muted">{{ $categories[$category] ?? '' }}. Ces fichiers apparaissent dans les sélecteurs de l’éditeur.</p>
            <form wire:submit="save" class="stack">
                <label>Nom affiché<input wire:model="label" required maxlength="255" placeholder="{{ $category === 'backgrounds' ? 'Campus — cour de nuit' : 'Nom du média' }}"></label>
                <label>Description<textarea wire:model="description" rows="3" maxlength="3000" placeholder="Ambiance, lieu, personnages présents…"></textarea></label>
                <label>{{ $editingId ? 'Remplacer le fichier (facultatif)' : 'Fichier' }}<input type="file" wire:model="upload" accept="{{ $category === 'music' ? '.mp3,.wav,.ogg,.m4a' : '.jpg,.jpeg,.png,.webp,.gif' }}" @required(!$editingId)></label>
                <p class="muted">{{ $category === 'music' ? 'MP3, WAV, OGG ou M4A.' : 'JPG, PNG, WebP ou GIF. Pas de SVG.' }} Maximum : {{ $uploadLimitMb }} Mo par fichier. Limites PHP actuelles : {{ $phpUploadLimit }} par fichier, {{ $phpPostLimit }} par envoi. La limite la plus basse s'applique.</p>
                <span wire:loading wire:target="upload" class="badge">Envoi du fichier…</span>
                <button class="button primary" wire:loading.attr="disabled" wire:target="upload,save">{{ $editingId ? 'Enregistrer les modifications' : 'Ajouter à la bibliothèque' }}</button>
                @if($editingId)<button type="button" class="text-button" wire:click="cancel">Annuler la modification</button>@endif
            </form>
            <hr><p class="muted">Remplacer un fichier conserve son lien : les épisodes liés utilisent la nouvelle image. Les anciens fichiers restent sur disque par précaution. Archiver masque un média des menus sans casser les épisodes.</p>
            <p class="muted">Les médias importés du projet et les nouveaux fichiers se gèrent ici, sans code. Le nom affiché peut être changé sans renommer le fichier d'origine.</p>
        </aside>
    </div>
    @endif
</div>
