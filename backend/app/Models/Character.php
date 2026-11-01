<?php

namespace App\Models;

use App\Casts\NarrativeJson;
use Illuminate\Database\Eloquent\Model;

class Character extends Model
{
    protected $fillable = ['slug', 'name', 'is_player', 'is_secondary', 'data'];

    protected function casts(): array
    {
        return ['data' => NarrativeJson::class, 'is_player' => 'boolean', 'is_secondary' => 'boolean'];
    }
}
