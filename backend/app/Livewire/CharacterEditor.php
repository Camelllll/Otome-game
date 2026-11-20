<?php

namespace App\Livewire;

use App\Models\Character;
use App\Models\MediaAsset;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Livewire\Component;
use Livewire\WithFileUploads;

class CharacterEditor extends Component
{
    use WithFileUploads;

    // ── Liste ──────────────────────────────────────────────────────────────────
    public string $message = '';

    // ── Formulaire courant ─────────────────────────────────────────────────────
    public ?int   $editingId = null;   // null = création
    public string $slug      = '';
    public string $name      = '';
    public bool   $isPlayer    = false;
    public bool   $isSecondary = false;

    // Champs data basiques
    public string $sprite    = '';
    public string $tagline   = '';
    public string $age       = '';
    public string $formation = '';
    public string $taille    = '';
    public string $poids     = '';
    public string $signe     = '';
    public string $description = '';

    // Image importée depuis la fiche (enregistrée dans la médiathèque au moment de sauvegarder).
    public $spriteUpload = null;

    // Mode d'emploi : listes séparées par retour à la ligne dans le textarea
    public string $modeEmploiFaire   = '';
    public string $modeEmploiEviter  = '';

    public bool $panelOuvert = false;

    // ── Droits ─────────────────────────────────────────────────────────────────
    public function boot(): void
    {
        abort_unless(auth()->user()?->is_admin, 403);
    }

    // ── Rendu ──────────────────────────────────────────────────────────────────
    public function render()
    {
        $characters = Character::orderBy('is_player', 'desc')
            ->orderBy('is_secondary')
            ->orderBy('name')
            ->get();

        // « Mes fichiers » : toutes les images de personnages actives de la médiathèque.
        $fichiers = MediaAsset::query()
            ->where('category', 'characters')
            ->where('is_archived', false)
            ->orderBy('label')
            ->get();
        $parCle = $fichiers->whereNotNull('source_key')->keyBy('source_key');

        // Résout le sprite de chaque fiche vers le fichier de la médiathèque (même clé que l'API de jeu).
        $spriteUrls = [];
        foreach ($characters as $perso) {
            $sprite = $perso->data['sprite'] ?? null;
            $asset = is_string($sprite) ? $this->assetPourChemin($sprite, $parCle) : null;
            $url = $asset ? $asset->previewUrl() : (is_string($sprite) ? $this->urlPourChemin($sprite, $parCle) : null);
            // Repli : une fiche dont le sprite n'est pas reconnu garde souvent une URL absolue dans portraits.default.
            $portrait = $perso->data['portraits']['default'] ?? null;
            if ($url === null && is_string($portrait) && str_starts_with($portrait, 'http')) {
                $url = $portrait;
            }
            if ($url !== null) {
                $spriteUrls[$perso->id] = $url;
            }
        }

        // Aperçu de l'éditeur : image en cours d'import, sinon image actuellement choisie.
        $apercuUrl = null;
        $fichierActifId = null;
        if ($this->panelOuvert) {
            if ($this->spriteUpload && $this->spriteUpload->isPreviewable()) {
                $apercuUrl = $this->spriteUpload->temporaryUrl();
            } else {
                $chemin = trim($this->sprite);
                $actif = $this->assetPourChemin($chemin, $parCle);
                $fichierActifId = $actif?->id;
                $apercuUrl = $this->urlPourChemin($chemin, $parCle);
            }
        }

        return view('livewire.character-editor', [
            'characters' => $characters,
            'spriteUrls' => $spriteUrls,
            'fichiers' => $this->panelOuvert ? $fichiers : collect(),
            'apercuUrl' => $apercuUrl,
            'fichierActifId' => $fichierActifId,
        ])->layout('components.layouts.studio', ['title' => "Personnages — Studio"]);
    }

    // ── Ouvrir le formulaire de création ───────────────────────────────────────
    public function nouveauPerso(): void
    {
        $this->resetForm();
        $this->panelOuvert = true;
        $this->editingId   = null;
    }

