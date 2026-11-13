<?php

namespace App\Livewire;

use App\Models\Character;
use App\Models\Episode;
use App\Models\Illustration;
use App\Models\MediaAsset;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Livewire\Attributes\Locked;
use Livewire\Component;
use Livewire\WithFileUploads;

/**
 * Médiathèque des illustrations du carnet de relations.
 * L'admin lie chaque image à un ou plusieurs personnages et à un moment de l'histoire :
 * rien n'est deviné à partir du nom du fichier.
 */
class Illustrations extends Component
{
    use WithFileUploads;

    private const MAX_NODE_OPTIONS = 400;

    #[Locked]
    public ?int $editingId = null;

    public bool $formOpen = false;

    public string $title = '';

    /** Identifiant du média choisi dans la bibliothèque (chaîne vide = aucun). */
    public string $mediaAssetId = '';

    public string $episodeId = '';

    public string $rarity = 'common';

    /** @var array<int, string> */
    public array $characterIds = [];

    public string $unlockNodeId = '';

    public int $spoilerLevel = 1;

    public $upload;

    public string $message = '';

    public function boot(): void
    {
        abort_unless(auth()->user()?->is_admin, 403);
    }

    /** Ouvert depuis la médiathèque : le formulaire s'affiche directement, avec l'image choisie si on en a cliqué une. */
    public function mount(?int $assetId = null): void
    {
        $existing = $assetId !== null
            ? Illustration::where('media_asset_id', $assetId)->orderByDesc('id')->first()
            : null;

        if ($existing) {
            // L'image a déjà une fiche : on la rouvre pour la modifier au lieu d'en créer une seconde.
            $this->edit($existing->id);

            return;
        }

        $this->create();
        if ($assetId !== null && MediaAsset::where('category', 'illustrations')->whereKey($assetId)->exists()) {
            $this->mediaAssetId = (string) $assetId;
        }
    }

    public function create(): void
    {
        $this->cancel();
        $this->formOpen = true;
    }

    public function cancel(): void
    {
        $this->reset('editingId', 'formOpen', 'title', 'mediaAssetId', 'episodeId', 'characterIds', 'unlockNodeId', 'spoilerLevel', 'rarity', 'upload');
        $this->resetValidation();
    }

    public function edit(int $id): void
    {
        $illustration = Illustration::findOrFail($id);
        $this->cancel();
        $this->editingId = $illustration->id;
        $this->formOpen = true;
        $this->title = $illustration->title;
        $this->mediaAssetId = $illustration->media_asset_id ? (string) $illustration->media_asset_id : '';
        $this->episodeId = (string) $illustration->episode_id;
        $this->characterIds = array_values($illustration->character_ids ?? []);
        $this->unlockNodeId = (string) $illustration->unlock_node_id;
        $this->spoilerLevel = (int) $illustration->spoiler_level;
        $this->rarity = $illustration->rarity ?? 'common';
    }

    public function updatedEpisodeId(): void
    {
        // Les moments proposés dépendent de l'épisode : l'ancien choix n'a plus de sens.
        $this->unlockNodeId = '';
    }

    public function updatedUpload(): void
    {
        $this->validateOnly('upload', [
            'upload' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,gif', 'max:'.MediaAsset::MAX_UPLOAD_KB],
        ], $this->messages());
    }

    public function save(): void
    {
        $characterKeys = array_keys($this->characterOptions());
        $episodeSlugs = Episode::query()->pluck('slug')->all();

        $this->validate([
            'title' => ['required', 'string', 'max:160'],
            'episodeId' => ['nullable', 'string', Rule::in($episodeSlugs)],
            'characterIds' => ['required', 'array', 'min:1'],
            'characterIds.*' => ['string', Rule::in($characterKeys)],
            'unlockNodeId' => ['nullable', 'string', 'max:120'],
            'spoilerLevel' => ['required', 'integer', 'between:1,3'],
            'rarity' => ['required', 'string', Rule::in(Illustration::RARITIES)],
            'upload' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,gif', 'max:'.MediaAsset::MAX_UPLOAD_KB],
            'mediaAssetId' => [
                'nullable',
                Rule::exists('media_assets', 'id')->where('category', 'illustrations'),
            ],
        ], $this->messages());

        $existing = $this->editingId ? Illustration::findOrFail($this->editingId) : null;

        if (! $this->upload && $this->mediaAssetId === '' && ! $existing?->media_asset_id) {
            $this->addError('mediaAssetId', 'Choisis une image dans la bibliothèque ou importes-en une nouvelle.');

            return;
        }

        if ($this->unlockNodeId !== '' && ! array_key_exists($this->unlockNodeId, $this->nodeOptions())) {
            $this->addError('unlockNodeId', 'Ce moment n’existe pas dans l’épisode choisi.');

            return;
        }

        $path = $this->upload ? $this->upload->store('illustrations', 'studio') : null;

        try {
            DB::transaction(function () use ($existing, $path) {
                $assetId = $this->mediaAssetId !== '' ? (int) $this->mediaAssetId : $existing?->media_asset_id;

                if ($path) {
                    $asset = MediaAsset::create([
                        'category' => 'illustrations',
                        'label' => trim($this->title),
                        'description' => '',
                        'file_path' => $path,
                        'original_name' => $this->upload->getClientOriginalName(),
                        'mime_type' => $this->upload->getMimeType(),
                        'size' => $this->upload->getSize(),
                    ]);
                    $assetId = $asset->id;
                }

                $attributes = [
                    'title' => trim($this->title),
                    'media_asset_id' => $assetId,
                    'episode_id' => $this->episodeId !== '' ? $this->episodeId : null,
                    'character_ids' => array_values(array_unique($this->characterIds)),
                    'unlock_node_id' => $this->unlockNodeId !== '' ? $this->unlockNodeId : null,
                    'unlock_condition' => Illustration::CONDITION_VIEWED,
                    'spoiler_level' => $this->spoilerLevel,
                    'rarity' => $this->rarity,
                ];

                if ($existing) {
                    // L'identifiant reste figé : les sauvegardes des joueurs y font référence.
                    $existing->fill($attributes)->save();
                } else {
                    Illustration::create($attributes + ['slug' => $this->newSlug()]);
                }
            });
        } catch (\Throwable $exception) {
            if ($path) {
                Storage::disk('studio')->delete($path);
            }
            throw $exception;
        }

        $this->message = $existing ? 'Illustration mise à jour.' : 'Illustration ajoutée. Elle apparaîtra dans les souvenirs des personnages liés dès qu’un joueur l’aura vue.';
        $this->cancel();
    }

