<?php

namespace Tests\Feature;

use App\Models\Character;
use App\Models\Episode;
use App\Models\Illustration;
use App\Models\MediaAsset;
use App\Models\PlayerChoice;
use App\Models\PlayerIllustration;
use App\Models\User;
use App\Services\PlayerSaveService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PlayerProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_players_and_saves_use_pommette_as_the_default_name(): void
    {
        $this->postJson('/api/auth/register', [
            'email' => 'preview@example.test',
            'password' => 'test-password',
        ])->assertCreated()->assertJsonPath('player.pseudo', 'Pommette');

        $this->login(User::query()->where('email', 'preview@example.test')->firstOrFail());
        $this->getJson('/api/saves/0')->assertOk()->assertJsonPath('playerName', 'Pommette');
        $this->putJson('/api/saves/0', ['currentEpisode' => 'episode1'])
            ->assertOk()->assertJsonPath('playerName', 'Pommette');
    }

    public function test_old_saves_follow_the_account_pseudo_without_changing_progress_or_accepting_an_old_name(): void
    {
        $user = $this->login(User::factory()->create(['name' => 'Pommette', 'password' => 'current-password']));
        $service = app(PlayerSaveService::class);
        $save = $service->save($user, [
            'currentEpisode' => 'episode1', 'currentNode' => 'reprendre-ici',
            'gauges' => ['liam' => ['amour' => 5]], 'flags' => ['rencontre'], 'history' => ['intro'],
            'currency' => 50, 'inventory' => ['top:pull'],
        ], 3);
        $save->forceFill(['player_name' => 'Pomette'])->save();
        $avant = $save->fresh()->getAttributes();

        $this->getJson('/api/saves/3')->assertOk()
            ->assertJsonPath('playerName', 'Pommette')
            ->assertJsonPath('currentNode', 'reprendre-ici')
            ->assertJsonPath('gauges.liam.amour', 5)
            ->assertJsonPath('history.0', 'intro');
        $this->getJson('/api/saves')->assertOk()->assertJsonPath('0.playerName', 'Pommette');
        $this->assertSame($avant, $save->fresh()->getAttributes());

        $this->patchJson('/api/account', ['current_password' => 'current-password', 'pseudo' => 'Nouveau'])
            ->assertOk()->assertJsonPath('player.pseudo', 'Nouveau');
        $this->getJson('/api/saves/3')->assertOk()
            ->assertJsonPath('playerName', 'Nouveau')
            ->assertJsonPath('currentNode', 'reprendre-ici');
        $this->assertSame($avant, $save->fresh()->getAttributes());

        $this->putJson('/api/saves/3', [
            'playerName' => 'Pomette', 'currentEpisode' => 'episode1', 'currentNode' => 'suite',
        ])->assertOk()->assertJsonPath('playerName', 'Nouveau');
        $this->assertSame('Nouveau', $save->fresh()->player_name);
        $this->assertSame('Nouveau', $user->fresh()->name);
    }

    public function test_copied_and_reset_saves_keep_the_account_pseudo(): void
    {
        $user = $this->login(User::factory()->create(['name' => 'Pommette']));
        $save = app(PlayerSaveService::class)->save($user, ['currentEpisode' => 'episode1', 'currentNode' => 'reprise'], 3);
        $save->forceFill(['player_name' => 'Pomette'])->save();

        $this->postJson('/api/saves/3/copy', ['target' => 0])->assertOk()
            ->assertJsonPath('playerName', 'Pommette')
            ->assertJsonPath('currentNode', 'reprise');
        $this->postJson('/api/saves/0/reset', ['playerName' => 'Pomette'])->assertOk()
            ->assertJsonPath('playerName', 'Pommette')
            ->assertJsonPath('currentNode', null);
        $this->getJson('/api/saves/3')->assertOk()->assertJsonPath('currentNode', 'reprise');
    }

    private function login(?User $user = null): User
    {
        $user ??= User::factory()->create(['password' => 'current-password']);
        $this->app['auth']->forgetGuards();
        $this->withToken($user->createToken('test')->plainTextToken);

        return $user;
    }

    private function illustration(): array
    {
        Storage::fake('studio');
        Storage::disk('studio')->put('illustrations/test.png', 'png-bytes');
        $source = 'assets/Illustrations/test.png';
        $asset = MediaAsset::create([
            'category' => 'illustrations', 'label' => 'Un souvenir', 'file_path' => 'illustrations/test.png',
            'original_name' => 'test.png', 'mime_type' => 'image/png', 'size' => 9,
            'source_path' => $source, 'source_key' => hash('sha256', $source),
        ]);
        $episode = Episode::create(['slug' => 'episode1', 'title' => 'Un début']);
        $version = $episode->versions()->create(['number' => 1, 'data' => [
            'start' => 'choice', 'nodes' => [
                'choice' => ['type' => 'choice', 'options' => [
                    ['text' => 'Oui', 'next' => 'branch', 'flags' => ['right'], 'effects' => ['liam' => ['amour' => 5]]],
                    ['text' => 'Non', 'next' => 'branch'],
                ]],
                'branch' => ['type' => 'branch', 'branches' => [['if' => ['flag' => 'right'], 'next' => 'cg']], 'fallback' => 'end'],
                'cg' => ['type' => 'line', 'cg' => $source, 'next' => 'end'],
                'end' => ['type' => 'end'],
            ],
        ]]);
        $episode->forceFill(['published_version_id' => $version->id])->save();
        $meta = Illustration::create([
            'slug' => 'souvenir', 'title' => 'Un souvenir', 'media_asset_id' => $asset->id,
            'episode_id' => 'episode1', 'unlock_node_id' => 'cg', 'character_ids' => ['liam'], 'rarity' => 'legendary',
        ]);

        return [$asset, $meta, $source];
    }

    public function test_account_updates_require_reauthentication_and_never_serialize_passwords(): void
    {
        $user = $this->login();
        $other = User::factory()->create(['email' => 'other@example.test']);
        $this->getJson('/api/account')->assertOk()->assertJsonPath('player.email', $user->email)->assertJsonMissingPath('player.password');
        $this->patchJson('/api/account', ['pseudo' => 'Nouveau'])->assertUnprocessable();
        $this->patchJson('/api/account', ['current_password' => 'wrong', 'pseudo' => 'Nouveau'])->assertUnprocessable();
        $this->patchJson('/api/account', ['current_password' => ['invalid'], 'pseudo' => 'Nouveau'])->assertUnprocessable();
        foreach (['ab', '<script>', 'bad@name'] as $pseudo) {
            $this->patchJson('/api/account', ['current_password' => 'current-password', 'pseudo' => $pseudo])->assertUnprocessable();
        }
        $this->patchJson('/api/account', ['current_password' => 'current-password', 'email' => $other->email])->assertUnprocessable();
        $this->patchJson('/api/account', ['current_password' => 'current-password', 'pseudo' => 'Camélien_2', 'user_id' => $other->id])
            ->assertOk()->assertJsonPath('player.pseudo', 'Camélien_2');
        $this->assertSame('Camélien_2', $user->fresh()->name);
        $this->assertNotSame('Camélien_2', $other->fresh()->name);
    }

    public function test_password_confirmation_hashing_and_other_token_revocation(): void
    {
        $user = $this->login();
        $user->createToken('other-device');
        $this->patchJson('/api/account', [
            'current_password' => 'current-password', 'password' => 'new-password', 'password_confirmation' => 'different',
        ])->assertUnprocessable();
        $this->patchJson('/api/account', [
            'current_password' => 'current-password', 'password' => 'new-password', 'password_confirmation' => 'new-password',
        ])->assertOk()->assertJsonMissingPath('player.password');
        $this->assertTrue(Hash::check('new-password', $user->fresh()->password));
        $this->assertSame(1, $user->tokens()->count());
    }

    public function test_deletion_is_server_side_confirmed_and_cascades_only_the_current_player(): void
    {
        $user = $this->login();
        $other = User::factory()->create();
        $service = app(PlayerSaveService::class);
        $service->save($user, ['currentNode' => 'start'], 0);
        $service->save($other, ['currentNode' => 'other'], 0);
        PlayerIllustration::create(['user_id' => $user->id, 'path_hash' => hash('sha256', 'x'), 'illustration_path' => 'x']);
        PlayerChoice::create(['user_id' => $user->id, 'slot' => 0, 'flags' => [], 'effects' => [], 'chosen_at' => now()]);
        $this->deleteJson('/api/account', ['current_password' => 'current-password'])->assertUnprocessable();
        $this->deleteJson('/api/account', ['current_password' => 'wrong', 'confirmation' => 'SUPPRIMER'])->assertUnprocessable();
        $this->assertDatabaseHas('users', ['id' => $user->id]);
        $this->deleteJson('/api/account', ['current_password' => 'current-password', 'confirmation' => 'SUPPRIMER'])->assertOk();
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('player_saves', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('player_choices', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('player_illustrations', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $user->id]);
        $this->assertDatabaseHas('player_saves', ['user_id' => $other->id]);
    }

    public function test_collection_is_deduplicated_and_private_and_cannot_be_forged_in_a_save(): void
    {
        [$asset, $meta, $source] = $this->illustration();
        $owner = User::factory()->create();
        PlayerIllustration::create(['user_id' => $owner->id, 'path_hash' => hash('sha256', $source), 'illustration_path' => $source, 'acquired_at' => now()]);
        $save = app(PlayerSaveService::class)->save($owner, [], 0);
        $save->update(['unlocked_illustration_ids' => [$meta->slug]]);
        $other = $this->login();
        $this->getJson('/api/illustrations')->assertOk()->assertExactJson([]);
        $this->getJson("/api/illustrations/{$asset->id}/file")->assertNotFound();
        $this->putJson('/api/saves/0', ['unlockedIllustrationIds' => [$meta->slug]])->assertOk()->assertJsonPath('unlockedIllustrationIds', []);
        $this->assertDatabaseMissing('player_illustrations', ['user_id' => $other->id]);
        app(PlayerSaveService::class)->save($other, [], 0)->update(['unlocked_illustration_ids' => [$meta->slug]]);
        $this->getJson('/api/illustrations')->assertOk()->assertExactJson([]);
        $this->getJson('/api/profile/stats')->assertOk()->assertJsonPath('illustrationsDebloquees', 0);
        $this->getJson("/api/illustrations/{$asset->id}/file")->assertNotFound();
        $this->login($owner);
        $this->getJson('/api/illustrations')->assertOk()->assertJsonCount(1)->assertJsonPath('0.title', 'Un souvenir')
            ->assertJsonPath('0.rarity', 'legendary');
        $this->getJson('/api/profile/stats')->assertOk()->assertJsonPath('illustrationsDebloquees', 1);
        $this->getJson("/api/illustrations/{$asset->id}/file")->assertOk();
    }

    public function test_optimized_illustration_variants_keep_the_same_acquisition_checks(): void
    {
        [$asset, , $source] = $this->illustration();
        $image = imagecreatetruecolor(2800, 1800);
        imagepng($image, Storage::disk('studio')->path($asset->file_path), 0);
        unset($image);
        $owner = $this->login();
        PlayerIllustration::create(['user_id' => $owner->id, 'path_hash' => hash('sha256', $source), 'illustration_path' => $source]);
        foreach (['thumbnail' => [640, 411], 'compact' => [1600, 1029], 'display' => [2560, 1646]] as $size => $dimensions) {
            $response = $this->getJson("/api/illustrations/{$asset->id}/file?size={$size}")->assertOk()
                ->assertHeader('Cache-Control', 'no-store, private')
                ->assertHeader('Content-Type', 'image/webp');
            $this->assertContains('Authorization', $response->baseResponse->getVary());
            $this->assertSame($dimensions, array_slice(getimagesize($response->baseResponse->getFile()->getPathname()), 0, 2));
        }
        $this->login();
        $this->getJson("/api/illustrations/{$asset->id}/file?size=thumbnail")->assertNotFound();
        $this->getJson("/api/illustrations/{$asset->id}/file?size=compact")->assertNotFound();
        $this->getJson("/api/media/{$asset->id}/file?size=thumbnail")->assertNotFound();
    }

    public function test_unlock_requires_a_real_published_path_and_ignores_client_effects(): void
    {
        [$asset, $meta, $source] = $this->illustration();
        $this->login();
        $claim = ['path' => $source, 'episodeId' => 'episode1', 'nodeId' => 'cg'];
        $this->postJson('/api/illustrations', $claim)->assertForbidden();
        $this->postJson('/api/saves/0/choices', ['episodeId' => 'episode1', 'nodeId' => 'choice', 'optionIndex' => 1, 'flags' => ['right'], 'effects' => ['liam' => ['amour' => 100]]])->assertCreated();
        $this->assertSame([], PlayerChoice::firstOrFail()->effects);
        $this->assertSame([], PlayerChoice::firstOrFail()->flags);
        $this->postJson('/api/illustrations', $claim)->assertForbidden();
        $this->postJson('/api/saves/0/choices', ['episodeId' => 'episode1', 'nodeId' => 'choice', 'optionIndex' => 0])->assertCreated();
        $meta->update(['unlock_node_id' => 'branch']);
        $this->postJson('/api/illustrations', array_replace($claim, ['nodeId' => 'branch']))->assertForbidden();
        Storage::disk('studio')->delete($asset->file_path);
        $this->postJson('/api/illustrations', $claim)->assertNotFound();
        $this->getJson('/api/illustrations')->assertOk()->assertExactJson([]);
        Storage::disk('studio')->put($asset->file_path, 'png-bytes');
        $this->postJson('/api/illustrations', $claim)->assertOk()->assertJsonPath('rarity', 'legendary');
        $this->postJson('/api/illustrations', $claim)->assertOk();
        $this->assertDatabaseCount('player_illustrations', 1);
        $this->getJson("/api/illustrations/{$asset->id}/file")->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_unimported_illustration_is_reported_without_exposing_its_public_path(): void
    {
        $user = $this->login();
        PlayerIllustration::create([
            'user_id' => $user->id, 'path_hash' => hash('sha256', 'legacy'),
            'illustration_path' => 'assets/Illustrations/legacy.png', 'acquired_at' => now(),
        ]);
        $this->getJson('/api/illustrations')->assertOk()->assertJsonCount(1)->assertJsonPath('0.path', null);
        $this->getJson('/api/profile/stats')->assertOk()->assertJsonPath('illustrationsDebloquees', 1);
        $episode = Episode::create(['slug' => 'legacy', 'title' => 'Ancien épisode']);
        $version = $episode->versions()->create(['number' => 1, 'data' => [
            'start' => 'cg', 'nodes' => ['cg' => ['type' => 'line', 'cg' => 'assets/Illustrations/legacy.png', 'next' => 'end'], 'end' => ['type' => 'end']],
        ]]);
        $episode->forceFill(['published_version_id' => $version->id])->save();
        $this->getJson('/api/episodes/legacy')->assertOk()->assertJsonPath('nodes.cg.cg', null)
            ->assertJsonPath('nodes.cg.cgUnavailable', true);
    }

    public function test_email_change_resets_verification_and_logout_preserves_progression(): void
    {
        $user = $this->login();
        $user->createToken('other-device');
        app(PlayerSaveService::class)->save($user, ['currentNode' => 'start'], 0);
        $this->patchJson('/api/account', ['current_password' => 'current-password', 'email' => 'new@example.test'])
            ->assertOk()->assertJsonPath('player.email', 'new@example.test');
        $this->assertNull($user->fresh()->email_verified_at);
        $this->assertSame(1, $user->tokens()->count());
        $this->postJson('/api/auth/logout')->assertOk();
        $this->assertDatabaseHas('users', ['id' => $user->id]);
        $this->assertDatabaseHas('player_saves', ['user_id' => $user->id, 'current_node' => 'start']);
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_stats_do_not_count_other_players_or_invent_uncollected_data(): void
    {
        Character::create(['slug' => 'liam', 'name' => 'Liam', 'data' => ['id' => 'liam']]);
        Character::create(['slug' => 'stella', 'name' => 'Stella', 'is_secondary' => true, 'data' => ['id' => 'stella']]);
        $user = $this->login();
        $other = User::factory()->create();
        $service = app(PlayerSaveService::class);
        $service->save($user, ['gauges' => ['liam' => ['amour' => -5], 'stella' => ['amitie' => 50]], 'completedEpisodes' => ['episode1']], 0);
        $service->save($user, ['gauges' => ['liam' => ['amour' => 35]], 'completedEpisodes' => ['episode1']], 1);
        $service->save($other, ['gauges' => ['liam' => ['amour' => 50]]], 0);
        $this->getJson('/api/profile/stats')->assertOk()->assertJsonPath('chapitresTermines', 1)
            ->assertJsonPath('illustrationsDebloquees', 0)->assertJsonPath('bonnesReponses', null)
            ->assertJsonPath('succesDebloques', null)->assertJsonPath('meilleurLovometre.valeur', 35)
            ->assertJsonPath('meilleurLovometre.personnage', 'Liam');
    }
}
