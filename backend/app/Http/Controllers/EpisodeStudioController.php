<?php

namespace App\Http\Controllers;

use App\Models\Character;
use App\Models\Episode;
use App\Models\MediaAsset;
use App\Services\EpisodeDocument;
use App\Services\EpisodeWriter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EpisodeStudioController extends Controller
{
    public function show(Episode $episode)
    {
        return view('studio.episode-flow', ['initial' => [
            'selected' => $episode->slug,
            'episodes' => Episode::orderBy('position')->get()->map(fn ($item) => $this->row($item)),
            'characters' => Character::orderBy('name')->get()->map(fn ($person) => [
                'id' => $person->slug, 'name' => $person->name.' — '.$person->slug,
            ]),
            'media' => MediaAsset::where('is_archived', false)->orderBy('label')->get()->map(fn ($asset) => [
                'category' => $asset->category, 'label' => $asset->label, 'url' => $asset->url(),
            ]),
            'saveUrl' => route('studio.flow.save'),
            'createUrl' => route('studio.flow.create'),
            'importUrl' => route('studio.flow.import'),
            'publishUrl' => route('studio.flow.publish'),
            'previewBase' => url('/studio/episodes'),
            'csrf' => csrf_token(),
        ]]);
    }

    private function row(Episode $episode): array
    {
        $latest = $episode->latestVersion();

        return [
            'databaseId' => $episode->id,
            'id' => $episode->slug,
            'title' => $episode->title,
            'versionId' => $latest?->id ?? 0,
            'status' => $episode->published_version_id ? 'published' : 'draft',
            'data' => $latest?->data,
        ];
    }

    private function validatedDocument(Request $request): array
    {
        $request->validate([
            'id' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z0-9_-]+$/'],
            'title' => 'required|string|max:255',
            'document' => 'required|string|max:20000000',
        ]);
        $data = app(EpisodeDocument::class)->decode($request->string('document')->toString());
        foreach ($data['nodes'] as $id => $node) {
            if (isset($node['onScreen']) && (! is_array($node['onScreen']) || count($node['onScreen']) > 3)) {
                throw ValidationException::withMessages(['document' => "{$id} : trois personnages maximum à l’écran."]);
            }
        }

        return $data;
    }

    public function save(Request $request, EpisodeWriter $writer)
    {
        $data = $this->validatedDocument($request);
        $request->validate(['versionId' => 'required|integer|min:1']);
        $episode = Episode::where('slug', $request->input('id'))->firstOrFail();
        $writer->save($episode, $request->input('title'), $data, $request->integer('versionId'), $request->user()->id);

        return response()->json($this->row($episode->fresh()));
    }

    public function create(Request $request)
    {
        $data = $this->validatedDocument($request);
        $request->validate(['id' => 'unique:episodes,slug']);
        $episode = DB::transaction(function () use ($request, $data) {
            $episode = Episode::create([
                'slug' => $request->input('id'), 'title' => $request->input('title'),
                'position' => (Episode::max('position') ?? 0) + 1,
            ]);
            $episode->versions()->create(['number' => 1, 'data' => $data, 'created_by' => $request->user()->id]);

            return $episode;
        });

        return response()->json($this->row($episode), 201);
    }

    public function import(Request $request)
    {
        $request->validate(['episodes' => 'required|array|min:1', 'episodes.*' => 'required|array']);
        $result = DB::transaction(function () use ($request) {
            $result = [];
            $seen = [];
            foreach ($request->input('episodes') as $row) {
                if (isset($seen[$row['id'] ?? ''])) {
                    throw ValidationException::withMessages(['episodes' => 'Un épisode est présent deux fois dans cet import.']);
                }
                $seen[$row['id'] ?? ''] = true;
                $item = Request::create('/', 'POST', $row);
                $item->setUserResolver(fn () => $request->user());
                $exists = Episode::where('slug', $row['id'] ?? '')->exists();
                $response = $exists ? $this->save($item, app(EpisodeWriter::class)) : $this->create($item);
                $result[] = $response->getData(true);
            }

            return $result;
        });

        return response()->json($result);
    }

    public function publish(Request $request, EpisodeWriter $writer)
    {
        $request->validate(['id' => 'required|string', 'versionId' => 'required|integer|min:1', 'published' => 'required|boolean']);
        $episode = Episode::where('slug', $request->input('id'))->firstOrFail();
        if ($request->boolean('published')) {
            $writer->publish($episode, $request->integer('versionId'));
        } else {
            DB::transaction(function () use ($episode, $request) {
                $locked = Episode::lockForUpdate()->findOrFail($episode->id);
                if ($locked->latestVersion()?->id !== $request->integer('versionId')) {
                    throw ValidationException::withMessages(['document' => 'Une nouvelle version existe. Recharge avant de dépublier.']);
                }
                $locked->published_version_id = null;
                $locked->save();
            });
        }

        return response()->json($this->row($episode->fresh()));
    }
}
