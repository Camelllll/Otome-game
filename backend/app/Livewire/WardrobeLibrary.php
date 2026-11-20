<?php

namespace App\Livewire;

use App\Models\MediaAsset;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Livewire\Attributes\Locked;
use Livewire\Component;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class WardrobeLibrary extends Component
{
    use WithFileUploads, WithPagination;

    #[Locked]
    public ?int $editingId = null;

    public string $label = '';

    public string $appearanceCategory = 'top';

    public string $price = '';

    public $upload;

    public bool $showArchived = false;

    public string $message = '';

    public function boot(): void
    {
        abort_unless(auth()->user()?->is_admin, 403);
    }

    public function updatedShowArchived(): void
    {
        $this->resetPage();
    }

    public function cancel(): void
    {
        $this->reset('editingId', 'label', 'appearanceCategory', 'price', 'upload');
        $this->appearanceCategory = 'top';
        $this->resetValidation();
    }

    public function edit(int $id): void
    {
        $asset = MediaAsset::query()->where('category', 'wardrobe')->findOrFail($id);
        $this->cancel();
        $this->editingId = $asset->id;
        $this->label = $asset->label;
        $this->appearanceCategory = $asset->appearance_category ?? $asset->wardrobe_slot;
        $this->price = $asset->price === null ? '' : (string) $asset->price;
    }

    public function save(): void
    {
        $imageWidth = MediaAsset::WARDROBE_IMAGE_WIDTH;
        $imageHeight = MediaAsset::WARDROBE_IMAGE_HEIGHT;
        $this->validate([
            'label' => ['required', 'string', 'max:255'],
            'appearanceCategory' => ['required', Rule::in(array_keys(self::APPEARANCE_CATEGORIES))],
            'price' => ['nullable', 'integer', 'min:0', 'max:1000000'],
        ]);
        $existing = $this->editingId
            ? MediaAsset::query()->where('category', 'wardrobe')->findOrFail($this->editingId)
            : null;
        $existingCategory = $existing?->appearance_category ?? $existing?->wardrobe_slot;
        if ($existing && $existingCategory !== $this->appearanceCategory) {
            $this->addError('appearanceCategory', 'La catégorie d’un article existant ne peut pas être modifiée.');

            return;
        }
        $this->validate(['upload' => [
            $existing ? 'nullable' : 'required',
            'file',
            'mimes:png',
            "dimensions:width={$imageWidth},height={$imageHeight}",
            'max:'.MediaAsset::MAX_UPLOAD_KB,
        ]], [
            'upload.required' => "Ajoute un PNG transparent de {$imageWidth} × {$imageHeight} pixels.",
            'upload.mimes' => 'L’image doit être un fichier PNG transparent.',
            'upload.dimensions' => "Le PNG doit mesurer exactement {$imageWidth} × {$imageHeight} pixels.",
        ]);

        $path = $this->upload ? $this->upload->store('wardrobe', 'studio') : null;
        try {
            DB::transaction(function () use ($existing, $path) {
                $asset = $existing
                    ? MediaAsset::query()->where('category', 'wardrobe')->lockForUpdate()->findOrFail($existing->id)
                    : new MediaAsset;
                $asset->fill([
                    'category' => 'wardrobe',
                    'label' => trim($this->label),
                    'appearance_category' => $this->appearanceCategory,
                    'price' => trim($this->price) === '' ? null : (int) $this->price,
                ]);
                if ($path) {
                    if ($asset->exists) {
                        $asset->previous_files = [...($asset->previous_files ?? []), $asset->file_path];
                    }
                    $asset->file_path = $path;
                    $asset->original_name = $this->upload->getClientOriginalName();
                    $asset->mime_type = $this->upload->getMimeType();
                    $asset->size = $this->upload->getSize();
                }
                $asset->save();
            });
        } catch (\Throwable $exception) {
            if ($path) {
                Storage::disk('studio')->delete($path);
            }
            throw $exception;
        }

        $this->cancel();
        $this->message = $existing ? 'Article mis à jour.' : 'Article ajouté au dressing.';
    }

    public function archive(int $id): void
    {
        $asset = MediaAsset::query()->where('category', 'wardrobe')->findOrFail($id);
        $asset->is_archived = ! $asset->is_archived;
        $asset->save();
        if ($this->editingId === $asset->id) {
            $this->cancel();
        }
        $this->message = $asset->is_archived
            ? 'Article archivé : il n’apparaît plus dans le dressing du jeu.'
            : 'Article restauré dans le dressing du jeu.';
    }

    public const APPEARANCE_CATEGORIES = [
        'skin' => 'Peau',
        'hair' => 'Cheveux',
        'eyes' => 'Yeux',
        'eyebrows' => 'Sourcils',
        'mouth' => 'Bouche',
        'top' => 'Hauts',
        'bottom' => 'Bas',
        'shoes' => 'Chaussures',
        'outfit' => 'Tenue complète',
        'accessory' => 'Accessoires',
    ];

    public function render()
    {
        return view('livewire.wardrobe-library', [
            'items' => MediaAsset::query()
                ->where('category', 'wardrobe')
                ->where('is_archived', $this->showArchived)
                ->orderByDesc('id')
                ->paginate(12),
        ])->layout('components.layouts.studio', ['title' => 'Dressing — Studio']);
    }
}
