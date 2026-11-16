<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\PlayerSaveService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActionPointsTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_preserves_existing_points_and_timestamp_without_blocking_other_changes(): void
    {
        $this->travelTo(Carbon::parse('2026-01-01 12:00:00'));
        $user = User::factory()->create();
        $service = app(PlayerSaveService::class);
        config(['game.rules.paEnabled' => true]);
        $payload = $service->defaultSave($user, 0);
        $payload['actionPoints'] = 7;
        $service->save($user, $payload, 0);
        $avant = $service->load($user, 0);

        config(['game.rules.paEnabled' => false]);
        $this->travel(30)->minutes();
        $payload['actionPoints'] = 0;
        $payload['currentNode'] = 'scene-demo';
        $service->save($user, $payload, 0);
        $apres = $service->load($user, 0);
        $this->assertSame(7, $apres['actionPoints']);
        $this->assertSame($avant['lastActionPointsTimestamp'], $apres['lastActionPointsTimestamp']);
        $this->assertSame('scene-demo', $apres['currentNode']);

        config(['game.rules.paEnabled' => true]);
        $apres['actionPoints'] = 12;
        $service->save($user, $apres, 0);
        $this->assertSame(12, $service->load($user, 0)['actionPoints']);
    }

    public function test_demo_new_save_ignores_action_point_changes(): void
    {
        config(['game.rules.paEnabled' => false]);
        $user = User::factory()->create();
        $service = app(PlayerSaveService::class);
        $payload = $service->defaultSave($user, 0);
        $payload['actionPoints'] = 0;
        $service->save($user, $payload, 0);
        $this->assertSame(25, $service->load($user, 0)['actionPoints']);
    }
}
