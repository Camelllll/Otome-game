<?php

namespace App\Livewire;

use App\Models\Episode;
use Illuminate\Support\Facades\DB;
use Livewire\Component;

class EpisodeIndex extends Component
{
    public string $title = '';

    public string $slug = '';

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

    public function render()
    {
        return view('livewire.episode-index', [
            'episodes' => Episode::with('publishedVersion')->withCount('versions')->orderBy('position')->get(),
        ])->layout('components.layouts.studio');
    }
}
