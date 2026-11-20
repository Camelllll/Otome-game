<?php

namespace App\Livewire;

use App\Models\Episode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Livewire\Attributes\Locked;
use Livewire\Component;
use Livewire\WithFileUploads;

class EpisodeIndex extends Component
{
    use WithFileUploads;

    public string $title = '';

    public string $slug = '';

    #[Locked]
    public ?int $editingId = null;

    public string $editTitle = '';

    public string $editDescription = '';

    public $thumbnail = null;

    public string $message = '';

    public function boot(): void
    {
        abort_unless(auth()->user()?->is_admin, 403);
    }

    public function create(): void
    {
        $this->validate([
            'title' => 'required|string|max:255',
            'slug' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z0-9_-]+$/', 'unique:episodes,slug'],
        ]);
        $episode = DB::transaction(function () {
            $episode = Episode::create(['slug' => $this->slug, 'title' => $this->title, 'position' => (Episode::max('position') ?? 0) + 1]);
            $episode->versions()->create(['number' => 1, 'created_by' => auth()->id(), 'data' => [
                'id' => $this->slug, 'start' => 'scene_1_dialogue_1',
                'nodes' => ['scene_1_dialogue_1' => ['type' => 'line', 'speaker' => 'moi', 'text' => '', 'next' => '', 'background' => '', 'position' => 'center']],
                'scenes' => [['id' => 'scene_1', 'title' => 'Scène 1', 'background' => '', 'music' => '', 'nodeIds' => ['scene_1_dialogue_1']]],
            ]]);

            return $episode;
        });
        $this->redirectRoute('studio.edit', ['episode' => $episode]);
    }

    public function edit(int $id): void
    {
        $episode = Episode::findOrFail($id);
        $this->resetValidation();
        $this->editingId = $episode->id;
        $this->editTitle = $episode->title;
        $this->editDescription = $episode->description ?? '';
        $this->thumbnail = null;
        $this->message = '';
    }

    public function cancelEdit(): void
    {
        $this->reset('editingId', 'editTitle', 'editDescription', 'thumbnail');
        $this->resetValidation();
    }

    public function saveMetadata(): void
    {
        $this->validate([
            'editingId' => ['required', 'integer', 'exists:episodes,id'],
            'editTitle' => ['required', 'string', 'max:255'],
            'editDescription' => ['nullable', 'string', 'max:3000'],
            'thumbnail' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:10240'],
        ]);

        $path = $this->thumbnail?->store('episode-thumbnails', 'studio');
        try {
            DB::transaction(function () use ($path) {
                $episode = Episode::lockForUpdate()->findOrFail($this->editingId);
                $episode->title = trim($this->editTitle);
                $episode->description = trim($this->editDescription) ?: null;
                if ($path) {
                    $episode->thumbnail_path = $path;
                }
                $episode->save();
            });
        } catch (\Throwable $exception) {
            if ($path) {
                Storage::disk('studio')->delete($path);
            }
            throw $exception;
        }

        $this->cancelEdit();
        $this->message = 'Les informations de l’épisode ont été mises à jour.';
    }

    public function render()
    {
        return view('livewire.episode-index', [
            'episodes' => Episode::with('publishedVersion')->withCount('versions')->orderBy('position')->get(),
        ])->layout('components.layouts.studio');
    }
}
