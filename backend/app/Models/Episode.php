<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Episode extends Model
{
    protected $fillable = ['slug', 'title', 'description', 'thumbnail_path', 'position'];

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
