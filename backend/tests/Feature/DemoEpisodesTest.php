<?php

namespace Tests\Feature;

use App\Models\Episode;
use App\Models\Illustration;
use App\Models\MediaAsset;
use App\Models\PlayerIllustration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DemoEpisodesTest extends TestCase
{
    use RefreshDatabase;

    private function episode(string $slug, ?string $next = null, ?string $cg = null): Episode
    {
        $episode = Episode::create(['slug' => $slug, 'title' => $slug, 'thumbnail_path' => "$slug.png"]);
        Storage::disk('studio')->put("$slug.png", 'thumbnail');
        $version = $episode->versions()->create(['number' => 1, 'data' => [
            'start' => 'choice',
            'nodes' => [
                'choice' => ['type' => 'choice', 'options' => [['text' => 'Suivant', 'next' => 'end']]],
                'end' => ['type' => 'end', 'nextEpisode' => $next, 'cg' => $cg],
            ],
        ]]);
        $episode->publishedVersion()->associate($version)->save();

        return $episode;
    }

    public function test_demo_ends_after_episode_two_without_unpublishing_the_rest(): void
    {
        Storage::fake('studio');
        $this->episode('episode1', 'episode2');
        $second = $this->episode('episode2', 'episode3');
        $third = $this->episode('episode3');
        config(['game.demo' => true]);

        $this->getJson('/api/episodes')->assertOk()->assertJsonCount(2)
            ->assertJsonPath('0.id', 'episode1')->assertJsonPath('1.id', 'episode2');
        $this->getJson('/api/episodes/episode1')->assertJsonPath('nodes.end.nextEpisode', 'episode2');
        $this->getJson('/api/episodes/episode2')->assertJsonPath('nodes.end.nextEpisode', null);
        $this->get('/api/episodes/episode2/thumbnail')->assertOk();
        $this->getJson('/api/episodes/episode3')->assertNotFound();
        $this->get('/api/episodes/episode3/thumbnail')->assertNotFound();
        $this->actingAs(User::factory()->create(['is_admin' => true]))
            ->get(route('studio.episode-thumbnail', $third))->assertOk();
        $this->assertSame('episode3', $second->publishedVersion->data['nodes']['end']['nextEpisode']);

        config(['game.demo' => false]);
        $this->getJson('/api/episodes')->assertJsonCount(3);
        $this->getJson('/api/episodes/episode2')->assertJsonPath('nodes.end.nextEpisode', 'episode3');
    }

    public function test_demo_keeps_choices_and_gallery_for_available_episodes_only(): void
    {
        Storage::fake('studio');
        config(['game.demo' => true]);
        $player = User::factory()->create();
        $this->actingAs($player);

        foreach (['episode2', 'episode3'] as $slug) {
            $asset = MediaAsset::create([
                'category' => 'illustrations', 'label' => $slug, 'file_path' => "$slug-cg.png",
                'original_name' => "$slug-cg.png", 'mime_type' => 'image/png', 'size' => 2,
            ]);
            Storage::disk('studio')->put($asset->file_path, 'CG');
            $path = "/api/illustrations/{$asset->id}/file";
            Illustration::create([
                'slug' => "$slug-cg", 'title' => $slug, 'media_asset_id' => $asset->id,
                'episode_id' => $slug, 'character_ids' => [],
            ]);
            $this->episode($slug, cg: $path);

            $choice = $this->postJson('/api/saves/0/choices', ['episodeId' => $slug, 'nodeId' => 'choice', 'optionIndex' => 0]);
            $claim = $this->postJson('/api/illustrations', ['episodeId' => $slug, 'nodeId' => 'end', 'path' => $path]);
            if ($slug === 'episode2') {
                $choice->assertCreated();
                $claim->assertOk();
                $this->get($path)->assertOk();
            } else {
                $choice->assertNotFound();
                $claim->assertNotFound();
                PlayerIllustration::create([
                    'user_id' => $player->id, 'episode_id' => $slug, 'illustration_path' => $path,
                    'path_hash' => hash('sha256', $path), 'acquired_at' => now(),
                ]);
                $this->get($path)->assertNotFound();
            }
        }

        $this->getJson('/api/illustrations/catalogue')->assertJsonCount(1)->assertJsonPath('0.episodeId', 'episode2');
        $this->getJson('/api/illustrations')->assertJsonCount(1)->assertJsonPath('0.id', 'episode2-cg');
    }
}
