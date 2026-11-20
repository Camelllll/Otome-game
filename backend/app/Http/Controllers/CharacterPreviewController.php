<?php

namespace App\Http\Controllers;

use App\Models\MediaAsset;
use App\Services\MediaOptimizer;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class CharacterPreviewController extends Controller
{
    public function public(Request $request, int $id, MediaOptimizer $previews): BinaryFileResponse
    {
        $asset = MediaAsset::query()->where('category', 'characters')->where('is_archived', false)->findOrFail($id);

        return $previews->response($request, $asset, size: $previews->requestedSize($request));
    }

    public function studio(Request $request, MediaAsset $mediaAsset, MediaOptimizer $previews): BinaryFileResponse
    {
        abort_unless(in_array($mediaAsset->category, ['characters', 'backgrounds', 'illustrations', 'wardrobe'], true), 404);

        return $previews->response($request, $mediaAsset, private: true, size: 'thumbnail');
    }

    public function sprite(Request $request, int $id, MediaOptimizer $previews): BinaryFileResponse
    {
        $asset = MediaAsset::query()->where('category', 'characters')->where('is_archived', false)->findOrFail($id);

        return $previews->response($request, $asset, scene: true, size: $previews->requestedSize($request));
    }
}
