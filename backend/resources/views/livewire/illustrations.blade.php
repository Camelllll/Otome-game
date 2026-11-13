<div class="ill-page">
    @if($message)<p class="notice" role="status">{{ $message }}</p>@endif
    @if($errors->any())<div class="error-box" role="alert">@foreach($errors->all() as $error)<p>{{ $error }}</p>@endforeach</div>@endif

    @if($formOpen)
        @php
            $selectedAsset = $mediaAssetId !== '' ? collect($assets)->firstWhere('id', (int) $mediaAssetId) : null;
        @endphp
        <form class="ill-form" wire:submit="save" aria-label="Formulaire d'illustration">
            <div class="ill-form-head">
                <div class="eyebrow">{{ $editingId ? 'MODIFIER UNE FICHE' : 'NOUVELLE FICHE' }}</div>
                <h2>{{ $editingId ? 'Modifier les informations de l\'illustration' : 'Ajouter les informations d\'une illustration' }}</h2>
                <p class="muted">Une illustration apparaît dans le carnet d'un joueur seulement après qu'il l'a vue dans le jeu. Elle rejoint les souvenirs de tous les personnages cochés.</p>
            </div>

            <div class="ill-form-grid">
                <section class="ill-panel" aria-labelledby="ill-step-image">
                    <h3 class="ill-panel-title" id="ill-step-image"><span class="ill-step" aria-hidden="true">1</span> Image</h3>

                    <div class="ill-stage">
                        @if($upload && $upload->isPreviewable())
                            <img src="{{ $upload->temporaryUrl() }}" alt="Aperçu de l'image importée">
                        @elseif($selectedAsset)
                            <img src="{{ $selectedAsset->url() }}" alt="{{ $selectedAsset->label }}">
                        @else
                            <p class="ill-stage-empty">Aucune image choisie.<br>Importe-en une ou sélectionne-en une ci-dessous.</p>
                        @endif
                    </div>

                    <label class="ill-upload">Importer une nouvelle image
                        <input type="file" wire:model="upload" accept="image/jpeg,image/png,image/webp,image/gif">
                    </label>
                    <div wire:loading wire:target="upload" class="muted">Import en cours…</div>

                    <div>
                        <p class="muted">Ou choisis une image déjà présente dans la médiathèque (maximum {{ $uploadLimitMb }} Mo à l'import) :</p>
                        <div class="ill-picker" role="radiogroup" aria-label="Images de la médiathèque">
                            @forelse($assets as $asset)
                                <label class="ill-pick {{ (string) $asset->id === $mediaAssetId ? 'ill-pick-on' : '' }}" wire:key="asset-{{ $asset->id }}" title="{{ $asset->label }}">
                                    <input type="radio" class="sr-only" name="mediaAssetId" value="{{ $asset->id }}" wire:model.live="mediaAssetId">
                                    <img src="{{ $asset->url() }}" alt="{{ $asset->label }}" loading="lazy">
                                </label>
                            @empty
                                <p class="muted">Aucune image dans la catégorie « Illustrations » de la médiathèque.</p>
                            @endforelse
                        </div>
                    </div>
                </section>

                <section class="ill-panel" aria-labelledby="ill-step-infos">
                    <h3 class="ill-panel-title" id="ill-step-infos"><span class="ill-step" aria-hidden="true">2</span> Informations</h3>

                    <label>Titre
                        <input type="text" wire:model="title" maxlength="160" placeholder="Une rencontre inattendue">
                    </label>

                    <fieldset class="ill-fieldset">
                        <legend>Personnages concernés</legend>
                        <p class="muted">Coche tous les personnages visibles ou liés à cette image.</p>
                        <div class="ill-checks">
                            @forelse($characters as $id => $name)
                                <label class="ill-check" wire:key="char-{{ $id }}">
                                    <input type="checkbox" wire:model="characterIds" value="{{ $id }}">
                                    <span>{{ $name }}</span>
                                </label>
                            @empty
                                <p class="muted">Aucun personnage disponible pour l'instant.</p>
                            @endforelse
                        </div>
                    </fieldset>

                    <fieldset class="ill-fieldset">
                        <legend>Moment de déverrouillage</legend>
                        <div class="ill-moment">
                            <label>Épisode
                                <select wire:model.live="episodeId">
                                    <option value="">— Choisir un épisode —</option>
                                    @foreach($episodes as $slug => $episodeTitle)
                                        <option value="{{ $slug }}">{{ $episodeTitle }}</option>
                                    @endforeach
                                </select>
                            </label>
                            <label>Dialogue ou scène qui l'affiche
                                <select wire:model="unlockNodeId" @disabled($episodeId === '')>
                                    <option value="">{{ $episodeId === '' ? 'Choisis d\'abord un épisode' : '— Choisir un moment —' }}</option>
                                    @foreach($nodes as $nodeId => $label)
                                        <option value="{{ $nodeId }}">{{ $label }}</option>
                                    @endforeach
                                </select>
                            </label>
                        </div>
                        <p class="muted">Les moments marqués ★ affichent déjà une illustration dans l'épisode.</p>
                    </fieldset>

                    <label>Niveau de révélation
                        <select wire:model="spoilerLevel">
                            <option value="1">1 · Discret</option>
                            <option value="2">2 · Important</option>
                            <option value="3">3 · Grand secret</option>
                        </select>
                    </label>

                    <label>Rareté
                        <p class="muted" style="margin:0 0 0.35rem">Détermine le badge et les effets visuels dans le jeu. « Commun » = aucun badge affiché.</p>
                        <select wire:model="rarity">
                            <option value="common">Commun (par défaut)</option>
                            <option value="rare">Rare</option>
                            <option value="ultra_rare">Ultra Rare</option>
                            <option value="legendary">Légendaire</option>
                        </select>
                    </label>
                </section>
            </div>

            <div class="ill-form-footer">
                <button type="button" class="button" wire:click="cancel">Annuler</button>
                <button type="submit" class="button primary" wire:loading.attr="disabled" wire:target="save,upload">Enregistrer</button>
            </div>
        </form>
    @else
        <div class="ill-toolbar">
            <div>
                <h2>Fiches des illustrations</h2>
                <p class="muted">Chaque fiche relie une image à des personnages et à un moment de l'histoire.</p>
            </div>
            <button type="button" class="button primary" wire:click="create">Ajouter une illustration</button>
        </div>

        <section aria-label="Liste des illustrations">
            <div class="ill-list">
                @forelse($illustrations as $illustration)
                    <article class="ill-card" wire:key="ill-{{ $illustration->id }}">
                        <div class="ill-thumb">
                            @if($illustration->mediaAsset && ! $illustration->mediaAsset->is_archived)
                                <img src="{{ $illustration->mediaAsset->url() }}" alt="{{ $illustration->title }}" loading="lazy">
                            @else
                                <span class="ill-thumb-empty">Image absente</span>
                            @endif
                        </div>
                        <div class="ill-body">
                            <h3>{{ $illustration->title }}</h3>
                            <p class="muted">
                                {{ $illustration->episode_id ? ($episodes[$illustration->episode_id] ?? $illustration->episode_id) : 'Aucun épisode choisi' }}
                                @if($illustration->unlock_node_id) · moment « {{ $illustration->unlock_node_id }} »@endif
                            </p>
                            <div class="ill-chips">
                                @foreach(($illustration->character_ids ?? []) as $characterId)
                                    <span class="ill-chip">{{ $characters[$characterId] ?? $characterId }}</span>
                                @endforeach
                                @if(($illustration->rarity ?? 'common') !== 'common')
                                    <span class="ill-chip ill-chip--rarete ill-chip--{{ $illustration->rarity }}">
                                        {{ match($illustration->rarity) {
                                            'rare'       => '★ Rare',
                                            'ultra_rare' => '★★ Ultra Rare',
                                            'legendary'  => '✦ Légendaire',
                                            default      => $illustration->rarity,
                                        } }}
                                    </span>
                                @endif
                            </div>
                            <div class="actions">
                                <button type="button" class="button" wire:click="edit({{ $illustration->id }})">Modifier</button>
                                <button type="button" class="text-button" wire:click="delete({{ $illustration->id }})" wire:confirm="Supprimer cette illustration ? L'image reste dans la médiathèque.">Supprimer</button>
                            </div>
                        </div>
                    </article>
                @empty
                    <div class="library-empty">
                        <h2>Aucune illustration pour l'instant</h2>
                        <p class="muted">Clique sur « Ajouter une illustration » pour commencer.</p>
                    </div>
                @endforelse
            </div>
        </section>
    @endif
</div>