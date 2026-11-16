<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\PlayerChoice;
use App\Models\PlayerSave;
use App\Services\IllustrationAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function stats(Request $request, IllustrationAccess $illustrations): JsonResponse
    {
        $user = $request->user();
        $saves = PlayerSave::query()->where('user_id', $user->id)->get();
        $best = null;
        $crushes = Character::query()->where('is_player', false)->where('is_secondary', false)->get();
        $choices = PlayerChoice::query()->where('user_id', $user->id)->orderBy('id')->get()->groupBy('slot');
        foreach ($crushes as $crush) {
            $id = $crush->data['id'] ?? $crush->slug;
            // Inclut les maxima du journal : une affinité peut avoir baissé depuis.
            $values = $saves->map(fn (PlayerSave $save) => $save->gauges[$id]['amour'] ?? null)
                ->filter(fn ($value) => is_numeric($value))->values()->all();
            foreach ($choices as $slotChoices) {
                $current = $crush->data['gauges']['amour'] ?? 0;
                foreach ($slotChoices as $choice) {
                    $delta = $choice->effects[$id]['amour'] ?? null;
                    if (is_numeric($delta)) {
                        $current = max(-100, min(100, $current + $delta));
                        $values[] = $current;
                    }
                }
            }
            if ($values !== []) {
                $maximum = max($values);
                if ($best === null || $maximum > $best['valeur']) {
                    $best = ['valeur' => $maximum, 'personnage' => $crush->name, 'personnageId' => $id];
                }
            }
        }

        return response()->json([
            'partiesCommencees' => $saves->whereNotNull('current_node')->count(),
            'chapitresTermines' => $saves->flatMap(fn ($s) => $s->completed_episodes ?? [])->unique()->count(),
            'bonnesReponses' => null,
            'illustrationsDebloquees' => $illustrations->collection($user)->count(),
            'meilleurLovometre' => $best,
            'succesDebloques' => null,
        ])->header('Cache-Control', 'private, no-store');
    }
}
