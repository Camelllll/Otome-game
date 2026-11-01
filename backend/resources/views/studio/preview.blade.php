<x-layouts.studio>
    <header class="page-header"><div><div class="eyebrow">LECTURE EXPLORATOIRE · VERSION {{ $version->number }}</div><h1>{{ $episode->title }}</h1><p class="muted">Aperçu du texte et des liens enregistrés, sans sauvegarde joueur ni simulation des jauges et conditions. Les branches se choisissent manuellement.</p></div></header>
    <section class="preview-panel"><span id="node-id" class="badge"></span><h2 id="speaker"></h2><p id="text" class="preview-text"></p><div id="choices" class="stack"></div><p id="preview-error" class="error" role="alert"></p><button class="text-button" id="restart">Recommencer</button></section>
    <script>
        const episode = {{ Illuminate\Support\Js::from($version->data) }};
        const choices = document.getElementById('choices');
        function show(id) {
            choices.replaceChildren();
            document.getElementById('preview-error').textContent = '';
            const node = episode.nodes[id];
            document.getElementById('node-id').textContent = id ?? 'Destination absente';
            document.getElementById('speaker').textContent = node?.speaker ?? '';
            document.getElementById('text').textContent = node?.text ?? '';
            if (!node) {
                document.getElementById('preview-error').textContent = 'Ce nœud n’existe pas. Corrige le lien dans l’éditeur.';
                return;
            }
            function button(label, target) {
                const element = document.createElement('button');
                element.className = 'button';
                element.textContent = label;
                element.addEventListener('click', () => show(target));
                choices.append(element);
            }
            if (node.type === 'choice') {
                for (const option of node.options ?? []) button(option.text ?? 'Option sans texte', option.next);
            } else if (node.type === 'branch') {
                for (const branch of node.branches ?? []) {
                    if (branch.if?.topGauge?.routes) {
                        for (const [character, target] of Object.entries(branch.if.topGauge.routes)) button('Explorer la route : ' + character, target);
                    } else {
                        button(branch.if ? 'Explorer : ' + JSON.stringify(branch.if) : 'Route par défaut', branch.next);
                    }
                }
                if (node.fallback) button('Suite par défaut', node.fallback);
            } else if (node.type === 'end') {
                document.getElementById('text').textContent = node.nextEpisode ? 'Fin — épisode suivant : ' + node.nextEpisode : 'Fin de l’épisode.';
            } else if (node.next) button('Continuer →', node.next);
            else document.getElementById('preview-error').textContent = 'Dialogue sans destination.';
        }
        document.getElementById('restart').addEventListener('click', () => show(episode.start));
        show(episode.start);
    </script>
</x-layouts.studio>
