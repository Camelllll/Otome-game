<?php

namespace App\Services;

use App\Models\MediaAsset;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class CharacterPreview
{
    public function version(MediaAsset $asset, bool $scene = false): string
    {
        return substr(hash('sha256', $asset->file_path.'|'.$asset->updated_at?->format('U.u').($scene ? '|scene-v1' : '|v1')), 0, 20);
    }

    public function path(MediaAsset $asset, bool $scene = false): string
    {
        $disk = Storage::disk('studio');
        $original = $disk->path($asset->file_path);
        if (! in_array($asset->mime_type, ['image/png', 'image/jpeg', 'image/webp'], true)) {
            return $original;
        }

        $directory = storage_path('app/character-previews');
        if (! is_dir($directory) && ! @mkdir($directory, 0755, true) && ! is_dir($directory)) {
            throw new RuntimeException('Impossible de créer le dossier des aperçus.');
        }
        $target = $directory.'/'.$asset->id.'-'.$this->version($asset, $scene).'.webp';
        if (is_file($target)) {
            return $target;
        }

        $lock = fopen($directory.'/generation.lock', 'c');
        if ($lock === false || ! flock($lock, LOCK_EX)) {
            throw new RuntimeException("Impossible de verrouiller l'aperçu du média {$asset->id}.");
        }
        try {
            if (is_file($target)) {
                return $target;
            }
            $info = getimagesize($original);
            if ($info === false || $info[0] * $info[1] > 40000000) {
                throw new RuntimeException("Image invalide ou trop grande pour l'aperçu du média {$asset->id}.");
            }
            $limit = ini_parse_quantity(ini_get('memory_limit'));
            $required = memory_get_usage(true) + $info[0] * $info[1] * 8 + 32 * 1024 * 1024;
            if ($limit >= 0 && $required > $limit) {
                throw new RuntimeException("Mémoire PHP insuffisante pour l'aperçu du média {$asset->id} ; augmenter memory_limit.");
            }
            $image = match ($info[2]) {
                IMAGETYPE_PNG => imagecreatefrompng($original),
                IMAGETYPE_JPEG => imagecreatefromjpeg($original),
                IMAGETYPE_WEBP => imagecreatefromwebp($original),
                default => false,
            };
            if ($image === false) {
                throw new RuntimeException("Impossible de décoder le média {$asset->id}.");
            }
            $scale = min(1, ($scene ? 2400 : 1400) / max($info[0], $info[1]));
            $preview = imagecreatetruecolor(max(1, (int) round($info[0] * $scale)), max(1, (int) round($info[1] * $scale)));
            if ($preview === false) {
                throw new RuntimeException("Impossible de créer l'aperçu du média {$asset->id}.");
            }
            imagealphablending($preview, false);
            imagesavealpha($preview, true);
            imagecopyresampled($preview, $image, 0, 0, 0, 0, imagesx($preview), imagesy($preview), $info[0], $info[1]);
            $temporary = tempnam($directory, 'preview-');
            if ($temporary === false) {
                throw new RuntimeException("Impossible de créer un fichier temporaire pour le média {$asset->id}.");
            }
            try {
                if (! imagewebp($preview, $temporary, $scene ? 90 : 82) || ! rename($temporary, $target)) {
                    throw new RuntimeException("Impossible d'enregistrer l'aperçu du média {$asset->id}.");
                }
            } finally {
                if (is_file($temporary)) {
                    unlink($temporary);
                }
            }

            return $target;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
