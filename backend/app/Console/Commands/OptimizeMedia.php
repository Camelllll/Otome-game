<?php

namespace App\Console\Commands;

use App\Models\MediaAsset;
use App\Services\MediaOptimizer;
use Illuminate\Console\Command;
use Throwable;

class OptimizeMedia extends Command
{
    protected $signature = 'studio:optimize-media';

    protected $description = 'Prépare les images et musiques optimisées sans modifier les originaux.';

    public function handle(MediaOptimizer $optimizer): int
    {
        $failed = 0;
        foreach (MediaAsset::query()->where('is_archived', false)->lazyById(50) as $asset) {
            try {
                if ($asset->category === 'music') {
                    $optimizer->path($asset);
                } else {
                    $scene = $asset->category === 'characters';
                    $optimizer->path($asset, $scene);
                    $optimizer->path($asset, $scene, 'compact');
                    $optimizer->path($asset, size: 'thumbnail');
                    if ($scene) {
                        $optimizer->path($asset);
                        $optimizer->path($asset, size: 'compact');
                    }
                }
                $this->line("Média {$asset->id} prêt : {$asset->label}");
            } catch (Throwable $exception) {
                $failed++;
                $this->error("Média {$asset->id} : {$exception->getMessage()}");
            }
        }
        $this->info("Préparation terminée. Erreurs : {$failed}.");

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
