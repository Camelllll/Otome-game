<?php

namespace App\Console\Commands;

use App\Models\Episode;
use App\Models\MediaAsset;
use App\Services\IllustrationAccess;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class AuditIllustrationPrivacy extends Command
{
    protected $signature = 'game:audit-illustrations';

    protected $description = 'Vérifier la préparation des illustrations privées sans modifier fichiers ni données';

    public function handle(IllustrationAccess $access): int
    {
        $missing = 0;
        $unresolved = 0;
        foreach (MediaAsset::query()->where('category', 'illustrations')->where('is_archived', false)->get() as $asset) {
            if (! Storage::disk('studio')->exists($asset->file_path)) {
                $this->error("Copie privée manquante pour le média #{$asset->id}.");
                $missing++;
            }
        }
        foreach (Episode::query()->whereNotNull('published_version_id')->with('publishedVersion')->get() as $episode) {
            foreach ($episode->publishedVersion?->data['nodes'] ?? [] as $nodeId => $node) {
                if (! empty($node['cg']) && ! $access->resolve($node['cg'])) {
                    $this->error("Illustration non importée : {$episode->slug} / {$nodeId}.");
                    $unresolved++;
                }
            }
        }
        $this->info("Copies privées manquantes : {$missing}. Références publiées non résolues : {$unresolved}.");
        $this->warn('Vérifier aussi le serveur web : bloquer assets/Illustrations (hors visuels promotionnels) et assets/media/illustrations. Les fichiers sources ne sont ni déplacés ni supprimés par cette commande.');

        return $missing + $unresolved > 0 ? self::FAILURE : self::SUCCESS;
    }
}
