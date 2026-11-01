<?php

namespace App\Console\Commands;

use App\Services\LocalMediaImporter;
use Illuminate\Console\Command;

class ImportLocalMedia extends Command
{
    protected $signature = 'studio:import-media {directory : Dossier assets du projet} {--link-episodes : Relier les références locales dans de nouveaux brouillons}';

    protected $description = 'Copier les médias locaux dans la bibliothèque sans modifier les originaux';

    public function handle(LocalMediaImporter $importer): int
    {
        try {
            $result = $importer->import($this->argument('directory'), $this->option('link-episodes'));
        } catch (\InvalidArgumentException|\RuntimeException $exception) {
            report($exception);
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
        $this->info("Médias ajoutés : {$result['created']}. Déjà importés : {$result['existing']}. Fichiers hors catégories ignorés : {$result['ignored']}.");
        $this->info("Nouveaux brouillons : {$result['linked']}. Références reliées : {$result['references']}.");
        foreach ($result['unresolved'] as $path) {
            $this->warn('Référence locale introuvable : '.$path);
        }
        $this->warn('Les URL Supabase ne sont pas rapprochées par nom approximatif. Les anciennes versions restent intactes.');

        return self::SUCCESS;
    }
}
