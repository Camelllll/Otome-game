<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Services\MediaOptimizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class MediaOptimizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('studio');
    }

    private function image(string $category, int $width, int $height): MediaAsset
    {
        $image = imagecreatetruecolor($width, $height);
        imagealphablending($image, false);
        imagesavealpha($image, true);
        imagefill($image, 0, 0, imagecolorallocatealpha($image, 91, 157, 213, 63));
        imagesetpixel($image, 3, 5, imagecolorallocatealpha($image, 200, 30, 90, 12));
        $path = "{$category}/example.png";
        Storage::disk('studio')->put($path, '');
        imagepng($image, Storage::disk('studio')->path($path), 0);

        return MediaAsset::create([
            'category' => $category, 'label' => 'Exemple', 'file_path' => $path,
            'original_name' => 'example.png',
            'mime_type' => 'image/png', 'size' => filesize(Storage::disk('studio')->path($path)),
        ]);
    }

    public function test_background_has_bounded_variants_and_reuses_versioned_cache(): void
    {
        $asset = $this->image('backgrounds', 2800, 1800);
        $source = Storage::disk('studio')->path($asset->file_path);
        $originalHash = hash_file('sha256', $source);
        foreach (['display' => [2560, 1646], 'compact' => [1600, 1029], 'thumbnail' => [640, 411]] as $size => $dimensions) {
            $response = $this->get($asset->gameUrl().'&size='.$size)->assertOk()->assertHeader('Content-Type', 'image/webp');
            $path = $response->baseResponse->getFile()->getPathname();
            $this->assertSame($dimensions, array_slice(getimagesize($path), 0, 2));
            $this->assertLessThan(filesize($source) / 10, filesize($path));
            $this->get($asset->gameUrl().'&size='.$size, ['If-None-Match' => $response->headers->get('ETag')])->assertStatus(304);
        }
        $this->assertSame($originalHash, hash_file('sha256', $source));
        $this->getJson($asset->gameUrl().'&size=999999')->assertUnprocessable();
    }

    public function test_wardrobe_display_is_pixel_exact_and_thumbnail_does_not_replace_it(): void
    {
        $asset = $this->image('wardrobe', 800, 1600);
        $optimizer = app(MediaOptimizer::class);
        $original = imagecreatefrompng(Storage::disk('studio')->path($asset->file_path));
        $path = $optimizer->path($asset);
        $decoded = imagecreatefromwebp($path);
        $this->assertSame([800, 1600], [imagesx($decoded), imagesy($decoded)]);
        foreach ([[0, 0], [3, 5], [799, 1599]] as [$x, $y]) {
            $this->assertSame(imagecolorat($original, $x, $y), imagecolorat($decoded, $x, $y));
        }
        $thumbnail = $optimizer->path($asset, size: 'thumbnail');
        $this->assertSame([700, 1400], array_slice(getimagesize($thumbnail), 0, 2));
        $this->assertNotSame($thumbnail, $path);
    }

    public function test_audio_is_compressed_during_preparation_not_during_player_requests(): void
    {
        Storage::disk('studio')->put('music/example.wav', '');
        $source = Storage::disk('studio')->path('music/example.wav');
        (new Process(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
            '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-ar', '44100', '-ac', '2', $source]))
            ->setTimeout(30)->mustRun();
        $asset = MediaAsset::create([
            'category' => 'music', 'label' => 'Musique', 'file_path' => 'music/example.wav',
            'original_name' => 'example.wav',
            'mime_type' => 'audio/wav', 'size' => filesize($source),
        ]);
        $this->get($asset->gameUrl())->assertOk()->assertHeader('Content-Type', 'audio/wav')
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->artisan('studio:optimize-media')->assertSuccessful();
        $response = $this->get($asset->gameUrl())->assertOk()->assertHeader('Content-Type', 'audio/mpeg');
        $this->assertLessThan(filesize($source) / 3, $response->baseResponse->getFile()->getSize());
        $this->get($asset->gameUrl().'&size=compact')->assertOk()->assertHeader('Content-Type', 'audio/mpeg');
        $this->assertFileExists($source);
    }

    public function test_preparation_includes_compact_character_images_for_the_landing_page(): void
    {
        $asset = $this->image('characters', 800, 1600);
        $this->artisan('studio:optimize-media')->assertSuccessful();
        $version = app(MediaOptimizer::class)->version($asset, size: 'compact');
        $this->assertFileExists(Storage::disk('studio')->path(".variants/{$asset->id}-{$version}.webp"));
    }
}
