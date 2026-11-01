<?php

namespace App\Console\Commands;

use App\Models\Character;
use App\Services\EpisodeDocument;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ImportCharacters extends Command
{
    protected $signature = 'studio:import-characters {file : Export JSON des lignes characters}';

    protected $description = 'Importer le catalogue commun des personnages sans écraser les fiches existantes';

    public function handle(): int
    {
        $path = $this->argument('file');
        if (! is_file($path) || ! is_readable($path)) {
            $this->error('Fichier absent ou illisible.');

            return self::FAILURE;
        }
        try {
            $rows = EpisodeDocument::decodeValue(file_get_contents($path));
            if (! is_array($rows) || ! array_is_list($rows) || ! $rows) {
                throw new \InvalidArgumentException('Un tableau non vide de fiches est attendu.');
            }
            $seen = [];
            foreach ($rows as $row) {
                Validator::make(is_array($row) ? $row : [], [
                    'id' => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z0-9_-]+$/'],
                    'is_player' => 'required|boolean',
                    'is_secondary' => 'required|boolean',
                    'data' => 'required|array',
                    'data.name' => 'sometimes|nullable|string|max:255',
                ])->validate();
                if (isset($seen[$row['id']])) {
                    throw new \InvalidArgumentException('Identifiant répété : '.$row['id']);
                }
                $seen[$row['id']] = true;
            }
            $created = 0;
            DB::transaction(function () use ($rows, &$created) {
                foreach ($rows as $row) {
                    $character = Character::firstOrCreate(['slug' => $row['id']], [
                        'name' => trim($row['data']['name'] ?? '') ?: ($row['is_player'] ? 'Héroïne' : $row['id']),
                        'is_player' => $row['is_player'],
                        'is_secondary' => $row['is_secondary'],
                        'data' => $row['data'],
                    ]);
                    $created += (int) $character->wasRecentlyCreated;
                }
            });
        } catch (\JsonException|\InvalidArgumentException|ValidationException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
        $this->info("Personnages ajoutés : {$created}. Fiches déjà présentes conservées : ".(count($rows) - $created).'.');

        return self::SUCCESS;
    }
}
