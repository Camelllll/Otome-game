<?php

namespace App\Services;

use App\Models\PlayerChoice;
use App\Models\PlayerSave;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Règles de sauvegarde côté serveur (portage des fonctions SQL game_* de Supabase).
 * Le client n'est jamais cru sur parole : jauges bornées, PA régénérés selon le temps réel,
 * tailles de tableaux plafonnées.
 */
class PlayerSaveService
{
    public const SLOT_MAX = 9;

    /** Plafonds des listes du carnet de relations (personnages rencontrés, illustrations vues). */
    public const MAX_DISCOVERED_CHARACTERS = 200;

    public const MAX_UNLOCKED_ILLUSTRATIONS = 2000;

    public static function slot(mixed $slot): int
    {
        return max(0, min(self::SLOT_MAX, (int) $slot));
    }

    private function rule(string $key): int
    {
        return (int) config("game.rules.$key");
    }

    public function find(User $user, int $slot): ?PlayerSave
    {
        return PlayerSave::query()->where('user_id', $user->id)->where('slot', $slot)->first();
    }

    /** Charge un emplacement ; renvoie une sauvegarde par défaut (non persistée) s'il est vide. */
    public function load(User $user, int $slot): array
    {
        $save = $this->find($user, $slot);

        return $save ? $this->toArray($save) : $this->defaultSave($user, $slot);
    }

    /** Résumé de tous les emplacements du joueur. */
    public function summaries(User $user): array
    {
        return PlayerSave::query()
            ->where('user_id', $user->id)
            ->orderBy('slot')
            ->get()
            ->map(fn (PlayerSave $s) => [
                'slot' => $s->slot,
                'label' => $s->label,
                'playerName' => $s->player_name,
                'currentEpisode' => $s->current_episode,
                'currentNode' => $s->current_node,
                'completedEpisodes' => $s->completed_episodes ?? [],
                'revision' => $s->revision,
                'updatedAt' => $s->updated_at?->toIso8601String(),
            ])
            ->all();
    }

    public function defaultSave(User $user, int $slot, ?string $playerName = null): array
    {
        $name = trim((string) ($playerName ?? $user->name));

        return [
            'playerId' => $user->id,
            'slot' => $slot,
            'label' => null,
            'playerName' => mb_substr($name !== '' ? $name : 'Sucrette', 0, 40),
            'appearance' => null,
            'currentEpisode' => 'episode1',
            'currentNode' => null,
            'currentBackground' => null,
            'gauges' => new \stdClass,
            'flags' => [],
            'choices' => [],
            'stats' => new \stdClass,
            'currency' => 0,
            'inventory' => [],
            'actionPoints' => $this->rule('paMax'),
            'lastActionPointsTimestamp' => Carbon::now()->getTimestamp() * 1000,
            'history' => [],
            'completedEpisodes' => [],
            'discoveredCharacterIds' => [],
            'unlockedIllustrationIds' => [],
            'revision' => 0,
            'updatedAt' => null,
        ];
    }

    /** Sérialise une sauvegarde vers le format camelCase attendu par le client. */
    public function toArray(PlayerSave $s): array
    {
        return [
            'playerId' => $s->user_id,
            'slot' => $s->slot,
            'label' => $s->label,
            'playerName' => $s->player_name,
            'currentEpisode' => $s->current_episode,
            'currentNode' => $s->current_node,
            'appearance' => $s->appearance,
            'currentBackground' => $s->current_background,
            'gauges' => $this->asObject($s->gauges),
            'flags' => $s->flags ?? [],
            'choices' => $s->choices ?? [],
            'stats' => $this->asObject($s->stats),
            'currency' => $s->currency,
            'inventory' => $s->inventory ?? [],
            'actionPoints' => $s->action_points,
            'lastActionPointsTimestamp' => $s->last_action_points_at->getTimestamp() * 1000,
            'history' => $s->history ?? [],
            'completedEpisodes' => $s->completed_episodes ?? [],
            'discoveredCharacterIds' => $s->discovered_character_ids ?? [],
            'unlockedIllustrationIds' => $s->unlocked_illustration_ids ?? [],
            'revision' => $s->revision,
            'updatedAt' => $s->updated_at?->toIso8601String(),
        ];
    }

