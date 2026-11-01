<div>
    <header class="page-header"><div><a class="eyebrow" href="{{ route('studio.index') }}">← BIBLIOTHÈQUE / {{ $episode->slug }}</a><h1>L'atelier d'écriture</h1><p class="muted">{{ $nodeCount }} nœuds · Les identifiants existants sont conservés.</p></div>
        <div class="actions"><a class="button" href="{{ route('studio.export', $episode) }}">Exporter le dernier enregistrement</a><a class="button" href="{{ route('studio.preview', $episode) }}" target="_blank" rel="noopener">Aperçu enregistré ↗</a></div>
    </header>
    <div class="editor-toolbar"><label>Titre de l'épisode<input wire:model="title" maxlength="255"></label><div class="actions"><button class="button" wire:click="save" wire:loading.attr="disabled">Enregistrer le brouillon</button><button class="button primary" wire:click="publish" wire:confirm="Enregistrer puis publier cette version dans le nouveau studio ?" wire:loading.attr="disabled">Publier</button></div></div>
    @if($message)<p class="notice" role="status">{{ $message }}</p>@endif
    @if($errors->any())<div class="error-box" role="alert">@foreach($errors->all() as $error)<p>{{ $error }}</p>@endforeach</div>@endif
    <div class="editor-grid">
        <aside class="node-panel">
            <h2>Le fil de l'histoire</h2>
            <input aria-label="Rechercher un dialogue" wire:model.live.debounce.400ms="search" placeholder="Rechercher un dialogue...">
            <div class="node-list">
                @foreach($nodes as $id => $node)
                    <button class="node-item {{ $selected === (string) $id ? 'selected' : '' }}" wire:key="node-{{ $id }}" wire:click="selectNode(@js((string) $id))"><small>{{ $id }} · {{ $node['type'] }}</small><span>{{ \Illuminate\Support\Str::limit($node['text'] ?? ($node['type'] === 'choice' ? 'Choix du joueur' : 'Embranchement / fin'), 70) }}</span></button>
                @endforeach
            </div>
            <form wire:submit="addNode" class="stack"><label>Nouveau nœud<input wire:model="newNodeId" placeholder="scene_2_dialogue_1" required></label><button class="button" @disabled($fullDocument)>Ajouter un dialogue</button></form>
        </aside>
        <section class="writing-panel">
            <div class="section-heading"><h2>{{ $selected }}</h2><button class="text-button" wire:click="toggleDocument">{{ $fullDocument ? 'Revenir au nœud' : 'JSON de tout l’épisode' }}</button></div>
            @if($fullDocument)
                <p class="muted">Mode expert : toutes les propriétés sont conservées. La sauvegarde accepte un brouillon incomplet ; la publication vérifie les liens.</p>
                <textarea class="code-editor full-code" aria-label="JSON complet de l'épisode" wire:model="document" spellcheck="false"></textarea>
            @else
                <div class="section-heading"><span class="badge">{{ $advanced ? 'JSON DU NŒUD' : 'ÉDITION GUIDÉE' }}</span><button class="text-button" wire:click="toggleAdvanced">{{ $advanced ? 'Édition guidée' : 'Options, effets et JSON' }}</button></div>
                @if($advanced)
                    <p class="muted">Modifie ici le type, les options, effets, décors et branches. Les propriétés non modifiées restent intactes.</p>
                    <textarea class="code-editor" aria-label="JSON du nœud" wire:model="nodeJson" spellcheck="false"></textarea>
                @else
                    <div class="stack">
                        <label>Personnage qui parle (pour un dialogue)<select wire:model="nodeSpeaker"><option value="">Aucun personnage</option>@foreach($speakers as $speaker => $name)<option value="{{ $speaker }}">{{ $name }}</option>@endforeach</select></label>
                        <p class="muted">Tous les personnages du catalogue sont disponibles, même s'ils n'ont pas encore de dialogue dans cet épisode.</p>
                        <div class="scene-media-fields">
                            @foreach(['backgrounds' => ['nodeBackground', 'Décor / thème de la scène', $nodeBackground], 'music' => ['nodeMusic', 'Musique', $nodeMusic], 'illustrations' => ['nodeIllustration', 'Illustration', $nodeIllustration]] as $category => [$binding, $label, $current])
                                @php($options = $mediaOptions->get($category, collect()))
                                <label>{{ $label }}<select wire:model="{{ $binding }}">
                                    <option value="">{{ $category === 'backgrounds' ? 'Garder le décor en cours' : 'Aucune indication' }}</option>
                                    @if($current !== '' && !$options->contains(fn ($asset) => $asset->url() === $current))
                                        <option value="{{ $current }}">Référence existante — {{ \Illuminate\Support\Str::limit(basename($current), 50) }}</option>
                                    @endif
                                    @foreach($options as $asset)<option value="{{ $asset->url() }}">{{ $asset->label }}</option>@endforeach
                                </select></label>
                            @endforeach
                        </div>
                        <p class="muted">Ces réglages s'appliquent au nœud sélectionné. Le décor reste affiché ensuite jusqu'au prochain changement. <a class="text-button" href="{{ route('studio.media') }}" target="_blank" rel="noopener">Ajouter des médias ↗</a>, puis recharge après avoir enregistré.</p>
                        <label>Texte du dialogue<textarea class="dialogue-input" wire:model="nodeText" placeholder="Écris la prochaine réplique..."></textarea></label>
                        <label>Suite du dialogue<input wire:model="nodeNext" list="episode-destinations" placeholder="Choisis un nœud existant"><datalist id="episode-destinations">@foreach($targetNodes as $target => $targetNode)<option value="{{ $target }}">{{ \Illuminate\Support\Str::limit($targetNode['text'] ?? $targetNode['type'], 60) }}</option>@endforeach</datalist></label>
                    </div>
                    <p class="muted">Pour les choix et embranchements, utilise « Options, effets et JSON ». Passer à un autre nœud conserve les modifications dans la page.</p>
                @endif
            @endif
        </section>
        <aside class="inspector"><div class="eyebrow">CARNET DE CRÉATION</div><h2>Chaque choix compte.</h2><p>Enregistre un brouillon pour conserver ton travail. Chaque enregistrement crée une nouvelle version.</p><hr><h3>Avant de publier</h3><p>Le point de départ et les destinations sont vérifiés. Une erreur de lien bloque la publication, pas l'écriture.</p><hr><h3>Médias</h3><p>Décors, illustrations et musiques sont disponibles dans les menus. Les anciennes références restent conservées, même si leur fichier n'est pas encore remis.</p><p class="muted">Pas d'enregistrement automatique. Enregistre avant de quitter ou d'ouvrir l'aperçu.</p><span wire:loading class="badge">Traitement en cours…</span></aside>
    </div>
</div>
