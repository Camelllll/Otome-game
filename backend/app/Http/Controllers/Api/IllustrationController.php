<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlayerIllustration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IllustrationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = PlayerIllustration::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('acquired_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (PlayerIllustration $i) => $this->format($i))
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

        return response()->json($this->format($illustration));
    }

    private function format(PlayerIllustration $i): array
    {
        return [
            'path' => $i->illustration_path,
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