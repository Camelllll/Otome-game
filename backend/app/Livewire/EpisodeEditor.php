<?php

namespace App\Livewire;

use App\Models\Character;
use App\Models\Episode;
use App\Models\MediaAsset;
use App\Services\EpisodeDocument;
use App\Services\EpisodeWriter;
use Illuminate\Validation\ValidationException;
use Livewire\Attributes\Locked;
use Livewire\Component;

class EpisodeEditor extends Component
{
    #[Locked]
    public int $episodeId;

    #[Locked]
    public int $versionId;

    public string $title = '';

    public string $document = '';

    public string $selected = '';

    public string $nodeJson = '';

    public string $nodeText = '';

    public string $nodeSpeaker = '';

    public string $nodeNext = '';

    public string $nodeBackground = '';

    public string $nodeMusic = '';

    public string $nodeIllustration = '';

    public string $search = '';

    public string $newNodeId = '';

    public bool $advanced = false;

    public bool $fullDocument = false;

    public string $message = '';

    public function boot(): void
    {
        abort_unless(auth()->user()?->is_admin, 403);
    }

    public function mount(Episode $episode): void
    {
        $this->episodeId = $episode->id;
        $version = $episode->latestVersion();
        abort_unless($version, 404);
        $this->versionId = $version->id;
        $this->title = $episode->title;
        $this->document = $this->encode($version->data);
        $this->loadNode(array_key_first($version->data['nodes']));
    }

    private function encode(array $value): string
    {
        return json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private function data(): array
    {
        return app(EpisodeDocument::class)->decode($this->document);
    }

    private function loadNode(string $id): void
    {
        $data = $this->data();
        if (! isset($data['nodes'][$id])) {
            $this->addError('nodeJson', 'Nœud introuvable.');

            return;
        }
        $this->selected = $id;
        $node = $data['nodes'][$id];
        $this->nodeJson = $this->encode($node);
        $this->nodeText = is_string($node['text'] ?? null) ? $node['text'] : '';
        $this->nodeSpeaker = is_string($node['speaker'] ?? null) ? $node['speaker'] : '';
        $this->nodeNext = is_string($node['next'] ?? null) ? $node['next'] : '';
        $this->nodeBackground = is_string($node['background'] ?? null) ? $node['background'] : '';
        $this->nodeMusic = is_string($node['music'] ?? null) ? $node['music'] : '';
        $this->nodeIllustration = is_string($node['cg'] ?? null) ? $node['cg'] : '';
    }

    private function applyNode(): void
    {
        if ($this->fullDocument) {
            return;
        }
        $data = $this->data();
        try {
            $node = EpisodeDocument::decodeValue($this->nodeJson);
        } catch (\JsonException $exception) {
            throw ValidationException::withMessages(['nodeJson' => 'JSON du nœud invalide : '.$exception->getMessage()]);
        }
        if (! is_array($node) || array_is_list($node) || ! is_string($node['type'] ?? null)) {
            throw ValidationException::withMessages(['nodeJson' => 'Un objet avec un type de nœud est attendu.']);
        }
        if (! $this->advanced) {
            if ($node['type'] === 'line') {
                $node['text'] = $this->nodeText;
                $node['speaker'] = $this->nodeSpeaker;
            }
            if ($this->nodeNext !== '') {
                $node['next'] = $this->nodeNext;
            } else {
                unset($node['next']);
            }
            foreach (['background' => $this->nodeBackground, 'music' => $this->nodeMusic, 'cg' => $this->nodeIllustration] as $field => $value) {
                if ($value !== ($node[$field] ?? '')) {
                    $node[$field] = $value;
                }
            }
        }
        $data['nodes'][$this->selected] = $node;
        $this->document = $this->encode($data);
    }

    public function selectNode(string $id): void
    {
        $this->applyNode();
        $this->loadNode($id);
        $this->resetValidation();
    }

    public function toggleAdvanced(): void
    {
        $this->applyNode();
        $this->advanced = ! $this->advanced;
        $this->loadNode($this->selected);
    }

    public function toggleDocument(): void
    {
        $this->applyNode();
        $this->fullDocument = ! $this->fullDocument;
        if (! $this->fullDocument) {
            $data = $this->data();
            $this->loadNode(isset($data['nodes'][$this->selected]) ? $this->selected : array_key_first($data['nodes']));
        }
    }

    public function addNode(): void
    {
        $this->validate(['newNodeId' => ['required', 'string', 'max:120', 'regex:/^[a-zA-Z0-9_-]+$/']]);
        $this->applyNode();
        $data = $this->data();
        if (isset($data['nodes'][$this->newNodeId])) {
            $this->addError('newNodeId', 'Cet identifiant existe déjà.');

            return;
        }
        $data['nodes'][$this->newNodeId] = ['type' => 'line', 'speaker' => 'narration', 'text' => '', 'next' => $data['start'] ?? $this->selected];
        $this->document = $this->encode($data);
        $this->loadNode($this->newNodeId);
        $this->newNodeId = '';
    }

    public function save(): void
    {
        $this->validate(['title' => 'required|string|max:255']);
        $this->applyNode();
        $version = app(EpisodeWriter::class)->save(
            Episode::findOrFail($this->episodeId), $this->title, $this->data(), $this->versionId, auth()->id(),
        );
        $this->versionId = $version->id;
        $this->message = "Brouillon enregistré : version {$version->number}.";
        if ($this->fullDocument) {
            $data = $this->data();
            $this->loadNode(isset($data['nodes'][$this->selected]) ? $this->selected : array_key_first($data['nodes']));
        }
        $this->resetValidation();
    }

    public function publish(): void
    {
        $this->save();
        app(EpisodeWriter::class)->publish(Episode::findOrFail($this->episodeId), $this->versionId);
        $this->message = 'Version enregistrée et publiée.';
    }

    public function render()
    {
        try {
            $data = $this->data();
        } catch (ValidationException $exception) {
            $this->addError('document', $exception->getMessage());
            $data = ['nodes' => []];
        }
        $nodes = collect($data['nodes'])->filter(fn ($node, $id) => $this->search === '' || mb_stripos($id.' '.($node['text'] ?? ''), $this->search) !== false);
        $speakers = Character::orderBy('name')->get()->mapWithKeys(fn (Character $character) => [
            $character->slug => $character->name.' — '.$character->slug,
        ]);
        foreach ($data['nodes'] as $node) {
            $speaker = $node['speaker'] ?? null;
            if (is_string($speaker) && $speaker !== '' && ! $speakers->has($speaker)) {
                $speakers->put($speaker, ucfirst($speaker).' (hors catalogue)');
            }
        }
        if ($this->nodeSpeaker !== '' && ! $speakers->has($this->nodeSpeaker)) {
            $speakers->put($this->nodeSpeaker, ucfirst($this->nodeSpeaker).' (hors catalogue)');
        }
        $speakers->put('moi', 'Héroïne (moi)');
        $speakers->put('narration', 'Narration');

        return view('livewire.episode-editor', [
            'episode' => Episode::findOrFail($this->episodeId),
            'nodes' => $nodes,
            'nodeCount' => count($data['nodes']),
            'targetNodes' => $data['nodes'],
            'speakers' => $speakers->sort(SORT_NATURAL | SORT_FLAG_CASE),
            'mediaOptions' => MediaAsset::where('is_archived', false)->orderBy('label')->get()->groupBy('category'),
        ])->layout('components.layouts.studio');
    }
}
