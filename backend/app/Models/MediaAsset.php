<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MediaAsset extends Model
{
    public const MAX_UPLOAD_KB = 102400;

    public const CATEGORIES = [
        'backgrounds' => 'Décors',
        'illustrations' => 'Illustrations',
        'music' => 'Musiques',
        'characters' => 'Portraits et sprites',
    ];

    protected $fillable = [
        'category', 'label', 'description', 'file_path', 'original_name',
        'mime_type', 'size', 'previous_files', 'is_archived', 'source_path', 'source_key',
    ];

    protected function casts(): array
    {
        return ['previous_files' => 'array', 'is_archived' => 'boolean', 'size' => 'integer'];
    }

    public function url(): string
    {
        return route('studio.media.file', $this);
    }
}
