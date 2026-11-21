<?php

namespace Tests\Feature;

use App\Livewire\EpisodeEditor;
use App\Livewire\Illustrations;
use App\Livewire\MediaLibrary;
use App\Models\Character;
use App\Models\Episode;
use App\Models\Illustration;
use App\Models\MediaAsset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class MediaLibraryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('studio');
        $this->withoutVite();
    }

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    private function asset(string $category = 'backgrounds'): MediaAsset
    {
        Storage::disk('studio')->put('backgrounds/example.png', 'example');

        return MediaAsset::create([
            'category' => $category, 'label' => 'Cour du campus', 'description' => 'La nuit',
            'file_path' => 'backgrounds/example.png', 'original_name' => 'example.png',
            'mime_type' => 'image/png', 'size' => 7,
        ]);
    }

    public function test_media_and_files_are_admin_only(): void
    {
        $asset = $this->asset();
        $this->get('/studio/media')->assertRedirect('/login');
        $this->get($asset->url())->assertRedirect('/login');
        $this->actingAs(User::factory()->create())->get('/studio/media')->assertForbidden();
        $this->get($asset->url())->assertForbidden();
        $this->actingAs($this->admin())->get('/studio/media')->assertOk()->assertSee('Cour du campus');
        $this->get($asset->url())->assertOk()->assertHeader('Content-Type', 'image/png')->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_upload_image_and_select_it_in_editor(): void
    {
        $this->actingAs($this->admin());
        Livewire::test(MediaLibrary::class)
            ->set('label', 'Chambre')->set('description', 'Un matin')
            ->set('upload', UploadedFile::fake()->image('chambre.png'))
            ->call('save')->assertHasNoErrors();
        $asset = MediaAsset::firstOrFail();
        Storage::disk('studio')->assertExists($asset->file_path);
        $this->assertSame('image/png', $asset->mime_type);
        $episode = $this->episode();
        Livewire::test(EpisodeEditor::class, ['episode' => $episode])
            ->assertSee('Chambre')->set('nodeBackground', $asset->url())->call('save')->assertHasNoErrors();
        $data = $episode->latestVersion()->data;
        $this->assertSame($asset->url(), $data['nodes']['start']['background']);
        $this->assertSame('legacy-music', $data['nodes']['start']['music']);
        $this->assertSame('legacy-cg', $data['nodes']['start']['cg']);
        $this->assertSame(['kept' => true], $data['nodes']['start']['custom']);
    }

    private function episode(): Episode
    {
        $episode = Episode::create(['slug' => 'episode1', 'title' => 'Episode']);
        $episode->versions()->create(['number' => 1, 'data' => [
            'start' => 'start',
            'nodes' => [
                'start' => [
                    'type' => 'line', 'text' => 'Bonjour', 'speaker' => 'liam', 'next' => 'end',
                    'background' => 'legacy-bg', 'music' => 'legacy-music', 'cg' => 'legacy-cg', 'custom' => ['kept' => true],
                ],
                'end' => ['type' => 'end'],
            ],
        ]]);

        return $episode;
    }

    public function test_missing_fields_and_unsafe_files_are_rejected(): void
    {
        $this->actingAs($this->admin());
        Livewire::test(MediaLibrary::class)->call('save')->assertHasErrors('label');
        Livewire::test(MediaLibrary::class)->set('label', 'Missing')->call('save')->assertHasErrors('upload');
        Livewire::test(MediaLibrary::class)->set('label', 'Unsafe')
            ->set('upload', UploadedFile::fake()->createWithContent('unsafe.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))
            ->call('save')->assertHasErrors('upload');
        Livewire::test(MediaLibrary::class)->set('label', 'Unsafe')
            ->set('upload', UploadedFile::fake()->createWithContent('fake.png', '<?php echo "unsafe";')->mimeType('text/x-php'))
            ->call('save')->assertHasErrors('upload');
        $this->assertDatabaseCount('media_assets', 0);
    }

    public function test_audio_has_its_own_category_and_validation(): void
    {
        $this->actingAs($this->admin());
        Livewire::test(MediaLibrary::class)->call('chooseCategory', 'music')->set('label', 'Piano')
            ->set('upload', UploadedFile::fake()->create('piano.mp3', 20, 'audio/mpeg'))
            ->call('save')->assertHasNoErrors();
        $this->assertDatabaseHas('media_assets', ['category' => 'music', 'label' => 'Piano']);
        Livewire::test(MediaLibrary::class)->call('chooseCategory', 'music')->set('label', 'Image')
            ->set('upload', UploadedFile::fake()->image('photo.png'))
            ->call('save')->assertHasErrors('upload');
    }

    public function test_upload_accepts_above_old_limit_and_exactly_100_mb(): void
    {
        $this->actingAs($this->admin());
        foreach ([3072, 13312, 102400] as $size) {
            Livewire::test(MediaLibrary::class)->call('chooseCategory', 'music')
                ->set('label', "Audio {$size}")
                ->set('upload', UploadedFile::fake()->create('large.mp3', $size, 'audio/mpeg'))
                ->call('save')->assertHasNoErrors();
        }
        $this->assertDatabaseCount('media_assets', 3);
        $this->assertSame(
            ['required', 'file', 'max:102400'],
            config('livewire.temporary_file_upload.rules'),
        );
    }

    public function test_production_php_limits_allow_the_maximum_upload_with_multipart_overhead(): void
    {
        $settings = parse_ini_file(base_path('../deploy/php.ini'));

        $this->assertIsArray($settings);
        $this->assertArrayHasKey('upload_max_filesize', $settings);
        $this->assertArrayHasKey('post_max_size', $settings);
        $this->assertGreaterThanOrEqual(MediaAsset::MAX_UPLOAD_KB * 1024, ini_parse_quantity($settings['upload_max_filesize']));
        $this->assertGreaterThanOrEqual(110 * 1024 * 1024, ini_parse_quantity($settings['post_max_size']));
    }

    public function test_upload_rejects_one_kb_above_100_mb(): void
    {
        $this->actingAs($this->admin());
        Livewire::test(MediaLibrary::class)->call('chooseCategory', 'music')
            ->set('label', 'Too large')
            ->set('upload', UploadedFile::fake()->create('huge.mp3', 102401, 'audio/mpeg'))
            ->assertHasErrors('upload');
        $this->assertDatabaseCount('media_assets', 0);
    }

    public function test_editing_label_does_not_require_new_file(): void
    {
        $asset = $this->asset();
        $this->actingAs($this->admin());
        Livewire::test(MediaLibrary::class)->call('edit', $asset->id)
            ->set('label', 'Campus de nuit')->call('save')->assertHasNoErrors();
        $this->assertSame('Campus de nuit', $asset->fresh()->label);
        $this->assertSame('backgrounds/example.png', $asset->fresh()->file_path);
    }

    public function test_replacement_keeps_url_and_tracks_previous_file(): void
    {
        $asset = $this->asset();
        $url = $asset->url();
        $this->actingAs($this->admin());
        Livewire::test(MediaLibrary::class)->call('edit', $asset->id)
            ->set('upload', UploadedFile::fake()->image('replacement.jpg'))->call('save')->assertHasNoErrors();
        $fresh = $asset->fresh();
        $this->assertSame($url, $fresh->url());
        $this->assertNotSame($asset->file_path, $fresh->file_path);
        $this->assertSame([$asset->file_path], $fresh->previous_files);
        Storage::disk('studio')->assertExists($asset->file_path);
        Storage::disk('studio')->assertExists($fresh->file_path);
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/jpeg');
    }

    public function test_archiving_preserves_file_and_existing_reference(): void
    {
        $asset = $this->asset();
        $this->actingAs($this->admin());
        Livewire::test(MediaLibrary::class)->call('archive', $asset->id)->assertDontSee('Cour du campus')
            ->set('showArchived', true)->assertSee('Cour du campus');
        $this->assertTrue($asset->fresh()->is_archived);
        $this->get($asset->url())->assertOk();
        $episode = $this->episode();
        $version = $episode->latestVersion();
        $data = $version->data;
        $data['nodes']['start']['background'] = $asset->url();
        $version->update(['data' => $data]);
        Livewire::test(EpisodeEditor::class, ['episode' => $episode])
            ->assertSet('nodeBackground', $asset->url())->call('save')->assertHasNoErrors();
        $this->assertSame($asset->url(), $episode->latestVersion()->data['nodes']['start']['background']);
        Livewire::test(MediaLibrary::class)->call('archive', $asset->id)->assertSee('Cour du campus');
        $this->assertFalse($asset->fresh()->is_archived);
    }

    public function test_search_category_switch_and_pagination(): void
    {
        $this->asset();
        $other = $this->asset('illustrations');
        $other->update(['label' => 'Rencontre']);
        $this->actingAs($this->admin());
        Livewire::test(MediaLibrary::class)->assertSee('Cour du campus')->assertDontSee('Rencontre')
            ->set('search', 'introuvable')->assertDontSee('Cour du campus')->assertSee('Aucun résultat')
            ->set('search', '')->call('chooseCategory', 'illustrations')->assertSee('Rencontre');
    }

    public function test_category_cannot_be_changed_on_existing_asset(): void
    {
        $asset = $this->asset();
        $this->actingAs($this->admin());
        Livewire::test(MediaLibrary::class)->call('edit', $asset->id)->set('category', 'music')->call('save')->assertHasErrors('category');
        $this->assertSame('backgrounds', $asset->fresh()->category);
    }

    public function test_revoked_admin_cannot_modify_media(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $component = Livewire::test(MediaLibrary::class);
        $admin->is_admin = false;
        $admin->save();
        $component->call('save')->assertForbidden();
    }

    public function test_missing_media_file_returns_explicit_not_found(): void
    {
        $asset = $this->asset();
        Storage::disk('studio')->delete($asset->file_path);
        $this->actingAs($this->admin())->get($asset->url())->assertNotFound();
    }

    public function test_unchanged_media_fields_are_not_added_to_nodes(): void
    {
        $this->actingAs($this->admin());
        $episode = $this->episode();
        Livewire::test(EpisodeEditor::class, ['episode' => $episode])->call('selectNode', 'end')->call('save')->assertHasNoErrors();
        $this->assertSame(['type' => 'end'], $episode->latestVersion()->data['nodes']['end']);
    }

    private function character(string $slug, string $name): Character
    {
        return Character::create([
            'slug' => $slug, 'name' => $name, 'is_player' => false, 'is_secondary' => false,
            'data' => ['id' => $slug, 'name' => $name],
        ]);
    }

    public function test_illustration_form_opens_from_the_media_library(): void
    {
        $this->actingAs($this->admin());
        Livewire::test(MediaLibrary::class)
            ->call('chooseCategory', 'illustrations')
            ->assertSet('showCarnet', false)
            ->call('openCarnet')
            ->assertSet('showCarnet', true)
            ->assertSeeLivewire(Illustrations::class)
            ->call('closeCarnet')
            ->assertSet('showCarnet', false);
    }

    public function test_illustration_is_linked_to_several_characters(): void
    {
        $this->actingAs($this->admin());
        $this->episode();
        $this->character('liam', 'Liam');
        $this->character('isaac', 'Isaac');
        $asset = $this->asset('illustrations');

        Livewire::test(Illustrations::class, ['assetId' => $asset->id])
            ->assertSet('mediaAssetId', (string) $asset->id)
            ->set('title', 'Une rencontre inattendue')
            ->set('episodeId', 'episode1')
            ->set('characterIds', ['liam', 'isaac'])
            ->set('unlockNodeId', 'start')
            ->call('save')
            ->assertHasNoErrors();

        $illustration = Illustration::firstOrFail();
        $this->assertSame(['liam', 'isaac'], $illustration->character_ids);
        $this->assertSame($asset->id, $illustration->media_asset_id);
        $this->assertSame('start', $illustration->unlock_node_id);
        $this->assertSame('viewed', $illustration->unlock_condition);
    }

    public function test_illustration_requires_a_title_and_a_character(): void
    {
        $this->actingAs($this->admin());
        Livewire::test(Illustrations::class)->call('save')->assertHasErrors(['title', 'characterIds']);
        $this->assertDatabaseCount('illustrations', 0);
    }

    public function test_info_button_reopens_the_existing_illustration_instead_of_creating_another(): void
    {
        $this->actingAs($this->admin());
        $this->character('liam', 'Liam');
        $asset = $this->asset('illustrations');
        $illustration = Illustration::create([
            'slug' => 'cg-episode1-test', 'title' => 'Test', 'media_asset_id' => $asset->id,
            'character_ids' => ['liam'], 'unlock_condition' => 'viewed', 'spoiler_level' => 1,
        ]);

        Livewire::test(Illustrations::class, ['assetId' => $asset->id])
            ->assertSet('editingId', $illustration->id)
            ->assertSet('title', 'Test')
            ->assertSet('characterIds', ['liam'])
            ->set('title', 'Test modifié')
            ->call('save')
            ->assertHasNoErrors();

        $this->assertDatabaseCount('illustrations', 1);
        $this->assertSame('Test modifié', $illustration->fresh()->title);
        $this->assertSame('cg-episode1-test', $illustration->fresh()->slug);
    }
}
