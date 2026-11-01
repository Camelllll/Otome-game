<?php

namespace Tests\Feature;

use App\Models\Episode;
use App\Models\MediaAsset;
use App\Services\LocalMediaImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LocalMediaImportTest extends TestCase
{
    use RefreshDatabase;

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('studio');
        $this->directory = sys_get_temp_dir().'/otome-assets-'.bin2hex(random_bytes(8));
        mkdir($this->directory);
        mkdir($this->directory.'/Décors');
        mkdir($this->directory.'/Illustrations');
        $image = UploadedFile::fake()->image('source.png');
        copy($image->getPathname(), $this->directory.'/Décors/Café du campus.png');
        file_put_contents($this->directory.'/notes.docx', 'not a media');
    }

    protected function tearDown(): void
    {
        foreach (['Décors/Café du campus.png', 'Illustrations/invalid.png', 'notes.docx'] as $file) {
            if (is_file($this->directory.'/'.$file)) {
                unlink($this->directory.'/'.$file);
            }
        }
        rmdir($this->directory.'/Décors');
        rmdir($this->directory.'/Illustrations');
        rmdir($this->directory);
        parent::tearDown();
    }

    public function test_import_copies_files_links_new_draft_and_is_repeatable(): void
    {
        $episode = Episode::create(['slug' => 'episode1', 'title' => 'Episode']);
        $original = [
            'start' => 'one', 'nodes' => ['one' => [
                'type' => 'line', 'text' => 'assets/Décors/Café du campus.png', 'next' => 'end',
                'background' => 'assets/D%C3%A9cors/Caf%C3%A9%20du%20campus.png',
                'cg' => 'assets/Illustrations/missing.png',
                'custom' => new \stdClass,
            ], 'end' => ['type' => 'end']],
        ];
        $version = $episode->versions()->create(['number' => 1, 'data' => $original]);
        $episode->published_version_id = $version->id;
        $episode->save();
        $result = app(LocalMediaImporter::class)->import($this->directory, true);
        $asset = MediaAsset::firstOrFail();
        $this->assertSame(1, $result['created']);
        $this->assertSame(1, $result['ignored']);
        $this->assertSame(1, $result['linked']);
        $this->assertSame(['assets/Illustrations/missing.png'], $result['unresolved']);
        Storage::disk('studio')->assertExists($asset->file_path);
        $this->assertFileExists($this->directory.'/Décors/Café du campus.png');
        $this->assertSame($asset->url(), $episode->latestVersion()->data['nodes']['one']['background']);
        $this->assertSame($original['nodes']['one']['text'], $episode->latestVersion()->data['nodes']['one']['text']);
        $this->assertInstanceOf(\stdClass::class, $episode->latestVersion()->data['nodes']['one']['custom']);
        $this->assertEquals($original, $version->fresh()->data);
        $this->assertSame($version->id, $episode->fresh()->published_version_id);
        $again = app(LocalMediaImporter::class)->import($this->directory, true);
        $this->assertSame(0, $again['created']);
        $this->assertSame(1, $again['existing']);
        $this->assertSame(0, $again['linked']);
        $this->assertDatabaseCount('episode_versions', 2);
        $this->assertDatabaseCount('media_assets', 1);
    }

    public function test_import_does_not_replace_manual_changes(): void
    {
        $importer = app(LocalMediaImporter::class);
        $importer->import($this->directory, false);
        $asset = MediaAsset::firstOrFail();
        Storage::disk('studio')->put('backgrounds/replacement.png', 'replacement');
        $asset->update(['file_path' => 'backgrounds/replacement.png', 'label' => 'Nom de la rédactrice']);
        $importer->import($this->directory, false);
        $this->assertSame('Nom de la rédactrice', $asset->fresh()->label);
        $this->assertSame('backgrounds/replacement.png', $asset->fresh()->file_path);
    }

    public function test_invalid_media_is_rejected_before_import(): void
    {
        file_put_contents($this->directory.'/Illustrations/invalid.png', '<?php echo "invalid";');
        $this->artisan('studio:import-media', ['directory' => $this->directory])->assertFailed();
        $this->assertDatabaseCount('media_assets', 0);
        $this->assertSame([], Storage::disk('studio')->allFiles());
    }

    public function test_import_without_link_flag_does_not_create_episode_versions(): void
    {
        $episode = Episode::create(['slug' => 'episode1', 'title' => 'Episode']);
        $episode->versions()->create(['number' => 1, 'data' => ['nodes' => ['end' => ['type' => 'end']], 'start' => 'end']]);
        $this->artisan('studio:import-media', ['directory' => $this->directory])->assertSuccessful();
        $this->assertDatabaseCount('episode_versions', 1);
    }
}
