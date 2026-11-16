<?php

namespace Tests\Feature;

use App\Models\Character;
use App\Models\MediaAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CharacterMediaApiTest extends TestCase
{
    use RefreshDatabase;

    private function makeAsset(string $category, string $source, bool $archived = false): MediaAsset
    {
        Storage::disk('studio')->put("{$category}/test.png", 'png-bytes');

        return MediaAsset::create([
            'category' => $category,
            'label' => 'Liam',
            'file_path' => "{$category}/test.png",
            'original_name' => 'Liam.png',
            'mime_type' => 'image/png',
            'size' => 9,
            'source_path' => $source,
            'source_key' => hash('sha256', $source),
            'is_archived' => $archived,
        ]);
    }

    public function test_character_sprite_points_to_the_media_library_asset(): void
    {
        Storage::fake('studio');
        $source = 'assets/Personnages/Crushs/PNG/Liam.png';
        $asset = $this->makeAsset('characters', $source);
        Character::create(['slug' => 'liam', 'name' => 'Liam', 'data' => [
            'id' => 'liam',
            'sprite' => $source,
            'portraits' => ['default' => $source, 'autre' => 'assets/autre.png'],
        ]]);

        $response = $this->getJson('/api/characters')->assertOk();

        $this->assertStringContainsString("/api/media/{$asset->id}/file", $response->json('crushs.0.sprite'));
        $this->assertSame($response->json('crushs.0.sprite'), $response->json('crushs.0.portraits.default'));
        $this->assertSame('assets/autre.png', $response->json('crushs.0.portraits.autre'));
        $this->get("/api/media/{$asset->id}/file")->assertOk();
    }

    public function test_archived_media_is_not_used_nor_served(): void
    {
        Storage::fake('studio');
        $source = 'assets/Personnages/Crushs/PNG/Liam.png';
        $archived = $this->makeAsset('characters', $source, true);
        Character::create(['slug' => 'liam', 'name' => 'Liam', 'data' => ['id' => 'liam', 'sprite' => $source]]);

        $this->getJson('/api/characters')->assertOk()->assertJsonPath('crushs.0.sprite', $source);
        $this->get("/api/media/{$archived->id}/file")->assertNotFound();

        $illustration = $this->makeAsset('illustrations', 'assets/Illustrations/cg.png', true);
        $this->get("/api/media/{$illustration->id}/file")->assertNotFound();
    }

    public function test_active_illustration_is_not_served_publicly(): void
    {
        Storage::fake('studio');
        $illustration = $this->makeAsset('illustrations', 'assets/Illustrations/cg.png');

        $this->get("/api/media/{$illustration->id}/file")->assertNotFound();
        $this->getJson("/api/illustrations/{$illustration->id}/file")->assertUnauthorized();
    }

    public function test_background_catalogue_exposes_active_database_images_only(): void
    {
        Storage::fake('studio');
        $source = 'assets/Décors/Entrée campus.png';
        $decor = $this->makeAsset('backgrounds', $source);
        $this->makeAsset('backgrounds', 'assets/archive.png', true);
        $this->makeAsset('illustrations', 'assets/cg.png');

        $response = $this->getJson('/api/backgrounds')->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.id', $decor->id)
            ->assertJsonPath('0.sourcePath', $source);
        $this->assertStringContainsString("/api/media/{$decor->id}/file?v=", $response->json('0.image'));
    }
}
