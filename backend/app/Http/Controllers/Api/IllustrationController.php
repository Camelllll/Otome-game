<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaAsset;
use App\Models\PlayerIllustration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class IllustrationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $assets = $this->activeAssets();
        // Tri croissant pour garder la date de premier déblocage en cas de doublon, puis ordre décroissant.
        $rows = PlayerIllustration::query()
            ->where('user_id', $request->user()->id)
            ->orderBy('acquired_at')
            ->orderBy('id')
            ->get()
            ->map(fn (PlayerIllustration $i) => $this->format($i, $assets))
            ->unique('path')
            ->reverse()
            ->values()
            ->all();

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:1000'],
            'episodeId' => ['nullable', 'string', 'max:500'],
            'nodeId' => ['nullable', 'string', 'max:500'],
        ]);

        $path = trim($data['path']);
        if ($path === '') {
            return response()->json(['message' => 'Chemin d\'illustration absent.'], 422);
        }

        // Le jeu envoie l'URL de la médiathèque (avec un paramètre de version qui change à chaque remplacement).
        // On enregistre l'identifiant stable de l'illustration : son chemin d'origine, ou à défaut son URL sans version.
        $assets = $this->activeAssets();
        $asset = $this->resolve($path, $assets);
        if ($asset) {
            $path = $asset->source_path ?: '/api/media/'.$asset->id.'/file';
        }

        $illustration = PlayerIllustration::query()->firstOrNew([
            'user_id' => $request->user()->id,
            'path_hash' => hash('sha256', $path),
        ]);

        $illustration->illustration_path = $illustration->illustration_path ?? $path;
        $illustration->acquired_at = $illustration->acquired_at ?? now();
        // L'épisode et le nœud d'origine ne sont renseignés qu'une fois (premier déblocage).
        $illustration->episode_id ??= $this->limit($data['episodeId'] ?? null, 80);
        $illustration->node_id ??= $this->limit($data['nodeId'] ?? null, 120);
        $illustration->save();

        return response()->json($this->format($illustration, $assets));
    }

    /** @return Collection<int, MediaAsset> */
    private function activeAssets(): Collection
    {
        return MediaAsset::query()
            ->where('category', 'illustrations')
            ->where('is_archived', false)
            ->get(['id', 'label', 'source_path', 'source_key', 'updated_at']);
    }

    /** Retrouve l'illustration de la médiathèque désignée par une URL /api/media/{id}/file ou par un chemin d'origine. */
    private function resolve(string $path, Collection $assets): ?MediaAsset
    {
        if (preg_match('#/api/media/(\d+)/file#', $path, $match)) {
            return $assets->firstWhere('id', (int) $match[1]);
        }

        return $assets->firstWhere('source_key', hash('sha256', $this->canonicalPath($path)));
    }

    /** Même normalisation que LocalMediaImporter::canonical(), pour retrouver la clé source_key. */
    private function canonicalPath(string $path): string
    {
        $path = rawurldecode($path);

        return class_exists(\Normalizer::class) ? (\Normalizer::normalize($path, \Normalizer::FORM_C) ?: $path) : $path;
    }

    private function format(PlayerIllustration $i, Collection $assets): array
    {
        $asset = $this->resolve($i->illustration_path, $assets);

        return [
            'path' => $asset
                ? route('game.character-media', ['id' => $asset->id, 'v' => $asset->updated_at?->timestamp ?? 0])
                : $i->illustration_path,
            'title' => $asset?->label,
            'episodeId' => $i->episode_id,
            'nodeId' => $i->node_id,
            'acquiredAt' => $i->acquired_at?->toIso8601String(),
        ];
    }

    private function limit(?string $value, int $max): ?string
    {
        $value = $value === null ? '' : trim($value);

        return $value === '' ? null : mb_substr($value, 0, $max);
    }
}