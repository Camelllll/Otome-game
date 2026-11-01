<?php

namespace App\Services;

use App\Models\Episode;
use App\Models\MediaAsset;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class LocalMediaImporter
{
    private function canonical(string $path): string
    {
        $path = rawurldecode($path);

        return class_exists(\Normalizer::class) ? \Normalizer::normalize($path, \Normalizer::FORM_C) : $path;
    }

    public function import(string $directory, bool $linkEpisodes): array
    {
        $root = realpath($directory);
        if ($root === false || ! is_dir($root) || is_link($directory)) {
            throw new \InvalidArgumentException('Dossier assets absent, invalide ou symbolique.');
        }
        $categories = ['Décors' => 'backgrounds', 'Illustrations' => 'illustrations', 'Personnages' => 'characters', 'Musiques' => 'music'];
        $files = [];
        $ignored = 0;
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if ($file->isLink()) {
                throw new \InvalidArgumentException('Les liens symboliques ne sont pas importés.');
            }
            if (! $file->isFile()) {
                continue;
            }
            $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($root) + 1));
            $folder = explode('/', $this->canonical($relative))[0];
            $category = $categories[$folder] ?? null;
            if ($category === null) {
                $ignored++;

                continue;
            }
            $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getPathname());
            $extension = [
                'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp', 'image/gif' => 'gif',
                'audio/mpeg' => 'mp3', 'audio/wav' => 'wav', 'audio/x-wav' => 'wav', 'audio/ogg' => 'ogg', 'audio/x-m4a' => 'm4a', 'audio/mp4' => 'm4a',
            ][$mime] ?? null;
            if ($extension === null || ($category === 'music') !== str_starts_with($mime, 'audio/')) {
                throw new \InvalidArgumentException("Format de média non pris en charge : {$relative}");
            }
            if ($file->getSize() > MediaAsset::MAX_UPLOAD_KB * 1024) {
                throw new \InvalidArgumentException("Fichier supérieur à 100 Mo : {$relative}");
            }
            $files[] = ['file' => $file->getPathname(), 'relative' => $relative, 'category' => $category, 'mime' => $mime, 'extension' => $extension];
        }
        $createdPaths = [];
        try {
            return DB::transaction(function () use ($files, $linkEpisodes, $ignored, &$createdPaths) {
                $mapping = [];
                $created = 0;
                $existing = 0;
                foreach ($files as $file) {
                    $source = 'assets/'.$file['relative'];
                    $key = hash('sha256', $this->canonical($source));
                    $asset = MediaAsset::where('source_key', $key)->first();
                    if ($asset) {
                        if (! Storage::disk('studio')->exists($asset->file_path)) {
                            throw new \RuntimeException("Fichier importé manquant sur disque : {$source}");
                        }
                        $existing++;
                    } else {
                        $path = $file['category'].'/'.Str::uuid().'.'.$file['extension'];
                        $stream = fopen($file['file'], 'rb');
                        if ($stream === false) {
                            throw new \RuntimeException("Lecture impossible : {$source}");
                        }
                        $createdPaths[] = $path;
                        try {
                            Storage::disk('studio')->put($path, $stream);
                        } finally {
                            fclose($stream);
                        }
                        $asset = MediaAsset::create([
                            'category' => $file['category'],
                            'label' => pathinfo($file['relative'], PATHINFO_FILENAME),
                            'description' => 'Import local : '.$file['relative'],
                            'file_path' => $path, 'original_name' => basename($file['relative']),
                            'mime_type' => $file['mime'], 'size' => filesize($file['file']),
                            'source_path' => $source, 'source_key' => $key,
                        ]);
                        $created++;
                    }
                    $mapping[$this->canonical($source)] = $asset->url();
                }
                $linked = 0;
                $references = 0;
                $unresolved = [];
                if ($linkEpisodes) {
                    foreach (Episode::orderBy('id')->get() as $episode) {
                        $version = $episode->latestVersion();
                        if (! $version) {
                            continue;
                        }
                        $changed = 0;
                        $replace = function (array $data) use (&$replace, $mapping, &$changed, &$unresolved): array {
                            foreach ($data as $field => $value) {
                                if (is_array($value)) {
                                    $data[$field] = $replace($value);
                                } elseif (is_string($value) && in_array($field, ['background', 'cg', 'music', 'sprite'], true)) {
                                    $key = $this->canonical($value);
                                    if (isset($mapping[$key]) && $value !== $mapping[$key]) {
                                        $data[$field] = $mapping[$key];
                                        $changed++;
                                    } elseif (str_starts_with($key, 'assets/')) {
                                        $unresolved[$key] = true;
                                    }
                                }
                            }

                            return $data;
                        };
                        $data = $replace($version->data);
                        if ($changed > 0) {
                            app(EpisodeWriter::class)->save($episode, $episode->title, $data, $version->id, null);
                            $linked++;
                            $references += $changed;
                        }
                    }
                }

                return compact('created', 'existing', 'ignored', 'linked', 'references') + ['unresolved' => array_keys($unresolved)];
            });
        } catch (\Throwable $exception) {
            foreach ($createdPaths as $path) {
                Storage::disk('studio')->delete($path);
            }
            throw $exception;
        }
    }
}
