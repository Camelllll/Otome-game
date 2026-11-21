<?php

namespace Tests\Feature;

use App\Livewire\CharacterEditor;
use App\Livewire\EpisodeEditor;
use App\Models\Character;
use App\Models\Episode;
use App\Models\MediaAsset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class CharacterCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_character_sprite_upload_updates_the_media_library_and_game_catalog(): void
    {
        Storage::fake('studio');
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        $oldSprite = 'characters/old.png';
        $character = Character::create(['slug' => 'nathan', 'name' => 'Nathan', 'data' => [
            'id' => 'nathan', 'sprite' => $oldSprite, 'portraits' => ['default' => $oldSprite],
        ]]);

        Livewire::test(CharacterEditor::class)
            ->call('editer', $character->id)
            ->set('spriteUpload', UploadedFile::fake()->image('nathan.png')->size(3072))
            ->call('sauvegarder')
            ->assertHasNoErrors();

        $asset = MediaAsset::firstOrFail();
        Storage::disk('studio')->assertExists($asset->file_path);
        $this->assertSame('characters', $asset->category);
        $this->assertSame($asset->source_path, $character->fresh()->data['sprite']);
        $this->assertSame($asset->source_path, $character->fresh()->data['portraits']['default']);
        $this->getJson('/api/characters')->assertOk()
            ->assertJsonPath('crushs.0.sprite', $asset->spriteUrl());
    }

    public function test_game_uses_the_studio_name_without_changing_the_dialogue_identifier(): void
    {
        $character = Character::create(['slug' => 'liam', 'name' => 'Liam', 'data' => [
            'id' => 'liam', 'name' => 'Liam', 'tagline' => 'La même fiche',
        ]]);
        $this->actingAs(User::factory()->create(['is_admin' => true]));

        Livewire::test(CharacterEditor::class)
            ->call('editer', $character->id)
            ->set('name', 'Nouveau nom')
            ->call('sauvegarder')
            ->assertHasNoErrors();

        $this->assertSame('Liam', $character->fresh()->data['name']);
        $this->getJson('/api/characters')->assertOk()
            ->assertJsonPath('crushs.0.name', 'Nouveau nom')
            ->assertJsonPath('crushs.0.id', 'liam')
            ->assertJsonPath('crushs.0.tagline', 'La même fiche');
    }

    public function test_editor_lists_entire_catalog_and_preserves_historical_speakers(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        Character::create(['slug' => 'isaac', 'name' => 'Isaac', 'data' => ['name' => 'Isaac']]);
        Character::create(['slug' => 'mehdi', 'name' => 'Mehdi', 'data' => ['name' => 'Mehdi']]);
        Character::create(['slug' => 'mehdi_sans_veste_1', 'name' => 'Mehdi', 'data' => ['name' => 'Mehdi']]);
        $episode = Episode::create(['slug' => 'episode1', 'title' => 'Épisode 1']);
        $episode->versions()->create(['number' => 1, 'data' => [
            'start' => 'one', 'nodes' => [
                'one' => ['type' => 'line', 'speaker' => 'ancien', 'text' => 'Bonjour', 'next' => 'end'],
                'end' => ['type' => 'end'],
            ],
        ]]);
        Livewire::test(EpisodeEditor::class, ['episode' => $episode])
            ->assertSeeHtml('value="isaac"')
            ->assertSeeHtml('value="mehdi"')
            ->assertSeeHtml('value="mehdi_sans_veste_1"')
            ->assertSee('Mehdi — mehdi_sans_veste_1')
            ->assertSee('Ancien (hors catalogue)')
            ->assertSee('Héroïne (moi)')
            ->assertSee('Narration')
            ->set('nodeSpeaker', 'isaac')->call('save')->assertHasNoErrors();
        $this->assertSame('isaac', $episode->latestVersion()->data['nodes']['one']['speaker']);
        $this->assertSame('ancien', $episode->versions()->where('number', 1)->firstOrFail()->data['nodes']['one']['speaker']);
    }

    public function test_catalog_import_is_repeatable_and_preserves_manual_changes(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'otome-characters-');
        try {
            file_put_contents($file, json_encode([
                ['id' => 'moi', 'is_player' => true, 'is_secondary' => false, 'data' => ['id' => 'moi', 'portraits' => new \stdClass]],
                ['id' => 'isaac', 'is_player' => false, 'is_secondary' => false, 'data' => ['name' => 'Isaac', 'custom' => ['keep' => true]]],
            ], JSON_THROW_ON_ERROR));
            $this->artisan('studio:import-characters', ['file' => $file])->assertSuccessful();
            $this->assertDatabaseCount('characters', 2);
            $this->assertInstanceOf(\stdClass::class, Character::where('slug', 'moi')->firstOrFail()->data['portraits']);
            $isaac = Character::where('slug', 'isaac')->firstOrFail();
            $isaac->update(['name' => 'Nom modifié']);
            $this->artisan('studio:import-characters', ['file' => $file])->assertSuccessful();
            $this->assertDatabaseCount('characters', 2);
            $this->assertSame('Nom modifié', $isaac->fresh()->name);
            $this->assertTrue($isaac->fresh()->data['custom']['keep']);
            $this->assertDatabaseCount('episode_versions', 0);
        } finally {
            unlink($file);
        }
    }

    public function test_invalid_or_duplicate_rows_do_not_partially_import(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'otome-characters-');
        try {
            $row = ['id' => 'isaac', 'is_player' => false, 'is_secondary' => false, 'data' => ['name' => 'Isaac']];
            file_put_contents($file, json_encode([$row, $row], JSON_THROW_ON_ERROR));
            $this->artisan('studio:import-characters', ['file' => $file])->assertFailed();
            $this->assertDatabaseCount('characters', 0);
            file_put_contents($file, json_encode([$row, ['id' => 'broken']], JSON_THROW_ON_ERROR));
            $this->artisan('studio:import-characters', ['file' => $file])->assertFailed();
            $this->assertDatabaseCount('characters', 0);
        } finally {
            unlink($file);
        }
    }
}