    // ── Ouvrir le formulaire d'édition ─────────────────────────────────────────
    public function editer(int $id): void
    {
        $perso = Character::findOrFail($id);
        $data  = $perso->data ?? [];

        $this->resetForm();
        $this->resetValidation();

        $this->editingId   = $id;
        $this->slug        = $perso->slug;
        $this->name        = $perso->name;
        $this->isPlayer    = (bool) $perso->is_player;
        $this->isSecondary = (bool) $perso->is_secondary;

        $this->sprite      = $data['sprite']      ?? '';
        $this->tagline     = $data['tagline']      ?? '';
        $this->age         = isset($data['age']) ? (string) $data['age'] : '';
        $this->formation   = $data['formation']    ?? '';
        $this->taille      = $data['taille']       ?? '';
        $this->poids       = $data['poids']        ?? '';
        $this->signe       = $data['signe']        ?? '';
        $this->description = $data['description']  ?? '';

        $faire  = $data['carnet']['modeEmploi']['faire']  ?? [];
        $eviter = $data['carnet']['modeEmploi']['eviter'] ?? [];

        $this->modeEmploiFaire  = implode("\n", $faire);
        $this->modeEmploiEviter = implode("\n", $eviter);

        $this->panelOuvert = true;
        $this->message     = '';
    }

    // ── Choisir une image dans « Mes fichiers » ────────────────────────────────
    public function choisirImage(int $assetId): void
    {
        $asset = MediaAsset::query()
            ->where('category', 'characters')
            ->where('is_archived', false)
            ->findOrFail($assetId);

        // Un fichier importé avant ce système n'a pas de clé : on lui en donne une pour que le jeu le retrouve.
        if (! $asset->source_path || ! $asset->source_key) {
            $extension = strtolower(pathinfo($asset->file_path, PATHINFO_EXTENSION)) ?: 'png';
            $asset->source_path = 'studio/characters/media-'.$asset->id.'.'.$extension;
            $asset->source_key = hash('sha256', $asset->source_path);
            $asset->save();
        }

        $this->sprite = $asset->source_path;
        $this->spriteUpload = null;
        $this->resetValidation('spriteUpload');
    }

    // ── Fermer le panneau sans sauvegarder ─────────────────────────────────────
    public function annuler(): void
    {
        $this->resetForm();
        $this->panelOuvert = false;
    }

