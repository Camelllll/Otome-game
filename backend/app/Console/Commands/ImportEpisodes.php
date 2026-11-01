<?php

namespace App\Console\Commands;

use App\Models\Episode;
use App\Services\EpisodeDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ImportEpisodes extends Command
{
    protected $signature = 'studio:import {file : Export episodes.json}';

    protected $description = 'Importer sans écrasement les épisodes exportés de Supabase, en brouillons';

    public function handle(EpisodeDocument $documents): int
    {
        $path = $this->argument('file');
        if (! is_file($path) || ! is_readable($path)) {
            $this->error('Fichier absent ou illisible.');

            return self::FAILURE;
        }
        try {
            $rows = EpisodeDocument::decodeValue(file_get_contents($path));
            if (! is_array($rows) || ! array_is_list($rows) || ! $rows) {
                throw new \InvalidArgumentException('Un tableau non vide de lignes épisodes est attendu.');
            }
            $seen = [];
            foreach ($rows as $index => $row) {
                Validator::make(is_array($row) ? $row : [], [
                    'id' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z0-9_-]+$/'],
                    'title' => 'required|string|max:255',
                    'data' => 'required|array',
                ])->validate();
                if (isset($seen[$row['id']]) || Episode::where('slug', $row['id'])->exists()) {
                    throw new \InvalidArgumentException("L'identifiant {$row['id']} existe déjà. Aucun épisode n'a été importé.");
                }
                $seen[$row['id']] = true;
                $documents->decode(json_encode($row['data'], JSON_THROW_ON_ERROR));
            }
            usort($rows, fn (array $left, array $right) => strnatcasecmp($left['id'], $right['id']));
            DB::transaction(function () use ($rows) {
                foreach ($rows as $index => $row) {
                    $episode = Episode::create(['slug' => $row['id'], 'title' => $row['title'], 'position' => $index + 1]);
                    $episode->versions()->create(['number' => 1, 'data' => $row['data']]);
                }
            });
        } catch (\JsonException|\InvalidArgumentException|ValidationException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
        $this->info(count($rows).' épisodes importés en brouillons. Les identifiants et les données narratives sont conservés.');

        return self::SUCCESS;
    }
}
