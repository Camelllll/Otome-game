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

class MediaLibrary extends Component
{
    use WithFileUploads, WithPagination;

    public string $category = 'backgrounds';

    public string $search = '';

    public bool $showArchived = false;

    #[Locked]
    public ?int $editingId = null;

    public string $label = '';

    public string $description = '';

    public $upload;

    public string $message = '';

    public bool $showCarnet = false;

    #[Locked]
    public ?int $carnetAssetId = null;

    /** Change à chaque ouverture pour remonter le formulaire du carnet à neuf. */
    #[Locked]
    public int $carnetNonce = 0;

    public function boot(): void
    {
        abort_unless(auth()->user()?->is_admin, 403);
    }

    public function updatedSearch(): void
    {
        $this->resetPage();
    }

    public function updatedShowArchived(): void
    {
        $this->resetPage();
    }

    public function chooseCategory(string $category): void
    {
        abort_unless(array_key_exists($category, MediaAsset::CATEGORIES) && ! in_array($category, ['characters', 'wardrobe'], true), 422);
        $this->category = $category;
        $this->showCarnet = false;
        $this->cancel();
        $this->resetPage();
    }

    public function openCarnet(?int $assetId = null): void
    {
        abort_unless($this->category === 'illustrations', 422);
        $this->cancel();
        $this->carnetAssetId = $assetId;
        $this->carnetNonce++;
        $this->showCarnet = true;
    }

    public function closeCarnet(): void
    {
        $this->showCarnet = false;
        $this->carnetAssetId = null;
    }

    public function cancel(): void
    {
        $this->reset('editingId', 'label', 'description', 'upload');
        $this->resetValidation();
    }

    public function edit(int $id): void
    {
        $asset = MediaAsset::findOrFail($id);
        $this->cancel();
        $this->editingId = $asset->id;
        $this->category = $asset->category;
        $this->label = $asset->label;
        $this->description = $asset->description ?? '';
    }

    public function save(): void
    {
        $this->validate([
            'category' => ['required', Rule::in(array_diff(array_keys(MediaAsset::CATEGORIES), ['wardrobe']))],
            'label' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:3000'],
        ]);
        $existing = $this->editingId ? MediaAsset::findOrFail($this->editingId) : null;
        if ($existing && $existing->category !== $this->category) {
            $this->addError('category', 'La catégorie d’un média existant ne peut pas être modifiée.');

            return;
        }
        $this->validate(['upload' => [
            $existing ? 'nullable' : 'required',
            'file',
            $this->category === 'music' ? 'mimes:mp3,wav,ogg,m4a' : 'mimes:jpg,jpeg,png,webp,gif',
            'max:'.MediaAsset::MAX_UPLOAD_KB,
        ]]);
        $path = $this->upload ? $this->upload->store($this->category, 'studio') : null;
        try {
            DB::transaction(function () use ($existing, $path) {
                $asset = $existing ? MediaAsset::lockForUpdate()->findOrFail($existing->id) : new MediaAsset;
                $asset->fill(['label' => trim($this->label), 'description' => trim($this->description), 'category' => $this->category]);
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
        $this->message = $existing ? 'Média mis à jour. Son lien reste identique dans les épisodes.' : 'Média ajouté à la bibliothèque.';
        $this->resetPage();
    }

    public function archive(int $id): void
    {
        $asset = MediaAsset::findOrFail($id);
        $asset->is_archived = ! $asset->is_archived;
        $asset->save();
        if ($this->editingId === $asset->id) {
            $this->cancel();
        }
        $this->message = $asset->is_archived
            ? 'Média archivé : masqué des sélecteurs, mais les liens existants continuent à fonctionner.'
            : 'Média restauré dans les sélecteurs.';
    }

    public function render()
    {
        $assets = MediaAsset::query()
            ->where('category', $this->category)
            ->where('is_archived', $this->showArchived)
            ->when($this->search !== '', fn ($query) => $query->where(function ($query) {
                $query->where('label', 'like', '%'.$this->search.'%')
                    ->orWhere('description', 'like', '%'.$this->search.'%');
            }))
            ->orderByDesc('id')->paginate(12);

        return view('livewire.media-library', [
            'assets' => $assets,
            'categories' => array_diff_key(MediaAsset::CATEGORIES, ['characters' => true, 'wardrobe' => true]),
            'phpUploadLimit' => ini_get('upload_max_filesize'),
            'phpPostLimit' => ini_get('post_max_size'),
            'uploadLimitMb' => MediaAsset::MAX_UPLOAD_KB / 1024,
            'counts' => MediaAsset::where('is_archived', false)->selectRaw('category, count(*) as total')->groupBy('category')->pluck('total', 'category'),
        ])->layout('components.layouts.studio');
    }
}