    /** Écrit la progression après validation. Renvoie la sauvegarde telle qu'enregistrée. */
    public function save(User $user, array $payload, int $slot): PlayerSave
    {
        $paMax = $this->rule('paMax');
        $regen = max(1, $this->rule('paRegenSeconds'));

        return DB::transaction(function () use ($user, $payload, $slot, $paMax, $regen) {
            $old = PlayerSave::query()
                ->where('user_id', $user->id)
                ->where('slot', $slot)
                ->lockForUpdate()
                ->first();
            $now = Carbon::now();

            // Points d'action : la régénération est recalculée ici. Le client peut en dépenser,
            // jamais en gagner au-delà du temps réellement écoulé.
            if ($old === null) {
                $allowed = $paMax;
                $stamp = $now->copy();
            } else {
                $reference = $old->last_action_points_at->getTimestamp();
                $earned = intdiv(max(0, $now->getTimestamp() - $reference), $regen);
                $allowed = min($paMax, $old->action_points + $earned);
                $stamp = Carbon::createFromTimestamp($reference + $earned * $regen);
            }
            $requested = isset($payload['actionPoints']) && is_numeric($payload['actionPoints'])
                ? (int) $payload['actionPoints']
                : $allowed;
            $pa = max(0, min($allowed, $requested));
            // Jauge pleine : le compteur de régénération repart de maintenant.
            if ($pa >= $paMax) {
                $stamp = $now->copy();
            }

            $currency = isset($payload['currency']) && is_numeric($payload['currency']) ? (int) $payload['currency'] : 0;

            $attributes = [
                'label' => $this->text($payload['label'] ?? null, 60) ?? $old?->label,
                'player_name' => $this->text($payload['playerName'] ?? null, 40) ?? $old?->player_name ?? 'Sucrette',
                // Clé présente avec null = retour au sprite d'origine ; clé absente ou invalide = on garde l'ancienne valeur.
                'appearance' => array_key_exists('appearance', $payload) && $payload['appearance'] === null
                    ? null
                    : ($this->sanitizeAppearance($payload['appearance'] ?? null) ?? $old?->appearance),
                'current_episode' => $this->text($payload['currentEpisode'] ?? null, 80) ?? $old?->current_episode,
                'current_node' => $this->text($payload['currentNode'] ?? null, 120),
                'current_background' => $this->text($payload['currentBackground'] ?? null, 300) ?? $old?->current_background,
                'gauges' => $this->sanitizeGauges($payload['gauges'] ?? null, $old?->gauges ?? []),
                'flags' => $this->trimList($payload['flags'] ?? null, $this->rule('maxFlags')),
                'choices' => $this->trimList($payload['choices'] ?? null, $this->rule('maxChoices')),
                'stats' => $this->isMap($payload['stats'] ?? null) ? $payload['stats'] : [],
                'currency' => max(0, min($this->rule('currencyMax'), $currency)),
                'inventory' => $this->trimList($payload['inventory'] ?? null, $this->rule('maxInventory')),
                'action_points' => $pa,
                'last_action_points_at' => $stamp,
                'history' => $this->trimList($payload['history'] ?? null, $this->rule('maxHistory')),
                'completed_episodes' => $this->trimList($payload['completedEpisodes'] ?? null, $this->rule('maxCompletedEpisodes')),
                'discovered_character_ids' => $this->mergeIds($payload['discoveredCharacterIds'] ?? null, $old?->discovered_character_ids, self::MAX_DISCOVERED_CHARACTERS),
                'unlocked_illustration_ids' => $this->mergeIds($payload['unlockedIllustrationIds'] ?? null, $old?->unlocked_illustration_ids, self::MAX_UNLOCKED_ILLUSTRATIONS),
            ];

            if ($old === null) {
                $save = new PlayerSave($attributes + ['user_id' => $user->id, 'slot' => $slot, 'revision' => 1]);
            } else {
                $save = $old->fill($attributes);
                $save->revision = $old->revision + 1;
            }
            $save->save();

            return $save->refresh();
        });
    }

    /**
     * Identifiants du carnet (personnages rencontrés, illustrations vues) : on ne retire jamais une entrée
     * déjà acquise, afin qu'une sauvegarde client en retard n'efface pas le carnet.
     * Seuls des identifiants de forme sûre sont conservés, sans doublon, dans la limite du plafond.
     */
    private function mergeIds(mixed $new, mixed $old, int $max): array
    {
        $ids = is_array($old) ? $old : [];
        if (is_array($new) && array_is_list($new)) {
            $ids = [...$ids, ...$new];
        }

        $clean = array_filter(
            $ids,
            fn ($id) => is_string($id) && preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/', $id) === 1
        );

        return array_slice(array_values(array_unique($clean)), 0, $max);
    }

    private const APPEARANCE_KEYS = ['skin', 'hair', 'eyes', 'eyebrows', 'mouth', 'outfit', 'top', 'bottom', 'shoes', 'accessory'];