    // ── Sauvegarder (création ou mise à jour) ──────────────────────────────────
    public function sauvegarder(): void
    {
        $regles = [
            'slug'      => ['required', 'string', 'max:100', 'regex:/^[a-zA-Z0-9_-]+$/'],
            'name'      => 'required|string|max:255',
            'age'       => 'nullable|string|max:20',
            'formation' => 'nullable|string|max:255',
            'taille'    => 'nullable|string|max:100',
            'poids'     => 'nullable|string|max:100',
            'signe'     => 'nullable|string|max:100',
            'sprite'    => 'nullable|string|max:1000',
            'spriteUpload' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,gif', 'max:'.MediaAsset::MAX_UPLOAD_KB],
            'tagline'   => 'nullable|string|max:500',
            'description'       => 'nullable|string|max:2000',
            'modeEmploiFaire'   => 'nullable|string|max:3000',
            'modeEmploiEviter'  => 'nullable|string|max:3000',
        ];

        // Slug unique sauf pour le perso en cours d'édition.
        if ($this->editingId) {
            $regles['slug'][] = "unique:characters,slug,{$this->editingId}";
        } else {
            $regles['slug'][] = 'unique:characters,slug';
        }

        $this->validate($regles, [
            'slug.required'    => "L'identifiant est obligatoire.",
            'slug.regex'       => "L'identifiant ne peut contenir que des lettres, chiffres, tirets et underscores.",
            'slug.unique'      => "Cet identifiant est déjà utilisé par un autre personnage.",
            'name.required'    => 'Le nom du personnage est obligatoire.',
            'spriteUpload.mimes' => 'L’image doit être au format JPG, PNG, WebP ou GIF.',
            'spriteUpload.max' => 'L’image dépasse la taille maximale autorisée.',
        ]);

        // Une image importée devient un fichier de la médiathèque, relié à la fiche.
        $sprite = trim($this->sprite);
        if ($this->spriteUpload) {
            $sprite = $this->enregistrerImage();
        }

        // Construction du tableau data.
        $faire  = $this->lignes($this->modeEmploiFaire);
        $eviter = $this->lignes($this->modeEmploiEviter);

        $data = array_filter([
            'sprite'      => $sprite ?: null,
            'tagline'     => trim($this->tagline)      ?: null,
            'age'         => trim($this->age)          ?: null,
            'formation'   => trim($this->formation)    ?: null,
            'taille'      => trim($this->taille)       ?: null,
            'poids'       => trim($this->poids)        ?: null,
            'signe'       => trim($this->signe)        ?: null,
            'description' => trim($this->description)  ?: null,
        ], fn($v) => $v !== null);

        if ($faire || $eviter) {
            $data['carnet'] = [
                'modeEmploi' => array_filter([
                    'faire'  => $faire  ?: null,
                    'eviter' => $eviter ?: null,
                ], fn($v) => $v !== null),
            ];
        }

        if ($this->editingId) {
            $perso = Character::findOrFail($this->editingId);
            // Fusionne les données existantes pour ne pas écraser les champs gérés ailleurs.
            $ancienData = $perso->data ?? [];
            $perso->update([
                'slug'         => $this->slug,
                'name'         => $this->name,
                'is_player'    => $this->isPlayer,
                'is_secondary' => $this->isSecondary,
                'data'         => $this->fusionner($ancienData, $data),
            ]);
            $this->message = "✓ Personnage « {$perso->name} » mis à jour.";
        } else {
            Character::create([
                'slug'         => $this->slug,
                'name'         => $this->name,
                'is_player'    => $this->isPlayer,
                'is_secondary' => $this->isSecondary,
                'data'         => $data,
            ]);
            $this->message = "✓ Personnage « {$this->name} » créé.";
        }

        $this->resetForm();
        $this->panelOuvert = false;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────
    private function resetForm(): void
    {
        $this->editingId        = null;
        $this->slug             = '';
        $this->name             = '';
        $this->isPlayer         = false;
        $this->isSecondary      = false;
        $this->sprite           = '';
        $this->spriteUpload     = null;
        $this->tagline          = '';
        $this->age              = '';
        $this->formation        = '';
        $this->taille           = '';
        $this->poids            = '';
        $this->signe            = '';
        $this->description      = '';
        $this->modeEmploiFaire  = '';
        $this->modeEmploiEviter = '';
    }

    /** Range l'image importée dans la médiathèque (catégorie characters) et renvoie le chemin logique à stocker dans la fiche. */
    private function enregistrerImage(): string
    {
        $upload  = $this->spriteUpload;
        $fichier = $upload->store('characters', 'studio');
        $source  = 'studio/characters/'.Str::uuid().'.'.strtolower($upload->extension());

        try {
            MediaAsset::create([
                'category'      => 'characters',
                'label'         => trim($this->name),
                'description'   => '',
                'file_path'     => $fichier,
                'original_name' => $upload->getClientOriginalName(),
                'mime_type'     => $upload->getMimeType(),
                'size'          => $upload->getSize(),
                'is_archived'   => false,
                'source_path'   => $source,
                'source_key'    => hash('sha256', $source),
            ]);
        } catch (\Throwable $exception) {
            Storage::disk('studio')->delete($fichier);
            throw $exception;
        }

        return $source;
    }

    /** Fusionne les nouvelles données et garde le portrait « default » aligné quand le sprite change. */
    private function fusionner(array $ancien, array $data): array
    {
        $fusion = array_merge($ancien, $data);

        if (isset($data['sprite'])
            && ($ancien['sprite'] ?? null) !== $data['sprite']
            && isset($fusion['portraits']['default'])) {
            $fusion['portraits']['default'] = $data['sprite'];
        }

        return $fusion;
    }

    /** Fichier de la médiathèque correspondant à un chemin de sprite (même clé que l'API de jeu). */
    private function assetPourChemin(string $chemin, Collection $parCle): ?MediaAsset
    {
        if ($chemin === '' || str_starts_with($chemin, 'http')) {
            return null;
        }

        return $parCle->get(hash('sha256', $this->canonicalPath($chemin)));
    }

    /** URL affichable dans le studio pour un chemin de sprite, ou null s'il n'y a pas de fichier. */
    private function urlPourChemin(string $chemin, Collection $parCle): ?string
    {
        if ($chemin === '') {
            return null;
        }
        if (str_starts_with($chemin, 'http')) {
            return $chemin;
        }

        return $this->assetPourChemin($chemin, $parCle)?->url();
    }

    /** Même normalisation que GameContentController::canonicalPath(). */
    private function canonicalPath(string $path): string
    {
        $path = rawurldecode($path);

        return class_exists(\Normalizer::class) ? (\Normalizer::normalize($path, \Normalizer::FORM_C) ?: $path) : $path;
    }

    /** Découpe un textarea en tableau de lignes non vides. */
    private function lignes(string $texte): array
    {
        return array_values(array_filter(
            array_map('trim', explode("\n", $texte)),
            fn($ligne) => $ligne !== ''
        ));
    }
}