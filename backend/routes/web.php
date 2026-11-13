<?php

use App\Http\Controllers\EpisodeStudioController;
use App\Http\Controllers\SessionController;
use App\Http\Middleware\RequireAdmin;
use App\Livewire\CharacterEditor;
use App\Livewire\EpisodeIndex;
use App\Livewire\MediaLibrary;
use App\Models\Episode;
use App\Models\MediaAsset;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

Route::redirect('/', '/studio');
Route::middleware('guest')->group(function () {
    Route::view('/login', 'auth.login')->name('login');
    Route::post('/login', [SessionController::class, 'store'])->middleware('throttle:5,1');
});
Route::post('/logout', [SessionController::class, 'destroy'])->middleware('auth')->name('logout');
Route::middleware(['auth', RequireAdmin::class])->prefix('studio')->name('studio.')->group(function () {
    Route::get('/', EpisodeIndex::class)->name('index');
    Route::get('/personnages', CharacterEditor::class)->name('characters');
    Route::get('/media', MediaLibrary::class)->name('media');
    Route::get('/media/{mediaAsset}/file', function (MediaAsset $mediaAsset) {
        $disk = Storage::disk('studio');
        abort_unless($disk->exists($mediaAsset->file_path), 404, 'Fichier média introuvable.');

        return response()->file($disk->path($mediaAsset->file_path), [
            'Content-Type' => $mediaAsset->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    })->name('media.file');
    Route::post('/episode-flow/save', [EpisodeStudioController::class, 'save'])->name('flow.save');
    Route::post('/episode-flow/create', [EpisodeStudioController::class, 'create'])->name('flow.create');
    Route::post('/episode-flow/import', [EpisodeStudioController::class, 'import'])->name('flow.import');
    Route::post('/episode-flow/publish', [EpisodeStudioController::class, 'publish'])->name('flow.publish');
    Route::get('/episodes/{episode}', [EpisodeStudioController::class, 'show'])->name('edit');
    Route::get('/episodes/{episode}/preview', function (Episode $episode) {
        $version = $episode->latestVersion();
        abort_unless($version, 404);

        return view('studio.preview', ['episode' => $episode, 'version' => $version]);
    })->name('preview');
    Route::get('/episodes/{episode}/export', function (Episode $episode) {
        $version = $episode->latestVersion();
        abort_unless($version, 404);

        return response()->streamDownload(function () use ($version) {
            echo json_encode($version->data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        }, $episode->slug.'.json', ['Content-Type' => 'application/json']);
    })->name('export');
});
