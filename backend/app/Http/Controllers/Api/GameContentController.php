<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\Episode;
use Illuminate\Http\JsonResponse;

/** Contenu du jeu en lecture seule : personnages, épisodes publiés, boutique. */
class GameContentController extends Controller
{
    private const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    public function characters(): JsonResponse
    {
        $rows = Character::query()->orderBy('id')->get(['is_player', 'is_secondary', 'data']);

        return response()->json([
            'player' => $rows->first(fn (Character $c) => $c->is_player)?->data,
            'crushs' => $rows->filter(fn (Character $c) => ! $c->is_player && ! $c->is_secondary)
                ->map(fn (Character $c) => $c->data)->values(),
            'secondary' => $rows->filter(fn (Character $c) => ! $c->is_player && $c->is_secondary)
                ->map(fn (Character $c) => $c->data)->values(),
        ], 200, [], self::JSON_FLAGS);
    }

    public function episodes(): JsonResponse
    {
        $episodes = Episode::query()
            ->whereNotNull('published_version_id')
            ->orderBy('position')
            ->orderBy('slug')
            ->get(['slug', 'title']);

        return response()->json(
            $episodes->map(fn (Episode $e) => ['id' => $e->slug, 'title' => $e->title])->values(),
            200,
            [],
            self::JSON_FLAGS
        );
    }

    public function episode(string $slug): JsonResponse
    {
        $episode = Episode::query()
            ->where('slug', $slug)
            ->whereNotNull('published_version_id')
            ->with('publishedVersion')
            ->first();

        abort_if($episode === null || $episode->publishedVersion === null, 404, "Épisode publié introuvable : $slug");

        return response()->json($episode->publishedVersion->data, 200, [], self::JSON_FLAGS);
    }

    public function shop(): JsonResponse
    {
        $shop = config('game.shop');
        $items = array_map(
            fn (array $item) => ['label' => $item['name']] + $item,
            $shop['items']
        );

        return response()->json(['currency' => $shop['currency'], 'items' => $items], 200, [], self::JSON_FLAGS);
    }
}