    /**
     * Apparence de Sucrette : ne conserve que les clés connues et des identifiants de forme sûre.
     * Le contenu exact (existence de l'élément, déblocage) est revalidé par le catalogue côté client.
     * Renvoie null si la valeur reçue n'est pas une apparence (l'appelant décide alors de conserver l'ancienne valeur).
     */
    private function sanitizeAppearance(mixed $value): ?array
    {
        if (! is_array($value)) {
            return null;
        }

        $clean = ['version' => 1];
        foreach (self::APPEARANCE_KEYS as $key) {
            $id = $value[$key] ?? null;
            $clean[$key] = is_string($id) && preg_match('/^[a-z0-9][a-z0-9-]{0,59}$/', $id) === 1 ? $id : null;
        }

        return $clean;
    }

    /** Copie une sauvegarde vers un autre emplacement (base des slots manuels). */
    public function copy(User $user, int $source, int $target, ?string $label): PlayerSave
    {
        if ($source === $target) {
            throw ValidationException::withMessages(['target' => 'La source et la cible doivent différer.']);
        }

        return DB::transaction(function () use ($user, $source, $target, $label) {
            $origin = $this->find($user, $source);
            if ($origin === null) {
                abort(404, "Emplacement $source vide.");
            }

            $destination = PlayerSave::query()
                ->where('user_id', $user->id)
                ->where('slot', $target)
                ->lockForUpdate()
                ->first();

            $attributes = $origin->only([
                'player_name', 'appearance', 'current_episode', 'current_node', 'current_background', 'gauges', 'flags', 'choices',
                'stats', 'currency', 'inventory', 'action_points', 'last_action_points_at', 'history', 'completed_episodes',
                'discovered_character_ids', 'unlocked_illustration_ids',
            ]);
            $attributes['label'] = $this->text($label, 60) ?? $destination?->label;

            if ($destination === null) {
                $copy = new PlayerSave($attributes + ['user_id' => $user->id, 'slot' => $target, 'revision' => 1]);
            } else {
                $copy = $destination->fill($attributes);
                $copy->revision = $destination->revision + 1;
            }
            $copy->save();

            return $copy->refresh();
        });
    }

    /** Nouvelle partie : vide l'emplacement et son journal de choix, puis renvoie une sauvegarde neuve. */
    public function reset(User $user, int $slot, ?string $playerName): array
    {
        DB::transaction(function () use ($user, $slot) {
            PlayerSave::query()->where('user_id', $user->id)->where('slot', $slot)->delete();
            PlayerChoice::query()->where('user_id', $user->id)->where('slot', $slot)->delete();
        });

        return $this->defaultSave($user, $slot, $playerName);
    }

    /**
     * Valide les lovomètres : entiers bornés, progression limitée par rapport aux valeurs déjà
     * enregistrées, nombre de personnages plafonné. Les personnages absents du payload gardent leurs jauges.
     */
    private function sanitizeGauges(mixed $new, array $old): array
    {
        if (! $this->isMap($new)) {
            return $old;
        }

        $min = $this->rule('gaugeMin');
        $max = $this->rule('gaugeMax');
        $delta = $this->rule('gaugeMaxDelta');
        $maxCharacters = $this->rule('maxCharacters');

        $result = [];
        $count = 0;
        foreach ($new as $character => $sheet) {
            if ($count >= $maxCharacters) {
                break;
            }
            $count++;

            if (! $this->isMap($sheet)) {
                continue;
            }

            $clean = [];
            foreach ($sheet as $gauge => $value) {
                if (! is_int($value) && ! is_float($value)) {
                    continue;
                }
                $previousValue = is_array($old[$character] ?? null) ? ($old[$character][$gauge] ?? null) : null;
                $previous = (is_int($previousValue) || is_float($previousValue)) ? (int) round($previousValue) : 0;
                // Plafond : la valeur envoyée ne peut pas dépasser l'ancienne de plus de $delta.
                $ceiling = min($max, $previous + $delta);
                $clean[$gauge] = max($min, min($ceiling, (int) round($value)));
            }

            if ($clean !== []) {
                $result[$character] = $clean;
            }
        }

        return array_replace($old, $result);
    }

    private function trimList(mixed $value, int $max): array
    {
        if (! is_array($value) || ! array_is_list($value)) {
            return [];
        }

        return count($value) <= $max ? $value : array_slice($value, -$max);
    }

    private function isMap(mixed $value): bool
    {
        return is_array($value) && ($value === [] || ! array_is_list($value));
    }

    private function text(mixed $value, int $max): ?string
    {
        if (! is_scalar($value)) {
            return null;
        }
        $value = trim((string) $value);

        return $value === '' ? null : mb_substr($value, 0, $max);
    }

    private function asObject(?array $value): array|\stdClass
    {
        return $value === null || $value === [] ? new \stdClass : $value;
    }
}