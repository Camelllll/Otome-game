<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Episode extends Model
{
    public const DEMO_SLUGS = ['episode1', 'episode2'];

    protected $fillable = ['slug', 'title', 'description', 'thumbnail_path', 'position'];

    public function scopeAvailableInGame(Builder $query): Builder
    {
        return $query->whereNotNull('published_version_id')
            ->when(config('game.demo'), fn (Builder $query) => $query->whereIn('slug', self::DEMO_SLUGS));
    }

    public function versions(): HasMany
    {
        return $this->hasMany(EpisodeVersion::class);
    }

    public function publishedVersion(): BelongsTo
    {
        return $this->belongsTo(EpisodeVersion::class, 'published_version_id');
    }

    public function latestVersion(): ?EpisodeVersion
    {
        return $this->versions()->orderByDesc('number')->first();
    }
}
