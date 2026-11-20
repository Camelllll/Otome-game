<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WardrobeSaveTest extends TestCase
{
    use RefreshDatabase;

    public function test_wardrobe_currency_inventory_and_equipment_survive_database_reload(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $payload = [
            'currency' => 150,
            'inventory' => ['story-item', 'wardrobe:eyes:studio-42'],
            'flags' => ['demo-dressing-pieces'],
            'appearance' => ['eyes' => 'studio-42', 'skin' => null, 'top' => null],
        ];
        $this->putJson('/api/saves/0', $payload)
            ->assertOk()
            ->assertJsonPath('appearance.eyes', 'studio-42');

        $this->getJson('/api/saves/0')->assertOk()
            ->assertJsonPath('appearance.eyes', 'studio-42')
            ->assertJsonPath('appearance.skin', null)
            ->assertJsonPath('appearance.top', null)
            ->assertJsonPath('inventory', $payload['inventory'])
            ->assertJsonPath('flags', $payload['flags'])
            ->assertJsonPath('currency', 150);

        unset($payload['appearance']);
        $this->putJson('/api/saves/0', $payload)->assertOk()
            ->assertJsonPath('appearance.eyes', 'studio-42');

        $this->putJson('/api/saves/0', $payload + ['appearance' => null])->assertOk()
            ->assertJsonPath('appearance', null)
            ->assertJsonPath('inventory', $payload['inventory'])
            ->assertJsonPath('currency', 150);
    }
}
