<?php

namespace App\Models;

use App\Casts\NarrativeJson;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EpisodeVersion extends Model
{
    protected $fillable = ['number', 'data', 'created_by'];

    protected function casts(): array
    {
        return ['data' => NarrativeJson::class];
    }

    public function episode(): BelongsTo
    {
        return $this->belongsTo(Episode::class);
    }
}
