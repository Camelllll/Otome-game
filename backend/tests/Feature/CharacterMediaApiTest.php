<?php

namespace Tests\Feature;

use App\Models\Character;
use App\Models\MediaAsset;
use App\Models\User;
use App\Services\MediaOptimizer;
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

        $this->assertSame($asset->spriteUrl(), $response->json('crushs.0.sprite'));
        $this->assertStringContainsString("/api/media/{$asset->id}/preview?v=", $response->json('crushs.0.spritePreview'));
        $this->assertSame($response->json('crushs.0.sprite'), $response->json('crushs.0.portraits.default'));
        $this->assertSame('assets/autre.png', $response->json('crushs.0.portraits.autre'));
        Character::query()->update(['data' => json_encode(['id' => 'liam', 'sprite' => $asset->url()])]);
        $this->assertStringContainsString("/api/media/{$asset->id}/preview?v=", $this->getJson('/api/characters')->json('crushs.0.spritePreview'));
        Character::query()->update(['data' => json_encode(['id' => 'liam', 'sprite' => $asset->spriteUrl()])]);
        $this->getJson('/api/characters')->assertJsonPath('crushs.0.sprite', $asset->spriteUrl());
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
        $this->get("/api/media/{$archived->id}/sprite")->assertNotFound();

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

    public function test_character_previews_are_scaled_cached_and_replaced_without_changing_originals(): void
    {
        Storage::fake('studio');
        $asset = $this->makeAsset('characters', 'characters/example.png');
        $source = Storage::disk('studio')->path($asset->file_path);
        $image = imagecreatetruecolor(1600, 3200);
        imagealphablending($image, false);
        imagesavealpha($image, true);
        imagefill($image, 0, 0, imagecolorallocatealpha($image, 255, 0, 0, 127));
        imagepng($image, $source);
        $previews = app(MediaOptimizer::class);
        $paths = [];
        try {
            $response = $this->get("/api/media/{$asset->id}/preview")->assertOk()
                ->assertHeader('Content-Type', 'image/webp');
            $paths[] = $response->baseResponse->getFile()->getPathname();
            $this->assertSame([700, 1400], array_slice(getimagesize($paths[0]), 0, 2));
            $this->assertSame(127, (imagecolorat(imagecreatefromwebp($paths[0]), 0, 0) >> 24) & 0x7f);
            $this->assertSame([1600, 3200], array_slice(getimagesize($source), 0, 2));
            $this->get("/api/media/{$asset->id}/preview", ['If-None-Match' => $response->headers->get('ETag')])->assertStatus(304);

            $sprite = $this->get($asset->spriteUrl())->assertOk()->assertHeader('Content-Type', 'image/webp');
            $paths[] = $sprite->baseResponse->getFile()->getPathname();
            $this->assertSame([1200, 2400], array_slice(getimagesize($paths[1]), 0, 2));
            $this->assertSame(127, (imagecolorat(imagecreatefromwebp($paths[1]), 0, 0) >> 24) & 0x7f);
            $this->assertNotSame($response->headers->get('ETag'), $sprite->headers->get('ETag'));
            $this->get($asset->spriteUrl(), ['If-None-Match' => $sprite->headers->get('ETag')])->assertStatus(304);

            $this->get($asset->previewUrl())->assertRedirect('/login');
            $this->actingAs(User::factory()->create(['is_admin' => true]))->get($asset->previewUrl())
                ->assertOk()->assertHeader('Cache-Control', 'max-age=86400, private');
            $oldUrl = $asset->previewUrl();
            $oldSpriteUrl = $asset->spriteUrl();
            Storage::disk('studio')->put('characters/replacement.png', file_get_contents($source));
            $asset->update(['file_path' => 'characters/replacement.png']);
            $this->assertNotSame($oldUrl, $asset->previewUrl());
            $this->assertNotSame($oldSpriteUrl, $asset->spriteUrl());
            $paths[] = $previews->path($asset);
            $this->assertNotSame($paths[0], $paths[2]);
            $asset->update(['is_archived' => true]);
            $this->get("/api/media/{$asset->id}/preview")->assertNotFound();
            $this->get($asset->spriteUrl())->assertNotFound();
        } finally {
            foreach ($paths as $path) {
                if (is_file($path)) unlink($path);
            }
        }
    }

    public function test_preview_does_not_expose_illustrations(): void
    {
        Storage::fake('studio');
        $asset = $this->makeAsset('illustrations', 'illustrations/private.png');
        $this->get("/api/media/{$asset->id}/preview")->assertNotFound();
        $this->get($asset->spriteUrl())->assertNotFound();
        $this->actingAs(User::factory()->create(['is_admin' => true]))
            ->get($asset->previewUrl())->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_failed_preview_is_logged_and_original_is_not_cached(): void
    {
        Storage::fake('studio');
        $asset = $this->makeAsset('characters', 'characters/broken.png');
        \Illuminate\Support\Facades\Log::shouldReceive('warning')->once();
        $this->get("/api/media/{$asset->id}/preview")->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_large_character_preview_handles_low_memory_and_can_be_retried(): void
    {
        Storage::fake('studio');
        $asset = $this->makeAsset('characters', 'characters/large.png');
        $source = Storage::disk('studio')->path($asset->file_path);
        $image = imagecreatetruecolor(3000, 6000);
        imagepng($image, $source);
        unset($image);

        $previousLimit = ini_get('memory_limit');
        $paths = [];
        try {
            $this->assertNotFalse(ini_set('memory_limit', '128M'));
            $this->artisan('studio:warm-character-previews')
                ->expectsOutputToContain('Mémoire PHP insuffisante')
                ->assertFailed();
            \Illuminate\Support\Facades\Log::shouldReceive('warning')->once();
            $this->get("/api/media/{$asset->id}/preview")->assertOk()
                ->assertHeader('Content-Type', 'image/png')
                ->assertHeader('Cache-Control', 'no-store, private');

            $this->assertNotFalse(ini_set('memory_limit', '512M'));
            $this->artisan('studio:warm-character-previews')->assertSuccessful();
            $previews = app(MediaOptimizer::class);
            $paths = [$previews->path($asset), $previews->path($asset, true)];
            $this->assertSame([700, 1400], array_slice(getimagesize($paths[0]), 0, 2));
            $this->assertSame([1200, 2400], array_slice(getimagesize($paths[1]), 0, 2));
        } finally {
            ini_set('memory_limit', $previousLimit);
            foreach ($paths as $path) {
                if (is_file($path)) unlink($path);
            }
        }
    }
}
