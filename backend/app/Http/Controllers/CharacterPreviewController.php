<?php

namespace App\Http\Controllers;

use App\Models\MediaAsset;
use App\Services\CharacterPreview;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class CharacterPreviewController extends Controller
{
    public function public(Request $request, int $id, CharacterPreview $previews): BinaryFileResponse
    {
        $asset = MediaAsset::query()->where('category', 'characters')->where('is_archived', false)->findOrFail($id);

        return $this->respond($request, $asset, $previews, false);
    }

    public function studio(Request $request, MediaAsset $mediaAsset, CharacterPreview $previews): BinaryFileResponse
    {
        abort_unless($mediaAsset->category === 'characters', 404);

        return $this->respond($request, $mediaAsset, $previews, true);
    }

    private function respond(Request $request, MediaAsset $asset, CharacterPreview $previews, bool $private): BinaryFileResponse
    {
        $disk = Storage::disk('studio');
        abort_unless($disk->exists($asset->file_path), 404, 'Fichier média introuvable.');
        $failed = false;
        try {
            $path = $previews->path($asset);
        } catch (Throwable $exception) {
            Log::warning("Aperçu impossible pour le média {$asset->id} ; original utilisé.", ['exception' => $exception]);
            $path = $disk->path($asset->file_path);
            $failed = true;
        }
        $response = response()->file($path, [
            'Content-Type' => $path === $disk->path($asset->file_path) ? $asset->mime_type : 'image/webp',
            'X-Content-Type-Options' => 'nosniff',
        ]);
        $response->headers->set('Cache-Control', $failed ? 'no-store' : (($private ? 'private' : 'public').', max-age=86400'));
        if (! $failed) {
            $response->setEtag($previews->version($asset));
            $response->isNotModified($request);
        }

        return $response;
    }
}
