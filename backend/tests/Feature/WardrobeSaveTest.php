<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\PlayerSaveService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WardrobeSaveTest extends TestCase
{
    use RefreshDatabase;

    public function test_wardrobe_currency_inventory_and_equipment_survive_database_reload(): void
    {
        $user = User::factory()->create();
        $service = app(PlayerSaveService::class);
        $payload = $service->defaultSave($user, 0);
        $payload['currency'] = 150;
        $payload['inventory'] = ['story-item', 'wardrobe:eyes:verts'];
        $payload['flags'] = ['demo-dressing-pieces'];
        $payload['appearance'] = ['eyes' => 'verts', 'shoes' => null, 'bottom' => 'pantalon1-bleu'];
        $service->save($user, $payload, 0);

        $loaded = $service->load($user, 0);
        $this->assertSame(150, $loaded['currency']);
        $this->assertSame($payload['inventory'], $loaded['inventory']);
        $this->assertSame($payload['flags'], $loaded['flags']);
        $this->assertSame('verts', $loaded['appearance']['eyes']);
        $this->assertArrayHasKey('shoes', $loaded['appearance']);
        $this->assertNull($loaded['appearance']['shoes']);

        $loaded['appearance'] = null;
        $service->save($user, $loaded, 0);
        $reset = $service->load($user, 0);
        $this->assertNull($reset['appearance']);
        $this->assertSame($payload['inventory'], $reset['inventory']);
        $this->assertSame(150, $reset['currency']);
    }
}
