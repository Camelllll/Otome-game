<div class="pf">
<style>
/* ── Page Personnages : reprend la palette claire du studio (stone / rose) ─────────── */
.pf { display: grid; gap: 28px; }
.pf .page-header { margin-bottom: 0; }

/* Cartes de la grille */
.pf-group { display: grid; gap: 14px; }
.pf-group-title { display: flex; align-items: baseline; gap: 10px; margin: 0; }
.pf-group-title small { font-size: 12px; font-weight: 500; color: #a8a29e; }

.pf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 18px; }

.pf-card { display: flex; flex-direction: column; overflow: hidden; border: 1px solid #e7e5e4; border-radius: 18px; background: #fff; transition: transform .15s, box-shadow .15s, border-color .15s; }
.pf-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(120, 53, 15, .08); }
.pf-card-on { border-color: #9f1239; box-shadow: 0 0 0 2px #ffe4e6; }

.pf-art { position: relative; display: flex; align-items: flex-end; justify-content: center; aspect-ratio: 4 / 5; overflow: hidden; background: linear-gradient(160deg, #f4e9db, #e9d4cf); }
.pf-grid > .pf-card:nth-child(3n+2) .pf-art { background: linear-gradient(160deg, #ede8d7, #d8dfd7); }
.pf-grid > .pf-card:nth-child(3n) .pf-art { background: linear-gradient(160deg, #e9e4eb, #dcd7e7); }
.pf-art img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center bottom; }
.pf-initial { align-self: center; font-family: Georgia, serif; font-size: 64px; color: rgba(255, 255, 255, .9); }

.pf-body { display: grid; gap: 6px; padding: 14px 16px 6px; align-content: start; flex: 1; }
.pf-name { margin: 0; font-size: 17px; font-family: Georgia, serif; }
.pf-slug { font-size: 11px; color: #a8a29e; font-family: ui-monospace, monospace; }
.pf-tagline { margin: 0; font-size: 12px; line-height: 1.5; color: #78716c; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pf-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.pf-tag { padding: 2px 10px; border-radius: 999px; background: #f5f5f4; color: #57534e; font-size: 11px; font-weight: 600; }
.pf-tag-ok { background: #ecfdf5; color: #047857; }
.pf-tag-off { background: #fff7ed; color: #b45309; }
.pf-card-foot { padding: 12px 16px 16px; }
.pf-card-foot .button { width: 100%; }

.pf-empty { padding: 40px; border: 1px dashed #d6d3d1; border-radius: 18px; text-align: center; }

/* Éditeur */
.pf-editor { border: 1px solid #e7e5e4; border-radius: 20px; background: #fff; padding: 28px; display: grid; gap: 24px; }
.pf-editor-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px; }
.pf-editor-head h2 { margin: 6px 0 0; font-family: Georgia, serif; font-size: 24px; }
.pf-layout { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 32px; align-items: start; }
.pf-aside { position: sticky; top: 24px; display: grid; gap: 12px; }
.pf-stage { display: flex; align-items: flex-end; justify-content: center; aspect-ratio: 4 / 5; overflow: hidden; border: 1px dashed #d6d3d1; border-radius: 16px; background: linear-gradient(160deg, #f4e9db, #e9d4cf); }
.pf-stage img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center bottom; }
.pf-stage-empty { align-self: center; padding: 20px; margin: 0; font-size: 13px; line-height: 1.6; text-align: center; color: #78716c; }

.pf-main { display: grid; gap: 28px; min-width: 0; }
.pf-section { display: grid; gap: 16px; min-width: 0; }
.pf-section-title { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 16px; }
.pf-step { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 999px; background: #9f1239; color: #fff; font-size: 13px; font-weight: 700; }
.pf-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.pf-fields-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.pf-wide { grid-column: 1 / -1; }
.pf-req { color: #9f1239; }
.pf-hint { display: block; margin-top: 6px; font-size: 12px; font-weight: 400; color: #78716c; }

.pf-types { display: flex; flex-wrap: wrap; gap: 10px; }
.pf-type { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border: 1px solid #e7e5e4; border-radius: 12px; cursor: pointer; font-weight: 500; }
.pf-type:has(input:checked) { border-color: #9f1239; background: #fff1f2; color: #881337; }
.pf-type input { margin: 0; accent-color: #9f1239; }

.pf-mode { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.pf-mode-box { padding: 16px; border: 1px solid #e7e5e4; border-top-width: 4px; border-radius: 14px; }
.pf-mode-do { border-top-color: #10b981; background: #f6fdf9; }
.pf-mode-dont { border-top-color: #e11d48; background: #fff8f9; }
.pf-mode-box textarea { background: #fff; }

.pf-footer { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 12px; margin: 0 -28px -28px; padding: 16px 28px; border-top: 1px solid #e7e5e4; border-radius: 0 0 20px 20px; background: rgba(255, 255, 255, .95); }

/* Import et sélecteur « Mes fichiers » */
.pf-upload { display: grid; gap: 8px; }
.pf-upload input[type=file] { margin-top: 6px; padding: 8px; font-size: 12px; }
.pf-sub { display: block; font-size: 14px; }
.pf-files { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 10px; max-height: 300px; overflow-y: auto; padding: 4px; }
.pf-file { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; padding: 6px; border: 2px solid #e7e5e4; border-radius: 12px; background: #fff; color: #57534e; font-size: 11px; cursor: pointer; transition: border-color .15s; }
.pf-file:hover { border-color: #fda4af; }
.pf-file:focus-visible { outline: 2px solid #9f1239; outline-offset: 2px; }
.pf-file-on { border-color: #9f1239; background: #fff1f2; }
.pf-file img { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; object-position: center bottom; border-radius: 8px; background: #f5f5f4; }
.pf-file span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-advanced summary { cursor: pointer; font-size: 13px; color: #78716c; }

@media (max-width: 1000px) {
    .pf-layout { grid-template-columns: minmax(0, 1fr); }
    .pf-aside { position: static; max-width: 260px; }
}
@media (max-width: 640px) {
    .pf-editor { padding: 18px; }
    .pf-fields, .pf-fields-3, .pf-mode { grid-template-columns: minmax(0, 1fr); }
    .pf-footer { margin: 0 -18px -18px; padding: 14px 18px; }
    .pf-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
}
</style>

@php
    $hasMode = function ($perso) {
        $mode = $perso->data['carnet']['modeEmploi'] ?? [];
        return ! empty($mode['faire']) || ! empty($mode['eviter']);
    };
    $total       = $characters->count();
    $withMode    = $characters->filter($hasMode)->count();
    $withoutImg  = $characters->filter(fn ($p) => empty($spriteUrls[$p->id]))->count();
    $groups = [
        ['title' => 'Héroïne', 'items' => $characters->where('is_player', true)],
        ['title' => 'Personnages principaux', 'items' => $characters->where('is_player', false)->where('is_secondary', false)],
        ['title' => 'Personnages secondaires', 'items' => $characters->where('is_player', false)->where('is_secondary', true)],
    ];
    $editingPerso = $editingId ? $characters->firstWhere('id', $editingId) : null;
    $previewUrl   = $apercuUrl ?? null;
@endphp

    <header class="page-header">
        <div>
            <a class="eyebrow" href="{{ route('studio.index') }}">← BIBLIOTHÈQUE</a>
            <h1>Personnages</h1>
            <p class="muted">Tout ce qui concerne les personnages se gère ici : fiches, images et modes d'emploi.</p>
        </div>
        <button type="button" class="button primary" wire:click="nouveauPerso" x-on:click="window.scrollTo({ top: 0, behavior: 'smooth' })">+ Nouveau personnage</button>
    </header>

    @if($message)
        <p class="notice" role="status">{{ $message }}</p>
    @endif

    {{-- ── Éditeur (création / modification) ───────────────────────────────── --}}
    @if($panelOuvert)
    <section class="pf-editor" aria-labelledby="pf-editor-title">
        <div class="pf-editor-head">
            <div>
                <span class="eyebrow">{{ $editingId ? 'MODIFICATION' : 'NOUVEAU PERSONNAGE' }}</span>
                <h2 id="pf-editor-title">{{ $editingId ? ($editingPerso->name ?? 'Modifier le personnage') : 'Nouvelle fiche' }}</h2>
            </div>
            <button type="button" class="text-button" wire:click="annuler">Fermer sans enregistrer</button>
        </div>

        @if($errors->any())
            <div class="error-box" role="alert">{{ implode("\n", $errors->all()) }}</div>
        @endif

        <form wire:submit="sauvegarder" class="pf-layout">
            <aside class="pf-aside">
                <div class="pf-stage">
                    @if($previewUrl)
                        <img src="{{ $previewUrl }}" alt="Aperçu de {{ $editingPerso->name ?? 'ce personnage' }}">
                    @else
                        <p class="pf-stage-empty">Aucune image. Importe un fichier ci-dessous ou choisis-en un dans « Mes fichiers ».</p>
                    @endif
                </div>
                <div class="pf-upload">
                    <label>Importer une image
                        <input type="file" wire:model="spriteUpload" accept=".jpg,.jpeg,.png,.webp,.gif">
                    </label>
                    <span wire:loading wire:target="spriteUpload" class="badge">Envoi du fichier…</span>
                    @if($spriteUpload)
                        <p class="muted">Nouvelle image prête. Elle sera enregistrée avec la fiche.</p>
                        <button type="button" class="text-button" wire:click="$set('spriteUpload', null)">Annuler l'import</button>
                    @endif
                    @error('spriteUpload')<p class="pf-hint" style="color: #be123c;">{{ $message }}</p>@enderror
                    <p class="pf-hint">JPG, PNG, WebP ou GIF.</p>
                </div>
            </aside>

            <div class="pf-main">
                {{-- 1. Identité --}}
                <fieldset class="pf-section" style="border: 0; padding: 0; margin: 0;">
                    <h3 class="pf-section-title"><span class="pf-step">1</span> Identité</h3>
                    <div class="pf-fields">
                        <label>Nom affiché <span class="pf-req">*</span>
                            <input wire:model="name" placeholder="Liam" required maxlength="255">
                        </label>
                        <label>Identifiant (slug) <span class="pf-req">*</span>
                            <input wire:model="slug" placeholder="liam" pattern="[a-zA-Z0-9_-]+" required maxlength="100">
                            <span class="pf-hint">Lettres, chiffres, - ou _. Utilisé dans les scripts d'épisode.</span>
                        </label>
                    </div>
                    <div class="pf-types">
                        <label class="pf-type">
                            <input type="checkbox" wire:model="isPlayer"> Personnage joueur
                        </label>
                        <label class="pf-type">
                            <input type="checkbox" wire:model="isSecondary"> Personnage secondaire
                        </label>
                    </div>
                </fieldset>

                {{-- 2. Profil --}}
                <fieldset class="pf-section" style="border: 0; padding: 0; margin: 0;">
                    <h3 class="pf-section-title"><span class="pf-step">2</span> Profil</h3>
                    <div class="pf-section" style="gap: 10px;">
                        <strong class="pf-sub">Mes fichiers</strong>
                        @if($fichiers->isEmpty())
                            <p class="muted">Aucune image de personnage pour l'instant. Importe-en une à gauche.</p>
                        @else
                            <p class="muted">Clique sur une image pour l'associer à ce personnage, puis enregistre la fiche.</p>
                            <div class="pf-files">
                                @foreach($fichiers as $fichier)
                                    <button type="button" class="pf-file {{ $fichierActifId === $fichier->id ? 'pf-file-on' : '' }}"
                                            wire:click="choisirImage({{ $fichier->id }})" wire:key="fichier-{{ $fichier->id }}"
                                            aria-pressed="{{ $fichierActifId === $fichier->id ? 'true' : 'false' }}">
                                        <img src="{{ $fichier->previewUrl() }}" alt="" loading="lazy" decoding="async">
                                        <span>{{ $fichier->label }}</span>
                                    </button>
                                @endforeach
                            </div>
                        @endif
                        <details class="pf-advanced">
                            <summary>Saisir un chemin ou une URL à la main</summary>
                            <label>Chemin ou URL
                                <input wire:model="sprite" placeholder="assets/Personnages/Crushs/PNG/Liam.png" maxlength="1000">
                            </label>
                        </details>
                    </div>
                    <label>Accroche
                        <input wire:model="tagline" placeholder="« Je ne perds jamais, j'apprends. »" maxlength="500">
                    </label>
                    <div class="pf-fields">
                        <label>Âge
                            <input wire:model="age" placeholder="22 ans" maxlength="20">
                        </label>
                        <label>Formation / rôle
                            <input wire:model="formation" placeholder="Droit, 3ᵉ année" maxlength="255">
                        </label>
                    </div>
                    <div class="pf-fields pf-fields-3">
                        <label>Taille
                            <input wire:model="taille" placeholder="1m82" maxlength="100">
                        </label>
                        <label>Poids
                            <input wire:model="poids" placeholder="74 kg" maxlength="100">
                        </label>
                        <label>Signe astrologique
                            <input wire:model="signe" placeholder="Scorpion" maxlength="100">
                        </label>
                    </div>
                    <label>Description (carnet de relations)
                        <textarea wire:model="description" rows="4" maxlength="2000"
                                  placeholder="Quelques phrases qui apparaissent dans le carnet une fois le personnage rencontré."></textarea>
                    </label>
                </fieldset>

                {{-- 3. Mode d'emploi --}}
                <fieldset class="pf-section" style="border: 0; padding: 0; margin: 0;">
                    <h3 class="pf-section-title"><span class="pf-step">3</span> Mode d'emploi</h3>
                    <p class="muted">Une entrée par ligne. Affiché dans le carnet de relations sous « Mode d'emploi ».</p>
                    <div class="pf-mode">
                        <div class="pf-mode-box pf-mode-do">
                            <label>✓ À faire
                                <textarea wire:model="modeEmploiFaire" rows="7" maxlength="3000"
                                          placeholder="Lui faire confiance dès le départ&#10;Répondre à ses questions honnêtement&#10;Lui proposer des défis intellectuels"></textarea>
                            </label>
                        </div>
                        <div class="pf-mode-box pf-mode-dont">
                            <label>✗ À éviter
                                <textarea wire:model="modeEmploiEviter" rows="7" maxlength="3000"
                                          placeholder="Montrer de la faiblesse trop tôt&#10;Changer d'avis sans explication&#10;Ignorer ses remarques"></textarea>
                            </label>
                        </div>
                    </div>
                </fieldset>

                <div class="pf-footer">
                    <button type="button" class="button" wire:click="annuler">Annuler</button>
                    <button class="button primary" type="submit" wire:loading.attr="disabled" wire:target="sauvegarder">
                        <span wire:loading.remove wire:target="sauvegarder">{{ $editingId ? 'Enregistrer les modifications' : 'Créer le personnage' }}</span>
                        <span wire:loading wire:target="sauvegarder">Enregistrement…</span>
                    </button>
                </div>
            </div>
        </form>
    </section>
    @endif

    {{-- ── Résumé ─────────────────────────────────────────────────────────── --}}
    <div class="summary-grid" style="margin-bottom: 0;">
        <div class="summary"><strong>{{ $total }}</strong><span>Fiches de personnages</span></div>
        <div class="summary"><strong>{{ $withMode }}</strong><span>Avec un mode d'emploi</span></div>
        <div class="summary accent"><strong>{{ $withoutImg }}</strong><span>Sans image</span></div>
    </div>

    {{-- ── Liste par catégorie ────────────────────────────────────────────── --}}
    @if($total === 0)
        <div class="pf-empty">
            <h2>Aucun personnage pour l'instant</h2>
            <p class="muted">Crée la première fiche avec le bouton « Nouveau personnage ».</p>
        </div>
    @endif

    @foreach($groups as $group)
        @if($group['items']->isNotEmpty())
        <section class="pf-group" wire:key="group-{{ $loop->index }}">
            <h2 class="pf-group-title">{{ $group['title'] }} <small>{{ $group['items']->count() }}</small></h2>
            <div class="pf-grid">
                @foreach($group['items'] as $perso)
                    @php
                        $sprite  = $spriteUrls[$perso->id] ?? null;
                        $tagline = $perso->data['tagline'] ?? null;
                    @endphp
                    <article class="pf-card {{ $editingId === $perso->id && $panelOuvert ? 'pf-card-on' : '' }}" wire:key="char-{{ $perso->id }}">
                        <div class="pf-art">
                            @if($sprite)
                                <img src="{{ $sprite }}" alt="Portrait de {{ $perso->name }}" loading="lazy" decoding="async">
                            @else
                                <span class="pf-initial" aria-hidden="true">{{ mb_strtoupper(mb_substr($perso->name, 0, 1)) }}</span>
                            @endif
                        </div>
                        <div class="pf-body">
                            <h3 class="pf-name">{{ $perso->name }}</h3>
                            <span class="pf-slug">{{ $perso->slug }}</span>
                            @if($tagline)
                                <p class="pf-tagline">{{ $tagline }}</p>
                            @endif
                            <div class="pf-tags">
                                @if($hasMode($perso))
                                    <span class="pf-tag pf-tag-ok">Mode d'emploi ✓</span>
                                @else
                                    <span class="pf-tag pf-tag-off">Sans mode d'emploi</span>
                                @endif
                            </div>
                        </div>
                        <div class="pf-card-foot">
                            <button type="button" class="button" wire:click="editer({{ $perso->id }})" x-on:click="window.scrollTo({ top: 0, behavior: 'smooth' })">Modifier</button>
                        </div>
                    </article>
                @endforeach
            </div>
        </section>
        @endif
    @endforeach
</div>