    public function delete(int $id): void
    {
        $illustration = Illustration::findOrFail($id);
        $illustration->delete();
        if ($this->editingId === $id) {
            $this->cancel();
        }
        $this->message = 'Illustration supprimée. L’image reste disponible dans la médiathèque.';
    }

    /** @return array<string, string> identifiant du personnage => nom */
    private function characterOptions(): array
    {
        return Character::query()
            ->where('is_player', false)
            ->orderBy('id')
            ->get(['slug', 'name', 'is_secondary', 'data'])
            ->mapWithKeys(function (Character $character) {
                $data = is_array($character->data) ? $character->data : [];
                $key = (string) ($data['id'] ?? $character->slug);

                return [$key => (string) ($data['name'] ?? $character->name)];
            })
            ->all();
    }

    /** @return array<string, string> identifiant du nœud => libellé lisible */
    private function nodeOptions(): array
    {
        if ($this->episodeId === '') {
            return [];
        }

        $episode = Episode::query()->where('slug', $this->episodeId)->first();
        $data = $episode?->latestVersion()?->data;
        $nodes = is_array($data) && is_array($data['nodes'] ?? null) ? $data['nodes'] : [];

        $withCg = [];
        $others = [];
        foreach ($nodes as $nodeId => $node) {
            if (! is_array($node) || ! in_array($node['type'] ?? 'line', ['line', 'choice'], true)) {
                continue;
            }
            $text = trim(preg_replace('/\s+/u', ' ', (string) ($node['text'] ?? '')));
            $speaker = (string) ($node['speaker'] ?? '');
            $excerpt = $text !== '' ? Str::limit(($speaker !== '' ? $speaker.' : ' : '').$text, 70) : '(sans texte)';
            if (! empty($node['cg'])) {
                $withCg[(string) $nodeId] = '★ '.$nodeId.' — '.$excerpt;
            } else {
                $others[(string) $nodeId] = $nodeId.' — '.$excerpt;
            }
        }

        // Les nœuds qui affichent déjà une illustration sont proposés en premier.
        return array_slice($withCg + $others, 0, self::MAX_NODE_OPTIONS, true);
    }

    private function newSlug(): string
    {
        $base = 'cg-'.Str::slug($this->episodeId !== '' ? $this->episodeId : 'souvenir').'-'.(Str::slug($this->title) ?: 'illustration');
        $base = rtrim(Str::substr($base, 0, 110), '-');
        $slug = $base;
        $suffix = 2;
        while (Illustration::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }

    /** @return array<string, string> */
    private function messages(): array
    {
        return [
            'title.required' => 'Donne un titre à l’illustration.',
            'characterIds.required' => 'Choisis au moins un personnage.',
            'characterIds.min' => 'Choisis au moins un personnage.',
            'upload.mimes' => 'Formats acceptés : JPG, PNG, WEBP ou GIF.',
            'upload.max' => 'Cette image est trop lourde.',
            'mediaAssetId.exists' => 'Cette image n’existe plus dans la médiathèque.',
        ];
    }

    public function render()
    {
        $characters = $this->characterOptions();

        return view('livewire.illustrations', [
            'illustrations' => Illustration::query()->with('mediaAsset')->orderByDesc('id')->get(),
            'episodes' => Episode::query()->orderBy('position')->orderBy('slug')->pluck('title', 'slug'),
            'characters' => $characters,
            'nodes' => $this->nodeOptions(),
            'assets' => MediaAsset::query()
                ->where('category', 'illustrations')
                ->where('is_archived', false)
                ->orderByDesc('id')
                ->limit(200)
                ->get(['id', 'label', 'file_path', 'mime_type']),
            'uploadLimitMb' => MediaAsset::MAX_UPLOAD_KB / 1024,
        ]);
    }
}