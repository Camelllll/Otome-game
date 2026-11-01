<?php

namespace App\Services;

use App\Models\Episode;
use App\Models\EpisodeVersion;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EpisodeWriter
{
    public function save(Episode $episode, string $title, array $data, int $expectedVersion, ?int $author): EpisodeVersion
    {
        return DB::transaction(function () use ($episode, $title, $data, $expectedVersion, $author) {
            $locked = Episode::query()->lockForUpdate()->findOrFail($episode->id);
            $latest = $locked->latestVersion();
            if (($latest?->id ?? 0) !== $expectedVersion) {
                throw ValidationException::withMessages(['document' => 'Cet épisode a été modifié dans une autre fenêtre. Exporte tes modifications avant de recharger.']);
            }
            $locked->update(['title' => $title]);

            return $locked->versions()->create([
                'number' => ($latest?->number ?? 0) + 1,
                'data' => $data,
                'created_by' => $author,
            ]);
        });
    }

    public function publish(Episode $episode, int $versionId): void
    {
        DB::transaction(function () use ($episode, $versionId) {
            $locked = Episode::query()->lockForUpdate()->findOrFail($episode->id);
            $version = $locked->versions()->findOrFail($versionId);
            if ($locked->latestVersion()?->id !== $version->id) {
                throw ValidationException::withMessages(['document' => 'Une version plus récente existe. Recharge avant de publier.']);
            }
            $errors = app(EpisodeDocument::class)->publicationErrors($version->data);
            if ($errors) {
                throw ValidationException::withMessages(['document' => implode("\n", array_slice($errors, 0, 20))]);
            }
            $locked->published_version_id = $version->id;
            $locked->save();
        });
    }
}
