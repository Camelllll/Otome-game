<?php

namespace Tests\Feature;

use App\Models\Character;
use App\Models\Episode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EpisodeFlowTest extends TestCase
{
    use RefreshDatabase;

    private function document(): array
    {
        return [
            'start' => 'hello',
            'nodes' => [
                'hello' => ['type' => 'choice', 'speaker' => 'moi', 'text' => 'Choisir', 'onScreen' => ['isaac'], 'options' => [
                    ['text' => 'Oui', 'effects' => ['isaac' => ['amour' => 5, 'amitie' => -2]], 'next' => 'end', 'flags' => ['yes']],
                ]],
                'end' => ['type' => 'end', 'next' => '', 'nextEpisode' => 'episode2'],
            ],
            'scenes' => [['id' => 'scene_1', 'title' => 'Le campus', 'background' => 'image', 'nodeIds' => ['hello', 'end']]],
            'extra' => new \stdClass,
        ];
    }

    private function episode(): Episode
    {
        $episode = Episode::create(['slug' => 'episode1', 'title' => 'Épisode 1']);
        $episode->versions()->create(['number' => 1, 'data' => $this->document()]);

        return $episode;
    }

    private function payload(Episode $episode): array
    {
        return [
            'id' => $episode->slug, 'title' => $episode->title,
            'versionId' => $episode->latestVersion()->id,
            'document' => json_encode($this->document(), JSON_THROW_ON_ERROR),
        ];
    }

    public function test_flow_is_admin_only_and_loading_does_not_create_versions(): void
    {
        $this->withoutVite();
        $episode = $this->episode();
        $this->get(route('studio.edit', $episode))->assertRedirect('/login');
        $this->actingAs(User::factory()->create())->postJson(route('studio.flow.save'), $this->payload($episode))->assertForbidden();
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        Character::create(['slug' => 'isaac', 'name' => 'Isaac', 'data' => ['name' => 'Isaac']]);
        $this->get(route('studio.edit', $episode))->assertOk()->assertSee('scene-flow')->assertSee('Importer .docx')->assertSee('isaac');
        $this->assertDatabaseCount('episode_versions', 1);
    }

    public function test_save_preserves_scene_metadata_and_full_choice_data(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        $episode = $this->episode();
        $payload = $this->payload($episode);
        $this->postJson(route('studio.flow.save'), $payload)->assertOk()->assertJsonPath('id', 'episode1');
        $this->assertEquals($this->document(), $episode->latestVersion()->data);
        $this->assertDatabaseCount('episode_versions', 2);
        $this->postJson(route('studio.flow.save'), $payload)->assertUnprocessable()->assertJsonValidationErrors('document');
        $this->assertDatabaseCount('episode_versions', 2);
    }

    public function test_create_import_export_and_publication(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        $payload = ['id' => 'episode1', 'title' => 'Épisode 1', 'document' => json_encode($this->document(), JSON_THROW_ON_ERROR)];
        $created = $this->postJson(route('studio.flow.create'), $payload)->assertCreated();
        $version = $created->json('versionId');
        $this->postJson(route('studio.flow.publish'), ['id' => 'episode1', 'versionId' => $version, 'published' => true])->assertOk()->assertJsonPath('status', 'published');
        $episode = Episode::firstOrFail();
        $this->get(route('studio.export', $episode))->assertDownload('episode1.json');
        $this->postJson(route('studio.flow.import'), ['episodes' => [[...$payload, 'versionId' => $version]]])->assertOk();
        $this->assertSame($version, $episode->fresh()->published_version_id);
        $this->postJson(route('studio.flow.publish'), ['id' => 'episode1', 'versionId' => $episode->latestVersion()->id, 'published' => false])->assertOk()->assertJsonPath('status', 'draft');
    }

    public function test_import_workspace_rolls_back_if_any_episode_conflicts(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        $episode = $this->episode();
        $row = $this->payload($episode);
        $this->postJson(route('studio.flow.import'), ['episodes' => [
            [...$row, 'id' => 'episode2'],
            [...$row, 'versionId' => 999999],
        ]])->assertUnprocessable();
        $this->assertDatabaseCount('episodes', 1);
        $this->assertDatabaseCount('episode_versions', 1);
    }

    public function test_invalid_links_block_publication_not_draft_saving(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        $episode = $this->episode();
        $document = $this->document();
        $document['nodes']['hello']['options'][0]['next'] = 'missing';
        $saved = $this->postJson(route('studio.flow.save'), [
            ...$this->payload($episode), 'document' => json_encode($document, JSON_THROW_ON_ERROR),
        ])->assertOk();
        $this->postJson(route('studio.flow.publish'), ['id' => 'episode1', 'versionId' => $saved->json('versionId'), 'published' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('document');
        $this->assertNull($episode->fresh()->published_version_id);
    }

    public function test_more_than_three_characters_is_rejected(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        $episode = $this->episode();
        $document = $this->document();
        $document['nodes']['hello']['onScreen'] = ['a', 'b', 'c', 'd'];
        $this->postJson(route('studio.flow.save'), [
            ...$this->payload($episode), 'document' => json_encode($document, JSON_THROW_ON_ERROR),
        ])->assertUnprocessable()->assertJsonValidationErrors('document');
    }
}
