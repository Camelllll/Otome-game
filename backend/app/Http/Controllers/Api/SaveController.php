<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Episode;
use App\Models\PlayerChoice;
use App\Services\PlayerSaveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaveController extends Controller
{
    public function __construct(private readonly PlayerSaveService $saves) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->saves->summaries($request->user()));
    }

    public function show(Request $request, int $slot): JsonResponse
    {
        return response()->json($this->saves->load($request->user(), PlayerSaveService::slot($slot)));
    }

    public function update(Request $request, int $slot): JsonResponse
    {
        $payload = $request->validate([
            'label' => ['nullable', 'string', 'max:500'],
            // Ancien client : le champ reste accepté, mais le nom vient uniquement du compte.
            'playerName' => ['nullable', 'string', 'max:500'],
            'appearance' => ['sometimes', 'nullable', 'array'],
            'currentEpisode' => ['nullable', 'string', 'max:500'],
            'currentNode' => ['nullable', 'string', 'max:500'],
            'currentBackground' => ['nullable', 'string', 'max:2000'],
            'gauges' => ['nullable', 'array'],
            'flags' => ['nullable', 'array'],
            'choices' => ['nullable', 'array'],
            'stats' => ['nullable', 'array'],
            'inventory' => ['nullable', 'array'],
            'history' => ['nullable', 'array'],
            'completedEpisodes' => ['nullable', 'array'],
            'discoveredCharacterIds' => ['nullable', 'array'],
            'unlockedIllustrationIds' => ['nullable', 'array'],
            'currency' => ['nullable', 'numeric'],
            'actionPoints' => ['nullable', 'numeric'],
        ]);

        $save = $this->saves->save($request->user(), $payload, PlayerSaveService::slot($slot));

        return response()->json($this->saves->toArray($request->user(), $save));
    }

    public function copy(Request $request, int $slot): JsonResponse
    {
        $data = $request->validate([
            'target' => ['required', 'integer', 'between:0,'.PlayerSaveService::SLOT_MAX],
            'label' => ['nullable', 'string', 'max:500'],
        ]);

        $save = $this->saves->copy(
            $request->user(),
            PlayerSaveService::slot($slot),
            (int) $data['target'],
            $data['label'] ?? null
        );

        return response()->json($this->saves->toArray($request->user(), $save));
    }

    public function reset(Request $request, int $slot): JsonResponse
    {
        $request->validate(['playerName' => ['nullable', 'string', 'max:500']]);

        return response()->json(
            $this->saves->reset($request->user(), PlayerSaveService::slot($slot))
        );
    }

    public function choices(Request $request, int $slot): JsonResponse
    {
        $limit = max(1, min(1000, (int) $request->query('limit', 200)));

        $rows = PlayerChoice::query()
            ->where('user_id', $request->user()->id)
            ->where('slot', PlayerSaveService::slot($slot))
            ->orderByDesc('chosen_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (PlayerChoice $c) => [
                'id' => $c->id,
                'episodeId' => $c->episode_id,
                'nodeId' => $c->node_id,
                'optionIndex' => $c->option_index,
                'optionLabel' => $c->option_label,
                'flags' => $c->flags ?? [],
                'effects' => $c->effects === [] || $c->effects === null ? new \stdClass : $c->effects,
                'chosenAt' => $c->chosen_at?->toIso8601String(),
            ])
            ->all();

        return response()->json($rows);
    }

    public function recordChoice(Request $request, int $slot): JsonResponse
    {
        $data = $request->validate([
            'episodeId' => ['required', 'string', 'max:80'],
            'nodeId' => ['required', 'string', 'max:120'],
            'optionIndex' => ['required', 'integer', 'min:0'],
            'optionLabel' => ['nullable', 'string', 'max:2000'],
            'flags' => ['nullable', 'array'],
            'effects' => ['nullable', 'array'],
        ]);

        $episode = Episode::query()->where('slug', $data['episodeId'])->availableInGame()->with('publishedVersion')->firstOrFail();
        $node = $episode->publishedVersion?->data['nodes'][$data['nodeId']] ?? [];
        $option = $node['options'][$data['optionIndex']] ?? null;
        abort_unless(($node['type'] ?? '') === 'choice' && is_array($option), 422, 'Ce choix ne correspond pas à une option publiée.');
        $flags = $option['flags'] ?? [];
        $effects = $option['effects'] ?? [];

        $choice = PlayerChoice::create([
            'user_id' => $request->user()->id,
            'slot' => PlayerSaveService::slot($slot),
            'episode_id' => $this->limit($data['episodeId'] ?? null, 80),
            'node_id' => $this->limit($data['nodeId'] ?? null, 120),
            'option_index' => $data['optionIndex'] ?? null,
            'option_label' => $this->limit($option['text'] ?? null, 300),
            'flags' => array_is_list($flags) ? $flags : [],
            'effects' => ($effects === [] || ! array_is_list($effects)) ? $effects : [],
            'chosen_at' => now(),
        ]);

        return response()->json([
            'id' => $choice->id,
            'episodeId' => $choice->episode_id,
            'nodeId' => $choice->node_id,
            'optionIndex' => $choice->option_index,
        ], 201);
    }

    private function limit(?string $value, int $max): ?string
    {
        $value = $value === null ? '' : trim($value);

        return $value === '' ? null : mb_substr($value, 0, $max);
    }
}
