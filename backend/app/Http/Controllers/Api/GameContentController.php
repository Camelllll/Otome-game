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

    private const APPEARANCE_SLOTS = [
        'skin' => 'body',
        'hair' => 'hair-front',
        'eyes' => 'eyes',
        'eyebrows' => 'eyebrows',
        'mouth' => 'mouth',
        'top' => 'top',
        'bottom' => 'bottom',
        'shoes' => 'shoes',
        'outfit' => 'outfit',
        'accessory' => 'accessory',
    ];

    /** Les illustrations ont une route privée distincte, contrôlée pour chaque joueur. */
    public function characterMedia(int $id): BinaryFileResponse
    {
        $asset = MediaAsset::query()
            ->where('id', $id)
            ->whereIn('category', ['characters', 'backgrounds', 'music', 'wardrobe'])
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
        if (! $asset && preg_match('#/(?:api/(?:media|illustrations)|studio/media)/(\d+)/file(?:\?|$)#', $path, $match)) {
            $asset = $assets->firstWhere('id', (int) $match[1]);
        }
        if (! $asset && $byName !== null && $path !== '') {
            $asset = $byName->get($this->fileNameKey($path));
        }
        if (! $asset) {
            return $path;
        }

        return route($asset->category === 'illustrations' ? 'game.illustration-file' : 'game.character-media', ['id' => $asset->id, 'v' => $asset->updated_at?->timestamp ?? 0]);
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
            ->get(['id', 'category', 'source_key', 'updated_at'])
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
            ->availableInGame()
            ->orderBy('position')
            ->orderBy('slug')
            ->get(['slug', 'title', 'description', 'thumbnail_path', 'updated_at']);

        return response()->json(
            $episodes->map(fn (Episode $e) => [
                'id' => $e->slug,
                'title' => $e->title,
                'description' => $e->description,
                'thumbnail' => $e->thumbnail_path
                    ? route('game.episode-thumbnail', ['slug' => $e->slug, 'v' => $e->updated_at?->timestamp ?? 0])
                    : null,
            ])->values(),
            200,
            [],
            self::JSON_FLAGS
        );
    }

    public function episodeThumbnail(string $slug): BinaryFileResponse
    {
        $episode = Episode::query()
            ->where('slug', $slug)
            ->availableInGame()
            ->firstOrFail();
        $disk = Storage::disk('studio');
        abort_unless($episode->thumbnail_path && $disk->exists($episode->thumbnail_path), 404, 'Vignette introuvable.');

        return response()->file($disk->path($episode->thumbnail_path), [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    public function episode(string $slug): JsonResponse
    {
        $episode = Episode::query()
            ->where('slug', $slug)
            ->availableInGame()
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
            ->get(['id', 'category', 'source_key', 'updated_at'])
            ->keyBy(fn ($asset) => $asset->source_key ?? 'id-'.$asset->id);

        $data = $this->withMediaBackgrounds($episode->publishedVersion->data, $assets, $byName, $cgs);
        if (config('game.demo') && isset($data['nodes'])) {
            $available = Episode::query()->availableInGame()->pluck('slug')->all();
            foreach ($data['nodes'] as &$node) {
                if (isset($node['nextEpisode']) && ! in_array($node['nextEpisode'], $available, true)) {
                    $node['nextEpisode'] = null;
                }
            }
            unset($node);
        }

        return response()->json(
            $data,
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
                $url = $this->mediaUrl($value, $cgs);
                if ($value !== '' && $url === $value && ! str_contains($url, '/api/illustrations/')) {
                    $data[$key] = null;
                    $data['cgUnavailable'] = true;
                } else {
                    $data[$key] = $url;
                }
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
            ->availableInGame()
            ->with('mediaAsset:id,category,is_archived,updated_at')
            ->orderBy('id')
            ->get()
            ->filter(fn (Illustration $i) => $i->mediaAsset !== null && $i->mediaAsset->category === 'illustrations' && ! $i->mediaAsset->is_archived)
            ->map(fn (Illustration $i) => [
                'id' => $i->slug,
                'title' => $i->title,
                'image' => route('game.illustration-file', [
                    'id' => $i->mediaAsset->id,
                    'v' => $i->mediaAsset->updated_at?->timestamp ?? 0,
                ]),
                'episodeId' => $i->episode_id,
                'episodeTitle' => $i->episode_id ? ($episodeTitles[$i->episode_id] ?? null) : null,
                'characterIds' => array_values($i->character_ids ?? []),
                'unlockNodeId' => $i->unlock_node_id,
                'unlockCondition' => $i->unlock_condition,
                'spoilerLevel' => $i->spoiler_level,
                'rarity' => $i->rarity === 'ultra_rare' ? 'epic' : ($i->rarity ?? 'common'),
            ])
            ->values();

        return response()->json($rows, 200, [], self::JSON_FLAGS);
    }

    public function shop(): JsonResponse
    {
        $shop = config('game.shop');
        $items = MediaAsset::query()
            ->where('category', 'wardrobe')
            ->where('is_archived', false)
            ->orderBy('id')
            ->get(['id', 'label', 'appearance_category', 'wardrobe_slot', 'price', 'updated_at'])
            ->map(fn (MediaAsset $asset) => [
                'id' => 'studio-'.$asset->id,
                'label' => $asset->label,
                'name' => $asset->label,
                'slot' => $asset->appearance_category ?? $asset->wardrobe_slot,
                'price' => $asset->price ?? 0,
                'sprite' => route('game.character-media', [
                    'id' => $asset->id,
                    'v' => $asset->updated_at?->timestamp ?? 0,
                ]),
            ])
            ->values();

        return response()->json(['currency' => $shop['currency'], 'items' => $items], 200, [], self::JSON_FLAGS);
    }

    /** Catalogue d'apparence entièrement géré depuis le studio. */
    public function appearanceCatalogue(): JsonResponse
    {
        $items = MediaAsset::query()
            ->where('category', 'wardrobe')
            ->where('is_archived', false)
            ->orderBy('id')
            ->get(['id', 'label', 'wardrobe_slot', 'appearance_category', 'price', 'updated_at'])
            ->map(function (MediaAsset $asset) {
                $category = $asset->appearance_category ?? $asset->wardrobe_slot;
                if (! isset(self::APPEARANCE_SLOTS[$category])) {
                    return null;
                }

                $unlock = $asset->price === null
                    ? ['type' => 'default']
                    : ['type' => 'shop', 'price' => $asset->price];

                return [
                    'id' => 'studio-'.$asset->id,
                    'category' => $category,
                    'label' => $asset->label,
                    'layers' => [[
                        'slot' => self::APPEARANCE_SLOTS[$category],
                        'file' => route('game.character-media', [
                            'id' => $asset->id,
                            'v' => $asset->updated_at?->timestamp ?? 0,
                        ]),
                    ]],
                    'unlock' => $unlock,
                ];
            })
            ->filter()
            ->values();

        $defaults = array_fill_keys([
            'skin', 'hair', 'eyes', 'eyebrows', 'mouth', 'outfit', 'top', 'bottom', 'shoes', 'accessory',
        ], null);

        return response()->json([
            'version' => 2,
            'basePath' => '',
            'canvas' => ['width' => 600, 'height' => 1200],
            'base' => ['file' => ''],
            'defaults' => $defaults,
            'thumbFocus' => [
                'skin' => ['x' => 0.48, 'y' => 0.52, 'w' => 1.95],
                'hair' => ['x' => 0.444, 'y' => 0.205, 'w' => 0.55],
                'eyes' => ['x' => 0.472, 'y' => 0.151, 'w' => 0.2],
                'eyebrows' => ['x' => 0.463, 'y' => 0.142, 'w' => 0.2],
                'mouth' => ['x' => 0.49, 'y' => 0.175, 'w' => 0.2],
                'top' => ['x' => 0.48, 'y' => 0.33, 'w' => 0.55],
                'bottom' => ['x' => 0.532, 'y' => 0.626, 'w' => 1.2],
                'outfit' => ['x' => 0.48, 'y' => 0.52, 'w' => 1.95],
                'shoes' => ['x' => 0.5, 'y' => 0.85, 'w' => 0.5],
                'accessory' => ['x' => 0.48, 'y' => 0.15, 'w' => 0.5],
            ],
            'items' => $items,
        ], 200, [], self::JSON_FLAGS);
    }
}
