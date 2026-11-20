<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Illustration (CG) rattachée explicitement à un ou plusieurs personnages.
 * La liaison est toujours choisie dans le studio : rien n'est deviné à partir du nom de fichier.
 */
class Illustration extends Model
{
    public const CONDITION_VIEWED = 'viewed';

    public const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra_rare'];

    protected $fillable = [
        'slug', 'title', 'media_asset_id', 'episode_id', 'character_ids',
        'unlock_node_id', 'unlock_condition', 'spoiler_level', 'rarity',
    ];

    protected function casts(): array
    {
        return ['character_ids' => 'array', 'spoiler_level' => 'integer'];
    }

    public function scopeAvailableInGame(Builder $query): Builder
    {
        return $query->when(config('game.demo'), fn (Builder $query) => $query
            ->where(fn (Builder $query) => $query->whereNull('episode_id')
                ->orWhereIn('episode_id', Episode::query()->availableInGame()->select('slug'))));
    }

    public function mediaAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class);
    }
}
