<?php

namespace App\Casts;

use App\Services\EpisodeDocument;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

class NarrativeJson implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): mixed
    {
        return EpisodeDocument::decodeValue($value);
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
}
