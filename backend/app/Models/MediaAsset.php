<?php

namespace App\Models;

use App\Services\CharacterPreview;
use Illuminate\Database\Eloquent\Model;

class MediaAsset extends Model
{
    public const MAX_UPLOAD_KB = 102400;

    public const WARDROBE_IMAGE_WIDTH = 3000;

    public const WARDROBE_IMAGE_HEIGHT = 6000;

    public const CATEGORIES = [
        'backgrounds' => 'Décors',
        'illustrations' => 'Illustrations',
        'music' => 'Musiques',
        'characters' => 'Portraits et sprites',
        'wardrobe' => 'Dressing',
    ];

    protected $fillable = [
        'category', 'label', 'description', 'file_path', 'original_name',
        'mime_type', 'size', 'previous_files', 'is_archived', 'source_path', 'source_key',
        'wardrobe_slot', 'appearance_category', 'price',
    ];

    protected function casts(): array
    {
        return ['previous_files' => 'array', 'is_archived' => 'boolean', 'size' => 'integer', 'price' => 'integer'];
    }

    public function url(): string
    {
        return route('studio.media.file', $this);
    }

    public function previewUrl(bool $public = false): string
    {
        return route($public ? 'game.character-preview' : 'studio.media.preview', [
            $public ? 'id' : 'mediaAsset' => $this->id,
            'v' => app(CharacterPreview::class)->version($this),
        ]);
    }

    public function spriteUrl(): string
    {
        return route('game.character-sprite', [
            'id' => $this->id,
            'v' => app(CharacterPreview::class)->version($this, true),
        ]);
    }
}
