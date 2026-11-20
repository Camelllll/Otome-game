<?php

namespace App\Services;

use App\Models\Character;
use App\Models\Episode;
use App\Models\Illustration;
use App\Models\MediaAsset;
use App\Models\PlayerChoice;
use App\Models\PlayerIllustration;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class IllustrationAccess
{
    public function resolve(string $path, ?Collection $assets = null): ?MediaAsset
    {
        $query = MediaAsset::query()->where('category', 'illustrations')->where('is_archived', false);
        if (preg_match('#/(?:api/(?:media|illustrations)|studio/media)/(\d+)/file(?:\?|$)#', $path, $match)) {
            if ($assets !== null) {
                return $assets->firstWhere('id', (int) $match[1]);
            }

            return $query->find((int) $match[1]);
        }
        $path = rawurldecode($path);
        if (class_exists(\Normalizer::class)) {
            $path = \Normalizer::normalize($path, \Normalizer::FORM_C) ?: $path;
        }

        return $assets !== null
            ? $assets->firstWhere('source_key', hash('sha256', $path))
            : $query->where('source_key', hash('sha256', $path))->first();
    }

    public function canView(User $user, MediaAsset $asset): bool
    {
        $rows = PlayerIllustration::query()->where('user_id', $user->id)->get();
        $assets = collect([$asset]);
        foreach ($rows as $row) {
            if ($this->resolve($row->illustration_path, $assets)) {
                return true;
            }
        }
        return false;
    }

    /** Liste les acquisitions du compte sans compter deux fois une même image. */
    public function collection(User $user): Collection
    {
        $dates = [];
        $unavailable = [];
        $assets = MediaAsset::query()->where('category', 'illustrations')->where('is_archived', false)->get();
        foreach (PlayerIllustration::query()->where('user_id', $user->id)->orderBy('acquired_at')->get() as $row) {
            $asset = $this->resolve($row->illustration_path, $assets);
            if ($asset && ! array_key_exists($asset->id, $dates)) {
                $dates[$asset->id] = $row->acquired_at?->toIso8601String();
            } elseif (! $asset) {
                $unavailable[$row->illustration_path] ??= [
                    'mediaId' => null, 'id' => null, 'path' => null, 'title' => null,
                    'characters' => [], 'characterIds' => [], 'rarity' => null,
                    'acquiredAt' => $row->acquired_at?->toIso8601String(),
                ];
            }
        }
        $metadata = Illustration::query()->whereIn('media_asset_id', array_keys($dates))->orderBy('id')->get()->keyBy('media_asset_id');
        $characters = Character::query()->get()->mapWithKeys(fn ($c) => [($c->data['id'] ?? $c->slug) => $c->name]);

        return $assets->whereIn('id', array_keys($dates))
            ->map(function ($asset) use ($dates, $metadata, $characters) {
                $meta = $metadata->get($asset->id);

                return [
                    'mediaId' => $asset->id,
                    'id' => $meta?->slug,
                    'path' => route('game.illustration-file', ['id' => $asset->id]),
                    'title' => $meta?->title ?? $asset->label,
                    'characterIds' => $meta?->character_ids ?? [],
                    'characters' => collect($meta?->character_ids ?? [])->map(fn ($id) => $characters->get($id))->filter()->values()->all(),
                    'rarity' => $meta?->rarity === 'ultra_rare' ? 'epic' : $meta?->rarity,
                    'acquiredAt' => $dates[$asset->id],
                ];
            })->concat(array_values($unavailable))->sortByDesc('acquiredAt')->values();
    }

    /**
     * Rejoue le journal avec les options publiées, jamais avec les effets/flags envoyés par le client.
     * On peut parcourir les répliques linéaires, mais pas franchir un choix absent du journal.
     */
    public function assertReachable(User $user, int $slot, string $episodeId, string $nodeId): void
    {
        $documents = Episode::query()->whereNotNull('published_version_id')->with('publishedVersion')->get()
            ->mapWithKeys(fn ($episode) => [$episode->slug => $episode->publishedVersion?->data]);
        $document = $documents->get($episodeId);
        abort_unless(is_array($document) && isset($document['nodes'][$nodeId]), 422, 'Moment publié introuvable.');
        $gauges = Character::query()->get()->mapWithKeys(fn ($c) => [($c->data['id'] ?? $c->slug) => $c->data['gauges'] ?? []])->all();
        $flags = [];
        $pointers = [];
        $visited = [];
        $journal = PlayerChoice::query()->where('user_id', $user->id)->where('slot', $slot)->orderBy('id')->get();
        foreach ($journal as $choice) {
            $doc = $documents->get($choice->episode_id);
            if (! is_array($doc)) {
                throw ValidationException::withMessages(['nodeId' => 'Un épisode du journal n’est plus publié. La progression doit être réconciliée avant ce déblocage.']);
            }
            $pointer = $pointers[$choice->episode_id] ?? $doc['start'];
            $frontier = $this->frontier($doc, $pointer, $flags, $gauges);
            if (! in_array($choice->node_id, $frontier, true)) {
                // Rejouer un épisode est autorisé, mais il faut repartir de son premier choix.
                $frontier = $this->frontier($doc, $doc['start'], $flags, $gauges);
            }
            $node = $doc['nodes'][$choice->node_id] ?? [];
            $option = $node['options'][$choice->option_index] ?? null;
            if (! in_array($choice->node_id, $frontier, true) || ($node['type'] ?? '') !== 'choice' || ! is_array($option)) {
                throw ValidationException::withMessages(['nodeId' => 'Le journal de choix ne permet pas de vérifier ce déblocage. Aucune illustration n’a été ajoutée.']);
            }
            $visited[$choice->episode_id] = array_unique([...($visited[$choice->episode_id] ?? []), ...$frontier]);
            foreach ($option['effects'] ?? [] as $id => $effects) {
                foreach ($effects as $gauge => $delta) {
                    $gauges[$id][$gauge] = max(-100, min(100, ($gauges[$id][$gauge] ?? 0) + $delta));
                }
            }
            $flags = array_unique([...$flags, ...($option['flags'] ?? [])]);
            $pointer = $option['next'] ?? '';
            $pointers[$choice->episode_id] = $pointer;
            $visited[$choice->episode_id] = array_unique([...$visited[$choice->episode_id], ...$this->frontier($doc, $pointer, $flags, $gauges)]);
        }
        $reachable = $this->frontier($document, $pointers[$episodeId] ?? $document['start'], $flags, $gauges);
        abort_unless(in_array($nodeId, [...($visited[$episodeId] ?? []), ...$reachable], true), 403, 'Cette illustration n’est pas encore accessible dans ta progression.');
    }

    private function frontier(array $document, string $start, array $flags, array $gauges): array
    {
        $queue = [$start];
        $visited = [];
        while ($queue !== []) {
            $id = array_pop($queue);
            if (isset($visited[$id]) || ! isset($document['nodes'][$id])) {
                continue;
            }
            $visited[$id] = true;
            $node = $document['nodes'][$id];
            if (($node['type'] ?? '') === 'choice' || ($node['type'] ?? '') === 'end') {
                continue;
            }
            if (($node['type'] ?? '') !== 'branch') {
                $queue[] = $node['next'] ?? '';

                continue;
            }
            $targets = [$node['fallback'] ?? ''];
            foreach ($node['branches'] ?? [] as $branch) {
                $condition = $branch['if'] ?? null;
                if (! $condition || (isset($condition['flag']) && in_array($condition['flag'], $flags, true))) {
                    $targets = [$branch['next'] ?? ''];
                    break;
                }
                if (isset($condition['topGauge'])) {
                    $gauge = $condition['topGauge']['gauge'] ?? 'amour';
                    $routes = $condition['topGauge']['routes'] ?? [];
                    if ($routes === []) {
                        continue;
                    }
                    $values = array_map(fn ($id) => $gauges[$id][$gauge] ?? 0, array_keys($routes));
                    $maximum = max($values);
                    $targets = [];
                    foreach ($routes as $character => $target) {
                        if (($gauges[$character][$gauge] ?? 0) === $maximum) {
                            $targets[] = $target;
                        }
                    }
                    break;
                }
            }
            array_push($queue, ...$targets);
        }

        return array_keys($visited);
    }
}
