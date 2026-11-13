<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlayerSave extends Model
{
    protected $fillable = [
        'user_id', 'slot', 'label', 'player_name', 'appearance', 'current_episode', 'current_node', 'current_background',
        'gauges', 'flags', 'choices', 'stats', 'currency', 'inventory', 'action_points',
        'last_action_points_at', 'history', 'completed_episodes',
        'discovered_character_ids', 'unlocked_illustration_ids', 'revision',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'slot' => 'integer',
            'appearance' => 'array',
            'gauges' => 'array',
            'flags' => 'array',
            'choices' => 'array',
            'stats' => 'array',
            'currency' => 'integer',
            'inventory' => 'array',
            'action_points' => 'integer',
            'last_action_points_at' => 'datetime',
            'history' => 'array',
            'completed_episodes' => 'array',
            'discovered_character_ids' => 'array',
            'unlocked_illustration_ids' => 'array',
            'revision' => 'integer',
        ];
    }
}