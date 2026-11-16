<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Episode;
use App\Models\Illustration;
use App\Models\MediaAsset;
use App\Models\PlayerIllustration;
use App\Models\PlayerSave;
use App\Services\IllustrationAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class IllustrationController extends Controller
{
    public function __construct(private readonly IllustrationAccess $access) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->access->collection($request->user()))
            ->header('Cache-Control', 'private, no-store');
    }

    public function file(Request $request, int $id): BinaryFileResponse
    {
        $asset = MediaAsset::query()->where('category', 'illustrations')->where('is_archived', false)->findOrFail($id);
        abort_unless($this->access->canView($request->user(), $asset), 404);
        $disk = Storage::disk('studio');
        abort_unless($disk->exists($asset->file_path), 404);

        return response()->file($disk->path($asset->file_path), [
            'Content-Type' => $asset->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
            'Vary' => 'Authorization',
        ])->setPrivate();
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['required', 'string', 'max:1000'],
            'episodeId' => ['required', 'string', 'max:80'],
            'nodeId' => ['required', 'string', 'max:120'],
            'slot' => ['sometimes', 'integer', 'between:0,9'],
        ]);
        $asset = $this->access->resolve($data['path']);
        abort_unless($asset, 422, 'Illustration inconnue de la médiathèque.');
        $episode = Episode::query()->where('slug', $data['episodeId'])->whereNotNull('published_version_id')->with('publishedVersion')->firstOrFail();
        $node = $episode->publishedVersion?->data['nodes'][$data['nodeId']] ?? [];
        $nodeAsset = isset($node['cg']) ? $this->access->resolve($node['cg']) : null;
        $linked = Illustration::query()->where('media_asset_id', $asset->id)->where('episode_id', $data['episodeId'])->where('unlock_node_id', $data['nodeId'])->exists();
        abort_unless($nodeAsset?->id === $asset->id || $linked, 403, 'Cette image ne correspond pas à ce moment de l’histoire.');
        $this->access->assertReachable($request->user(), $data['slot'] ?? 0, $data['episodeId'], $data['nodeId']);
        $path = '/api/illustrations/'.$asset->id.'/file';
        DB::transaction(function () use ($request, $data, $asset, $path) {
            PlayerIllustration::query()->firstOrCreate([
                'user_id' => $request->user()->id,
                'path_hash' => hash('sha256', $path),
            ], [
                'illustration_path' => $path,
                'episode_id' => $data['episodeId'],
                'node_id' => $data['nodeId'],
                'acquired_at' => now(),
            ]);
            $save = PlayerSave::query()->where('user_id', $request->user()->id)
                ->where('slot', $data['slot'] ?? 0)->lockForUpdate()->first();
            if ($save) {
                $slugs = Illustration::query()->where('media_asset_id', $asset->id)->pluck('slug')->all();
                $save->unlocked_illustration_ids = array_values(array_unique([...($save->unlocked_illustration_ids ?? []), ...$slugs]));
                $save->save();
            }
        });

        return response()->json($this->access->collection($request->user())->firstWhere('mediaId', $asset->id));
    }
}
