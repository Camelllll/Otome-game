<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\Episode;
use App\Models\Illustration;
use App\Models\MediaAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** Contenu du jeu en lecture seule : personnages, épisodes publiés, boutique. */
class GameContentController extends Controller
{
    private const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    /** Sert une image des catégories « Portraits et sprites », « Décors » et « Illustrations » de la médiathèque (lecture publique). */
    public function characterMedia(int $id): BinaryFileResponse
    {
        $asset = MediaAsset::query()
            ->where('id', $id)
            ->whereIn('category', ['characters', 'backgrounds', 'illustrations', 'music'])
            ->where('is_archived', false)
            ->firstOrFail();
        $disk = Storage::disk('studio');
        abort_unless($disk->exists($asset->file_path), 404, 'Fichier média introuvable.');

        return response()->file($disk->path($asset->file_path), [
            'Content-Type' => $asset->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    /** Même normalisation que LocalMediaImporter::canonical(), pour retrouver la clé source_key. */
    private function canonicalPath(string $path): string
    {
        $path = rawurldecode($path);

        return class_exists(\Normalizer::class) ? (\Normalizer::normalize($path, \Normalizer::FORM_C) ?: $path) : $path;
    }

    /** Clé de repli : nom de fichier normalisé, sans dossier ni casse. */
    private function fileNameKey(string $path): string
    {
        return mb_strtolower(basename($this->canonicalPath($path)));
    }

    /** Remplace un chemin statique par l'URL du média de la médiathèque correspondant, s'il existe. */
    private function mediaUrl(string $path, Collection $assets, ?Collection $byName = null): string
    {
        $asset = $assets->get(hash('sha256', $this->canonicalPath($path)));
        if (! $asset && $byName !== null && $path !== '') {
            $asset = $byName->get($this->fileNameKey($path));
        }
        if (! $asset) {
            return $path;
        }

        return route('game.character-media', ['id' => $asset->id, 'v' => $asset->updated_at?->timestamp ?? 0]);
    }

    private function withMediaSprites(mixed $data, Collection $assets): mixed
    {
        if (! is_array($data)) {
            return $data;
        }
        if (isset($data['sprite']) && is_string($data['sprite'])) {
            $data['sprite'] = $this->mediaUrl($data['sprite'], $assets);
        }
        if (isset($data['portraits']) && is_array($data['portraits'])) {
            foreach ($data['portraits'] as $name => $path) {
                if (is_string($path)) {
                    $data['portraits'][$name] = $this->mediaUrl($path, $assets);
                }
            }
        }

        return $data;
    }

    public function characters(): JsonResponse
    {
        $rows = Character::query()->orderBy('id')->get(['is_player', 'is_secondary', 'data']);
        $assets = MediaAsset::query()
            ->where('category', 'characters')
            ->where('is_archived', false)
            ->whereNotNull('source_key')
            ->get(['id', 'source_key', 'updated_at'])
            ->keyBy('source_key');

        return response()->json([
            'player' => $this->withMediaSprites($rows->first(fn (Character $c) => $c->is_player)?->data, $assets),
            'crushs' => $rows->filter(fn (Character $c) => ! $c->is_player && ! $c->is_secondary)
                ->map(fn (Character $c) => $this->withMediaSprites($c->data, $assets))->values(),
            'secondary' => $rows->filter(fn (Character $c) => ! $c->is_player && $c->is_secondary)
                ->map(fn (Character $c) => $this->withMediaSprites($c->data, $assets))->values(),
        ], 200, [], self::JSON_FLAGS);
    }

    public function backgrounds(): JsonResponse
    {
        return response()->json(
            MediaAsset::query()
                ->where('category', 'backgrounds')
                ->where('is_archived', false)
                ->orderByDesc('updated_at')
                ->orderByDesc('id')
                ->get(['id', 'label', 'source_path', 'updated_at'])
                ->map(fn (MediaAsset $asset) => [
                    'id' => $asset->id,
                    'label' => $asset->label,
                    'sourcePath' => $asset->source_path,
                    'image' => route('game.character-media', [
                        'id' => $asset->id,
                        'v' => $asset->updated_at?->timestamp ?? 0,
                    ]),
                ]),
            200,
            [],
            self::JSON_FLAGS
        );
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

        $assets = MediaAsset::query()
            ->where('category', 'backgrounds')
            ->where('is_archived', false)
            ->whereNotNull('source_key')
            ->orderBy('updated_at')
            ->get(['id', 'source_key', 'source_path', 'updated_at']);
        // Repli : à nom de fichier égal, le décor actif le plus récent (dernier après le tri) l'emporte.
        $byName = $assets->filter(fn (MediaAsset $a) => $a->source_path !== null)
            ->keyBy(fn (MediaAsset $a) => $this->fileNameKey($a->source_path));
        $assets = $assets->keyBy('source_key');
        $cgs = MediaAsset::query()
            ->where('category', 'illustrations')
            ->where('is_archived', false)
            ->whereNotNull('source_key')
            ->get(['id', 'source_key', 'updated_at'])
            ->keyBy('source_key');

        return response()->json(
            $this->withMediaBackgrounds($episode->publishedVersion->data, $assets, $byName, $cgs),
            200,
            [],
            self::JSON_FLAGS
        );
    }

    /**
     * Extrait l'id d'asset depuis une URL de studio (ex: http://…/studio/media/70/file → 70).
     * Retourne null si l'URL ne correspond pas à ce schéma.
     */
    private function musicAssetIdFromUrl(string $value): ?int
    {
        if (preg_match('#/(?:studio/)?media/(\d+)/file#', $value, $m)) {
            return (int) $m[1];
        }

        return null;
    }

    /**
     * Remplace récursivement chaque champ « background » par l'URL du décor de la médiathèque,
     * chaque champ « cg » par l'URL de l'illustration correspondante,
     * et chaque champ « music » par l'URL publique du fichier audio.
     *
     * Ensuite, propage la musique des scènes vers leurs nœuds fils :
     * - si une scène a un champ music non vide, tous ses nodeIds qui n'ont pas
     *   leur propre music (vide ou absente) héritent de la musique de la scène.
     * - si un nœud a sa propre music, elle prend le dessus (override de scène).
     */
    private function withMediaBackgrounds(mixed $data, Collection $assets, Collection $byName, Collection $cgs): mixed
    {
        if (! is_array($data)) {
            return $data;
        }

        // Passe 1 : traitement récursif classique (backgrounds, cg, music bruts → URLs publiques).
        foreach ($data as $key => $value) {
            if ($key === 'background' && is_string($value)) {
                $data[$key] = $this->mediaUrl($value, $assets, $byName);
            } elseif ($key === 'cg' && is_string($value)) {
                $data[$key] = $this->mediaUrl($value, $cgs);
            } elseif ($key === 'music' && is_string($value) && $value !== '') {
                $assetId = $this->musicAssetIdFromUrl($value);
                if ($assetId !== null) {
                    $asset = MediaAsset::query()
                        ->where('id', $assetId)
                        ->where('category', 'music')
                        ->where('is_archived', false)
                        ->first(['id', 'updated_at']);
                    $data[$key] = $asset !== null
                        ? route('game.character-media', ['id' => $asset->id, 'v' => $asset->updated_at?->timestamp ?? 0])
                        : '';
                }
            } elseif (is_array($value)) {
                $data[$key] = $this->withMediaBackgrounds($value, $assets, $byName, $cgs);
            }
        }

        // Passe 2 : propagation scène → nœuds fils.
        // On ne le fait qu'au niveau racine de l'épisode (là où coexistent 'scenes' et 'nodes').
        if (isset($data['scenes']) && is_array($data['scenes'])
            && isset($data['nodes']) && is_array($data['nodes'])) {
            foreach ($data['scenes'] as $scene) {
                if (! is_array($scene)) {
                    continue;
                }
                $sceneMusic = $scene['music'] ?? '';
                if ($sceneMusic === '') {
                    continue; // Cette scène n'a pas de musique, rien à propager.
                }
                $nodeIds = $scene['nodeIds'] ?? [];
                foreach ($nodeIds as $nodeId) {
                    if (! isset($data['nodes'][$nodeId])) {
                        continue;
                    }
                    $nodeMusic = $data['nodes'][$nodeId]['music'] ?? '';
                    // Le nœud n'a pas de musique propre : il hérite de la scène.
                    if ($nodeMusic === '') {
                        $data['nodes'][$nodeId]['music'] = $sceneMusic;
                    }
                    // Sinon le nœud garde sa propre musique (override).
                }
            }
        }

        return $data;
    }

    /**
     * Catalogue des illustrations du carnet de relations.
     * Chaque illustration est liée explicitement à ses personnages dans le studio (section « Illustrations »).
     * Le jeu n'affiche que celles dont l'identifiant figure dans unlockedIllustrationIds de la sauvegarde.
     */
    public function illustrations(): JsonResponse
    {
        $episodeTitles = Episode::query()->pluck('title', 'slug');

        $rows = Illustration::query()
            ->with('mediaAsset:id,category,is_archived,updated_at')
            ->orderBy('id')
            ->get()
            ->filter(fn (Illustration $i) => $i->mediaAsset !== null && ! $i->mediaAsset->is_archived)
            ->map(fn (Illustration $i) => [
                'id' => $i->slug,
                'title' => $i->title,
                'image' => route('game.character-media', [
                    'id' => $i->mediaAsset->id,
                    'v' => $i->mediaAsset->updated_at?->timestamp ?? 0,
                ]),
                'episodeId' => $i->episode_id,
                'episodeTitle' => $i->episode_id ? ($episodeTitles[$i->episode_id] ?? null) : null,
                'characterIds' => array_values($i->character_ids ?? []),
                'unlockNodeId' => $i->unlock_node_id,
                'unlockCondition' => $i->unlock_condition,
                'spoilerLevel' => $i->spoiler_level,
                'rarity' => $i->rarity ?? 'common',
            ])
            ->values();

        return response()->json($rows, 200, [], self::JSON_FLAGS);
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