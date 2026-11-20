<?php

namespace Tests\Feature;

use App\Livewire\WardrobeLibrary;
use App\Models\MediaAsset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class WardrobeLibraryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('studio');
        $this->withoutVite();
    }

    public function test_admin_can_add_a_dressing_item_that_is_available_to_the_game(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $page = $this->actingAs($admin)->get('/studio/dressing')
            ->assertOk()
            ->assertSee('Ajouter au dressing')
            ->assertSee('3000 × 6000');
        foreach (['Peau', 'Cheveux', 'Yeux', 'Sourcils', 'Bouche', 'Hauts', 'Bas', 'Chaussures'] as $category) {
            $page->assertSee($category);
        }

        Livewire::test(WardrobeLibrary::class)
            ->set('label', 'Veste en jean')
            ->set('appearanceCategory', 'top')
            ->set('price', '75')
            ->set('upload', UploadedFile::fake()->image('veste.png', 3000, 6000))
            ->call('save')
            ->assertHasNoErrors()
            ->assertSee('Veste en jean');

        $asset = MediaAsset::query()->where('category', 'wardrobe')->firstOrFail();
        Storage::disk('studio')->assertExists($asset->file_path);
        $this->assertSame('top', $asset->appearance_category);
        $this->assertSame(75, $asset->price);

        $catalogue = $this->getJson('/api/appearance/catalogue')->assertOk()->assertJsonCount(1, 'items');
        $this->assertSame('studio-'.$asset->id, $catalogue->json('items.0.id'));
        $this->assertSame('top', $catalogue->json('items.0.category'));
        $this->assertSame('Veste en jean', $catalogue->json('items.0.label'));
        $this->assertSame(75, $catalogue->json('items.0.unlock.price'));
        $this->assertSame('top', $catalogue->json('items.0.layers.0.slot'));
        $this->assertStringContainsString("/api/media/{$asset->id}/file", $catalogue->json('items.0.layers.0.file'));
        $this->get($catalogue->json('items.0.layers.0.file'))->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->getJson('/api/shop')->assertJsonPath('items.0.id', 'studio-'.$asset->id);
    }

    public function test_skin_can_be_added_as_a_free_body_layer_and_no_static_items_are_returned(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));

        Livewire::test(WardrobeLibrary::class)
            ->set('label', 'Peau claire')
            ->set('appearanceCategory', 'skin')
            ->set('price', '')
            ->set('upload', UploadedFile::fake()->image('peau.png', 3000, 6000))
            ->call('save')
            ->assertHasNoErrors();

        $catalogue = $this->getJson('/api/appearance/catalogue')
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('canvas.width', 600)
            ->assertJsonPath('canvas.height', 1200)
            ->assertJsonPath('defaults.skin', null)
            ->assertJsonPath('items.0.category', 'skin')
            ->assertJsonPath('items.0.layers.0.slot', 'body')
            ->assertJsonPath('items.0.unlock.type', 'default');
        $this->assertNull($catalogue->json('items.0.unlock.price'));
    }

    public function test_all_appearance_categories_are_mapped_to_the_game_render_slots(): void
    {
        Storage::disk('studio')->put('wardrobe/item.png', 'image');
        $slots = [
            'skin' => 'body',
            'hair' => 'hair-front',
            'eyes' => 'eyes',
            'eyebrows' => 'eyebrows',
            'mouth' => 'mouth',
            'top' => 'top',
            'bottom' => 'bottom',
            'shoes' => 'shoes',
            'outfit' => 'outfit',
            'accessory' => 'accessory',
        ];
        foreach ($slots as $category => $slot) {
            MediaAsset::create([
                'category' => 'wardrobe',
                'label' => $category,
                'appearance_category' => $category,
                'price' => null,
                'file_path' => 'wardrobe/item.png',
                'original_name' => 'item.png',
                'mime_type' => 'image/png',
                'size' => 5,
            ]);
        }

        $items = $this->getJson('/api/appearance/catalogue')
            ->assertOk()
            ->assertJsonCount(count($slots), 'items')
            ->json('items');
        foreach ($slots as $category => $slot) {
            $item = collect($items)->firstWhere('category', $category);
            $this->assertNotNull($item);
            $this->assertSame($slot, $item['layers'][0]['slot']);
        }
    }

    public function test_wardrobe_items_can_be_updated_and_archived_from_the_game_catalogue(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));
        $asset = MediaAsset::create([
            'category' => 'wardrobe',
            'label' => 'Robe',
            'wardrobe_slot' => 'outfit',
            'appearance_category' => 'outfit',
            'price' => 100,
            'file_path' => 'wardrobe/robe.png',
            'original_name' => 'robe.png',
            'mime_type' => 'image/png',
            'size' => 10,
        ]);
        Storage::disk('studio')->put($asset->file_path, 'image');

        Livewire::test(WardrobeLibrary::class)
            ->call('edit', $asset->id)
            ->set('label', 'Robe du soir')
            ->set('price', '125')
            ->call('save')
            ->assertHasNoErrors();
        $this->assertSame('Robe du soir', $asset->fresh()->label);
        $this->assertSame(125, $asset->fresh()->price);
        $this->getJson('/api/appearance/catalogue')->assertJsonPath('items.0.label', 'Robe du soir');
        Livewire::test(WardrobeLibrary::class)
            ->call('edit', $asset->id)
            ->set('appearanceCategory', 'top')
            ->call('save')
            ->assertHasErrors('appearanceCategory');
        $this->assertSame('outfit', $asset->fresh()->appearance_category);

        Livewire::test(WardrobeLibrary::class)->call('archive', $asset->id)->assertSee('Article archivé');
        $this->getJson('/api/appearance/catalogue')->assertOk()->assertJsonCount(0, 'items');
        $this->get("/api/media/{$asset->id}/file")->assertNotFound();
    }

    public function test_wardrobe_upload_requires_sprite_dimensions_and_valid_price(): void
    {
        $this->actingAs(User::factory()->create(['is_admin' => true]));

        Livewire::test(WardrobeLibrary::class)
            ->set('label', 'Image mal alignée')
            ->set('price', '1')
            ->set('upload', UploadedFile::fake()->image('ancienne-resolution.png', 600, 1200))
            ->call('save')
            ->assertHasErrors('upload');
        Livewire::test(WardrobeLibrary::class)
            ->set('label', 'Prix invalide')
            ->set('price', '-1')
            ->set('upload', UploadedFile::fake()->image('valide.png', 3000, 6000))
            ->call('save')
            ->assertHasErrors('price');

        $this->assertDatabaseCount('media_assets', 0);
    }

    public function test_wardrobe_is_admin_only(): void
    {
        $this->get('/studio/dressing')->assertRedirect('/login');
        $this->actingAs(User::factory()->create())->get('/studio/dressing')->assertForbidden();
    }
}
