<div>
    <header class="page-header">
        <div>
            <div class="eyebrow">LE STUDIO / DRESSING</div>
            <h1>Les éléments du dressing.</h1>
            <p class="muted">Ajoute les images de l’apparence de Pommette et choisis si elles sont gratuites ou vendues en gemmes.</p>
        </div>
        <span class="pill">PNG TRANSPARENT · {{ \App\Models\MediaAsset::WARDROBE_IMAGE_WIDTH }} × {{ \App\Models\MediaAsset::WARDROBE_IMAGE_HEIGHT }}</span>
    </header>

    @if($message)<p class="notice" role="status">{{ $message }}</p>@endif
    @if($errors->any())<div class="error-box" role="alert">@foreach($errors->all() as $error)<p>{{ $error }}</p>@endforeach</div>@endif

    <div class="library-filters">
        <label class="check"><input type="checkbox" wire:model.live="showArchived"> Articles archivés</label>
    </div>
    <div class="wardrobe-layout">
        <section class="wardrobe-grid" aria-label="Articles du dressing">
            @forelse($items as $item)
                <article class="wardrobe-card" wire:key="wardrobe-{{ $item->id }}">
                    <div class="wardrobe-preview"><img src="{{ $item->url() }}" alt="{{ $item->label }}" loading="lazy"></div>
                    <div class="card-body">
                        <span class="badge">{{ \App\Livewire\WardrobeLibrary::APPEARANCE_CATEGORIES[$item->appearance_category ?? $item->wardrobe_slot] }} · {{ $item->price === null ? 'Gratuit' : number_format($item->price, 0, ',', ' ').' gemmes' }}</span>
                        <h3>{{ $item->label }}</h3>
                        <div class="actions">
                            <button class="button" wire:click="edit({{ $item->id }})">Modifier</button>
                            <button class="text-button" wire:click="archive({{ $item->id }})" wire:confirm="{{ $item->is_archived ? 'Restaurer cet article dans le jeu ?' : 'Archiver cet article ?' }}">{{ $item->is_archived ? 'Restaurer' : 'Archiver' }}</button>
                        </div>
                    </div>
                </article>
            @empty
                <div class="library-empty">
                    <h2>{{ $showArchived ? 'Aucun article archivé' : 'Le dressing attend ses premiers éléments.' }}</h2>
                    <p class="muted">Ajoute un élément avec le formulaire à droite.</p>
                </div>
            @endforelse
            <div class="pagination">{{ $items->links() }}</div>
        </section>

        <aside class="library-form">
            <div class="eyebrow">{{ $editingId ? 'MODIFIER UN ARTICLE' : 'NOUVEL ARTICLE' }}</div>
            <h2>{{ $editingId ? 'Modifier l’article.' : 'Ajouter au dressing.' }}</h2>
            <form wire:submit="save" class="stack">
                <label>Nom affiché<input wire:model="label" required maxlength="255" placeholder="Ex. Yeux bleu clair"></label>
                <label>Catégorie
                    <select wire:model="appearanceCategory" required @disabled($editingId)>
                        @foreach(\App\Livewire\WardrobeLibrary::APPEARANCE_CATEGORIES as $key => $name)
                            <option value="{{ $key }}">{{ $name }}</option>
                        @endforeach
                    </select>
                </label>
                <label>Prix en gemmes (facultatif)<input type="number" wire:model="price" min="0" max="1000000" step="1" placeholder="Vide = gratuit"></label>
                <label>{{ $editingId ? 'Remplacer l’image (facultatif)' : 'Image de l’élément' }}<input type="file" wire:model="upload" accept=".png" @required(!$editingId)></label>
                <p class="muted">PNG transparent, exactement {{ \App\Models\MediaAsset::WARDROBE_IMAGE_WIDTH }} × {{ \App\Models\MediaAsset::WARDROBE_IMAGE_HEIGHT }} pixels. Le jeu le redimensionne sur son repère 600 × 1200. Un élément gratuit est disponible dès le début ; un prix le place dans la boutique.</p>
                <span wire:loading wire:target="upload" class="badge">Envoi de l’image…</span>
                <button class="button primary" wire:loading.attr="disabled" wire:target="upload,save">{{ $editingId ? 'Enregistrer' : 'Ajouter au dressing' }}</button>
                @if($editingId)<button type="button" class="text-button" wire:click="cancel">Annuler la modification</button>@endif
            </form>
        </aside>
    </div>
</div>
