<?php

namespace Tests\Feature;

use App\Livewire\EpisodeEditor;
use App\Livewire\EpisodeIndex;
use App\Models\Episode;
use App\Models\User;
use App\Services\EpisodeDocument;
use App\Services\EpisodeWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Livewire\Livewire;
use Tests\TestCase;

class StudioTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    private function document(): array
    {
        return [
            'start' => 'hello',
            'nodes' => [
                'hello' => ['type' => 'line', 'text' => 'Bonjour', 'speaker' => 'moi', 'next' => 'end', 'custom' => ['kept' => true]],
                'end' => ['type' => 'end'],
            ],
            'customRoot' => 'conservé',
        ];
    }

    private function episode(): Episode
    {
        $episode = Episode::create(['slug' => 'episode1', 'title' => 'Épisode 1']);
        $episode->versions()->create(['number' => 1, 'data' => $this->document()]);

        return $episode;
    }

    public function test_guests_and_players_cannot_access_studio(): void
    {
        $this->get('/')->assertRedirect('/studio');
        $this->get('/studio')->assertRedirect('/login');
        $this->actingAs(User::factory()->create())->get('/studio')->assertForbidden();
    }

    public function test_admin_can_login_but_player_cannot(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'password' => Hash::make('a-long-test-password')]);
        $this->post('/login', ['email' => $admin->email, 'password' => 'a-long-test-password'])->assertRedirect('/studio');
        $this->assertAuthenticatedAs($admin);
        $this->post('/logout')->assertRedirect('/login');
        $player = User::factory()->create(['password' => Hash::make('a-long-test-password')]);
        $this->post('/login', ['email' => $player->email, 'password' => 'a-long-test-password'])->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_admin_can_view_editor_export_and_preview(): void
    {
        $this->withoutVite();
        $episode = $this->episode();
        $this->actingAs($this->admin())->get('/studio')->assertOk()->assertSee('Épisode 1');
        $this->get("/studio/episodes/{$episode->id}")->assertOk()->assertSee('scene-flow');
        $this->get("/studio/episodes/{$episode->id}/preview")->assertOk()->assertSee('LECTURE EXPLORATOIRE');
        $this->get("/studio/episodes/{$episode->id}/export")->assertDownload('episode1.json');
    }

    public function test_create_episode_validates_unique_identifier(): void
    {
        $this->actingAs($this->admin());
        Livewire::test(EpisodeIndex::class)->set('title', 'Un chapitre')->set('slug', 'episode7')->call('create')->assertHasNoErrors();
        $this->assertDatabaseHas('episodes', ['slug' => 'episode7']);
        Livewire::test(EpisodeIndex::class)->set('title', 'Autre')->set('slug', 'episode7')->call('create')->assertHasErrors('slug');
    }

    public function test_guided_edit_preserves_unknown_properties_and_published_version(): void
    {
        $this->actingAs($this->admin());
        $episode = $this->episode();
        $original = $episode->latestVersion();
        app(EpisodeWriter::class)->publish($episode, $original->id);
        Livewire::test(EpisodeEditor::class, ['episode' => $episode])
            ->set('nodeText', 'Texte modifié')->call('save')->assertHasNoErrors();
        $episode->refresh();
        $this->assertSame($original->id, $episode->published_version_id);
        $latest = $episode->latestVersion();
        $this->assertSame('Texte modifié', $latest->data['nodes']['hello']['text']);
        $this->assertTrue($latest->data['nodes']['hello']['custom']['kept']);
        $this->assertSame('conservé', $latest->data['customRoot']);
        $this->assertSame('Bonjour', $original->fresh()->data['nodes']['hello']['text']);
    }

    public function test_invalid_links_block_publication_but_allow_drafts(): void
    {
        $this->actingAs($this->admin());
        $episode = $this->episode();
        Livewire::test(EpisodeEditor::class, ['episode' => $episode])
            ->set('nodeNext', 'missing')->call('publish')->assertHasErrors('document');
        $this->assertNull($episode->fresh()->published_version_id);
        $this->assertSame('missing', $episode->latestVersion()->data['nodes']['hello']['next']);
    }

    public function test_valid_publication_records_current_version(): void
    {
        $this->actingAs($this->admin());
        $episode = $this->episode();
        Livewire::test(EpisodeEditor::class, ['episode' => $episode])->call('publish')->assertHasNoErrors();
        $this->assertSame($episode->latestVersion()->id, $episode->fresh()->published_version_id);
    }

    public function test_concurrent_edits_do_not_overwrite(): void
    {
        $episode = $this->episode();
        $original = $episode->latestVersion()->id;
        $writer = app(EpisodeWriter::class);
        $writer->save($episode, 'Updated', $this->document(), $original, null);
        $this->expectException(ValidationException::class);
        $writer->save($episode, 'Stale', $this->document(), $original, null);
    }

    public function test_invalid_full_json_shows_an_error_without_losing_input(): void
    {
        $this->actingAs($this->admin());
        Livewire::test(EpisodeEditor::class, ['episode' => $this->episode()])
            ->call('toggleDocument')->set('document', '{broken')
            ->call('save')->assertHasErrors('document')->assertSet('document', '{broken');
    }

    public function test_switching_nodes_keeps_unsaved_text(): void
    {
        $this->actingAs($this->admin());
        Livewire::test(EpisodeEditor::class, ['episode' => $this->episode()])
            ->set('nodeText', 'Brouillon local')->call('selectNode', 'end')
            ->call('selectNode', 'hello')->assertSet('nodeText', 'Brouillon local');
    }

    public function test_revoked_admin_cannot_save_through_livewire(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $component = Livewire::test(EpisodeEditor::class, ['episode' => $this->episode()]);
        $admin->is_admin = false;
        $admin->save();
        $component->call('save')->assertForbidden();
    }

    public function test_empty_objects_remain_objects_in_database(): void
    {
        $data = app(EpisodeDocument::class)->decode('{"start":"end","nodes":{"end":{"type":"end","effects":{}}},"flags":[]}');
        $episode = Episode::create(['slug' => 'objects', 'title' => 'Objects']);
        $version = $episode->versions()->create(['number' => 1, 'data' => $data]);
        $this->assertInstanceOf(\stdClass::class, $version->fresh()->data['nodes']['end']['effects']);
        $this->assertSame([], $version->fresh()->data['flags']);
    }

    public function test_import_is_atomic_and_refuses_overwrites(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'otome-import-');
        try {
            file_put_contents($file, json_encode([
                ['id' => 'episode1', 'title' => 'Épisode 1', 'data' => $this->document()],
                ['id' => 'episode2', 'title' => 'Épisode 2', 'data' => $this->document()],
            ], JSON_THROW_ON_ERROR));
            $this->artisan('studio:import', ['file' => $file])->assertSuccessful();
            $this->assertDatabaseCount('episodes', 2);
            $this->assertDatabaseCount('episode_versions', 2);
            $this->assertDatabaseHas('episodes', ['slug' => 'episode1', 'published_version_id' => null]);
            $this->artisan('studio:import', ['file' => $file])->assertFailed();
            $this->assertDatabaseCount('episodes', 2);
        } finally {
            unlink($file);
        }
    }

    public function test_import_rejects_invalid_input_without_partial_data(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'otome-import-');
        try {
            file_put_contents($file, json_encode([
                ['id' => 'episode1', 'title' => 'Valid', 'data' => $this->document()],
                ['id' => 'episode2', 'title' => 'Broken', 'data' => ['nodes' => []]],
            ], JSON_THROW_ON_ERROR));
            $this->artisan('studio:import', ['file' => $file])->assertFailed();
            $this->assertDatabaseCount('episodes', 0);
        } finally {
            unlink($file);
        }
    }

    public function test_branch_fallback_and_choice_targets_are_validated(): void
    {
        $data = $this->document();
        $data['nodes']['hello'] = ['type' => 'branch', 'fallback' => 'missing', 'branches' => [['if' => ['topGauge' => ['routes' => ['liam' => 'end']]]]]];
        $this->assertNotEmpty(app(EpisodeDocument::class)->publicationErrors($data));
        $data['nodes']['hello']['fallback'] = 'end';
        $this->assertSame([], app(EpisodeDocument::class)->publicationErrors($data));
    }
}
