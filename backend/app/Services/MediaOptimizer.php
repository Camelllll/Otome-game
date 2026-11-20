<?php

namespace App\Services;

use App\Models\MediaAsset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\Process\Process;
use Throwable;

class MediaOptimizer
{
    public function version(MediaAsset $asset, bool $scene = false, string $size = 'display'): string
    {
        $size = $this->sizeFor($asset, $size);

        return substr(hash('sha256', $asset->file_path.'|'.$asset->updated_at?->format('U.u').'|'.$asset->category.'|'.($scene ? 'scene' : 'preview').'|'.$size.'|v2'), 0, 20);
    }

    public function response(Request $request, MediaAsset $asset, bool $private = false, bool $scene = false, string $size = 'display'): BinaryFileResponse
    {
        $disk = Storage::disk('studio');
        abort_unless($disk->exists($asset->file_path), 404, 'Fichier média introuvable.');
        $failed = false;
        try {
            $path = $this->path($asset, $scene, $size, generateAudio: false);
        } catch (Throwable $exception) {
            Log::warning("Optimisation impossible pour le média {$asset->id} ; original utilisé.", ['exception' => $exception]);
            $path = $disk->path($asset->file_path);
            $failed = true;
        }
        $mime = $path === $disk->path($asset->file_path) ? $asset->mime_type : ($asset->category === 'music' ? 'audio/mpeg' : 'image/webp');
        $response = response()->file($path, ['Content-Type' => $mime, 'X-Content-Type-Options' => 'nosniff']);
        $private = $private || $asset->category === 'illustrations';
        $audioPending = $asset->category === 'music'
            && ! is_file($disk->path('.variants/'.$asset->id.'-'.$this->version($asset, $scene, $size).'.mp3'));
        $noStore = $failed || $asset->category === 'illustrations' || $audioPending;
        $response->headers->set('Cache-Control', $noStore ? 'private, no-store' : (($private ? 'private' : 'public').', max-age=86400'));
        if ($asset->category === 'illustrations') {
            $response->headers->set('Vary', 'Authorization');
        }
        if (! $noStore) {
            $response->setEtag($this->version($asset, $scene, $size));
            $response->isNotModified($request);
        }

        return $response;
    }

    public function requestedSize(Request $request): string
    {
        return $request->validate(['size' => ['sometimes', 'string', 'in:display,compact,thumbnail']])['size'] ?? 'display';
    }

    public function path(MediaAsset $asset, bool $scene = false, string $size = 'display', bool $generateAudio = true): string
    {
        if (! in_array($size, ['display', 'compact', 'thumbnail'], true)) {
            throw new \InvalidArgumentException('Format de média invalide.');
        }
        $size = $this->sizeFor($asset, $size);
        $disk = Storage::disk('studio');
        if (! $disk->exists($asset->file_path)) {
            throw new RuntimeException("Fichier du média {$asset->id} introuvable.");
        }
        $original = $disk->path($asset->file_path);
        $audio = $asset->category === 'music';
        if (! $audio && ! in_array($asset->mime_type, ['image/png', 'image/jpeg', 'image/webp'], true)) {
            return $original;
        }

        $directory = $disk->path('.variants');
        if (! is_dir($directory) && ! @mkdir($directory, 0755, true) && ! is_dir($directory)) {
            throw new RuntimeException('Impossible de créer le dossier des aperçus.');
        }
        $target = $directory.'/'.$asset->id.'-'.$this->version($asset, $scene, $size).($audio ? '.mp3' : '.webp');
        if (is_file($target)) {
            return filesize($target) < filesize($original) ? $target : $original;
        }
        if ($audio && ! $generateAudio) {
            return $original;
        }

        $lock = fopen($directory.($audio ? '/audio.lock' : '/images.lock'), 'c');
        if ($lock === false || ! flock($lock, LOCK_EX)) {
            throw new RuntimeException("Impossible de verrouiller l'aperçu du média {$asset->id}.");
        }
        try {
            if (is_file($target)) {
                return filesize($target) < filesize($original) ? $target : $original;
            }
            if ($audio) {
                $this->audio($original, $target, $directory);

                return filesize($target) < filesize($original) ? $target : $original;
            }
            $info = getimagesize($original);
            if ($info === false || $info[0] * $info[1] > 40000000) {
                throw new RuntimeException("Image invalide ou trop grande pour l'aperçu du média {$asset->id}.");
            }
            if ($info[2] === IMAGETYPE_WEBP) {
                $header = file_get_contents($original, false, null, 0, 30);
                if ($header !== false && substr($header, 12, 4) === 'VP8X' && (ord($header[20]) & 2)) {
                    return $original;
                }
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
            $wardrobe = $asset->category === 'wardrobe';
            $maximum = match ($size) {
                'thumbnail' => $wardrobe ? 1400 : 640,
                'compact' => $asset->category === 'characters' ? 1400 : 1600,
                default => $asset->category === 'characters' ? ($scene ? 2400 : 1400) : 2560,
            };
            $scale = $wardrobe && $size !== 'thumbnail' ? 1 : min(1, $maximum / max($info[0], $info[1]));
            $preview = imagecreatetruecolor(max(1, (int) round($info[0] * $scale)), max(1, (int) round($info[1] * $scale)));
            if ($preview === false) {
                throw new RuntimeException("Impossible de créer l'aperçu du média {$asset->id}.");
            }
            imagealphablending($preview, false);
            imagesavealpha($preview, true);
            imagecopyresampled($preview, $image, 0, 0, 0, 0, imagesx($preview), imagesy($preview), $info[0], $info[1]);
            unset($image);
            $temporary = tempnam($directory, 'preview-');
            if ($temporary === false) {
                throw new RuntimeException("Impossible de créer un fichier temporaire pour le média {$asset->id}.");
            }
            try {
                $quality = $wardrobe ? IMG_WEBP_LOSSLESS : ($size === 'thumbnail' ? 78 : ($scene ? 90 : 85));
                if (! imagewebp($preview, $temporary, $quality) || ! rename($temporary, $target)) {
                    throw new RuntimeException("Impossible d'enregistrer l'aperçu du média {$asset->id}.");
                }
            } finally {
                if (is_file($temporary)) {
                    unlink($temporary);
                }
            }

            return filesize($target) < filesize($original) ? $target : $original;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function sizeFor(MediaAsset $asset, string $size): string
    {
        return $asset->category === 'music' || ($asset->category === 'wardrobe' && $size === 'compact')
            ? 'display' : $size;
    }

    private function audio(string $original, string $target, string $directory): void
    {
        $temporary = tempnam($directory, 'audio-');
        if ($temporary === false) {
            throw new RuntimeException('Impossible de créer un fichier audio temporaire.');
        }
        try {
            $process = new Process([
                'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
                '-i', $original, '-map', '0:a:0', '-vn', '-map_metadata', '-1',
                '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '2',
                '-threads', '1', '-f', 'mp3', $temporary,
            ]);
            $process->setTimeout(180)->mustRun();
            if (filesize($temporary) === 0 || ! rename($temporary, $target)) {
                throw new RuntimeException("Impossible d'enregistrer la musique optimisée.");
            }
        } finally {
            if (is_file($temporary)) {
                unlink($temporary);
            }
        }
    }
}
