<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlayerChoice extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'slot', 'episode_id', 'node_id', 'option_index', 'option_label', 'flags', 'effects', 'chosen_at',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'slot' => 'integer',
            'option_index' => 'integer',
            'flags' => 'array',
            'effects' => 'array',
            'chosen_at' => 'datetime',
        ];
    }
}