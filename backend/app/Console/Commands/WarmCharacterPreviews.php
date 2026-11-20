<?php

namespace App\Console\Commands;

use App\Models\MediaAsset;
use App\Services\CharacterPreview;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

class WarmCharacterPreviews extends Command
{
    protected $signature = 'studio:warm-character-previews';

    protected $description = 'Prépare les aperçus et les sprites de jeu des personnages de la médiathèque.';

    public function handle(CharacterPreview $previews): int
    {
        $failed = false;
        MediaAsset::query()->where('category', 'characters')->where('is_archived', false)
            ->orderBy('id')->each(function (MediaAsset $asset) use ($previews, &$failed) {
                try {
                    if (! Storage::disk('studio')->exists($asset->file_path)) {
                        throw new \RuntimeException('Fichier introuvable.');
                    }
                    $previews->path($asset);
                    $previews->path($asset, true);
                } catch (Throwable $exception) {
                    $failed = true;
                    $this->error("Média {$asset->id} : {$exception->getMessage()}");
                }
            });

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
