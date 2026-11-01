<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

class EpisodeDocument
{
    public static function decodeValue(string $json): mixed
    {
        $convert = function (mixed $value) use (&$convert): mixed {
            if ($value instanceof \stdClass) {
                $properties = get_object_vars($value);

                // Preserve {} distinctly from [] when migrating narrative documents.
                return $properties === [] ? $value : array_map($convert, $properties);
            }

            return is_array($value) ? array_map($convert, $value) : $value;
        };

        return $convert(json_decode($json, false, 512, JSON_THROW_ON_ERROR));
    }

    public function decode(string $json): array
    {
        try {
            $data = self::decodeValue($json);
        } catch (\JsonException $exception) {
            throw ValidationException::withMessages(['document' => 'JSON invalide : '.$exception->getMessage()]);
        }

        if (! is_array($data) || array_is_list($data) || ! isset($data['nodes']) || ! is_array($data['nodes']) || ! $data['nodes'] || array_is_list($data['nodes'])) {
            throw ValidationException::withMessages(['document' => 'Un épisode doit contenir un objet nodes non vide.']);
        }
        foreach ($data['nodes'] as $id => $node) {
            if (! is_array($node) || ! isset($node['type']) || ! is_string($node['type'])) {
                throw ValidationException::withMessages(['document' => "Le nœud {$id} doit contenir un type."]);
            }
            foreach (['text', 'speaker', 'next', 'fallback'] as $field) {
                if (isset($node[$field]) && ! is_string($node[$field])) {
                    throw ValidationException::withMessages(['document' => "Le champ {$field} du nœud {$id} doit être du texte."]);
                }
            }
        }

        return $data;
    }

    public function publicationErrors(array $data): array
    {
        $errors = [];
        $nodes = $data['nodes'];
        $checkTarget = function (mixed $target, string $source) use ($nodes, &$errors): void {
            if (! is_string($target) || ! isset($nodes[$target])) {
                $errors[] = "{$source} : destination absente ou inconnue.";
            }
        };
        $checkTarget($data['start'] ?? null, 'Point de départ');
        foreach ($nodes as $id => $node) {
            $type = $node['type'];
            if (! in_array($type, ['line', 'choice', 'branch', 'end'], true)) {
                $errors[] = "{$id} : type de nœud inconnu.";
            }
            if (isset($node['next']) && $node['next'] !== '') {
                $checkTarget($node['next'], $id);
            } elseif ($type === 'line') {
                $errors[] = "{$id} : le dialogue doit avoir une suite.";
            }
            if ($type === 'choice') {
                if (empty($node['options']) || ! is_array($node['options'])) {
                    $errors[] = "{$id} : ajoute au moins une option.";
                } else {
                    foreach ($node['options'] as $option) {
                        $checkTarget(is_array($option) ? ($option['next'] ?? null) : null, "{$id} (choix)");
                    }
                }
            }
            if ($type === 'branch') {
                if (isset($node['fallback'])) {
                    $checkTarget($node['fallback'], "{$id} (fallback)");
                }
                if (empty($node['branches']) || ! is_array($node['branches'])) {
                    $errors[] = "{$id} : ajoute au moins une branche.";
                } else {
                    foreach ($node['branches'] as $branch) {
                        if (! is_array($branch)) {
                            $errors[] = "{$id} : branche invalide.";

                            continue;
                        }
                        $condition = $branch['if'] ?? null;
                        if ($condition instanceof \stdClass && get_object_vars($condition) === []) {
                            $condition = [];
                        }
                        if ($condition !== null && ! is_array($condition)) {
                            $errors[] = "{$id} : condition invalide.";

                            continue;
                        }
                        $topGauge = $condition['topGauge'] ?? null;
                        if ($topGauge !== null && (! is_array($topGauge) || ! isset($topGauge['routes']) || ! is_array($topGauge['routes']) || ! $topGauge['routes'])) {
                            $errors[] = "{$id} : routes de jauge invalides.";

                            continue;
                        }
                        if ($topGauge !== null) {
                            foreach ($topGauge['routes'] as $target) {
                                $checkTarget($target, "{$id} (route)");
                            }
                        } else {
                            $checkTarget($branch['next'] ?? null, "{$id} (branche)");
                        }
                    }
                }
            }
        }

        return array_values(array_unique($errors));
    }
}
