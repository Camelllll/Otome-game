<x-layouts.studio>
    <div id="episode-flow-app" class="legacy-flow">
        <header class="page-header"><div><div class="eyebrow">LE STUDIO / ÉPISODES</div><h1>Écris la prochaine scène.</h1><p class="muted">Le parcours de l'ancien studio, avec tes médias et personnages locaux.</p></div><a class="button" href="{{ route('studio.media') }}" target="_blank" rel="noopener">Gérer les médias ↗</a></header>
        <section class="flow-toolbar">
            <div class="flow-picker"><label>Épisode<select id="episode-select"></select></label><button id="new-episode-main" class="button primary">+ Nouvel épisode</button></div>
            <label>Titre de l'épisode<input id="episode-title" maxlength="255"></label>
            <div class="actions">
                <label class="button">Importer JSON<input id="import-json" hidden type="file" accept=".json,application/json"></label>
                <label class="button">Importer .docx<input id="import-docx" hidden type="file" accept=".docx"></label>
                <button id="export-json" class="button">Exporter l'épisode</button>
                <button id="export-all" class="button">Sauvegarder tout</button>
                <button id="save-episode" class="button">Enregistrer maintenant</button>
                <button id="preview-episode" class="button">Aperçu enregistré ↗</button>
                <button id="publish-episode" class="button primary">Publier</button>
            </div>
            <p id="flow-status" role="status" class="muted">Chargement du studio…</p>
            <p id="flow-error" class="error-box" role="alert" hidden></p>
        </section>
        <p class="muted flow-help">Crée une scène par chemin possible, puis choisis sa destination dans « Suite » ou « Mène à ». Le décor se choisit au niveau de la scène. Les modifications sont enregistrées automatiquement en brouillon ; publier reste une action distincte.</p>
        <div id="scene-flow"></div>
        <button id="new-scene-main" class="button primary">+ Ajouter une scène</button>
    </div>
    <script id="episode-flow-data" type="application/json">{!! json_encode($initial, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) !!}</script>
</x-layouts.studio>
