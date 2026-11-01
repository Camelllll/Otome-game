<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlayerIllustration extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'illustration_path', 'path_hash', 'episode_id', 'node_id', 'acquired_at'];

    protected function casts(): array
    {
        return ['user_id' => 'integer', 'acquired_at' => 'datetime'];
    }
}