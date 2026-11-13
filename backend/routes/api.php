<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\GameContentController;
use App\Http\Controllers\Api\IllustrationController;
use App\Http\Controllers\Api\SaveController;
use Illuminate\Support\Facades\Route;

// Contenu public (lecture seule).
Route::middleware('throttle:120,1')->group(function () {
    Route::get('/characters', [GameContentController::class, 'characters']);
    Route::get('/backgrounds', [GameContentController::class, 'backgrounds']);
    Route::get('/media/{id}/file', [GameContentController::class, 'characterMedia'])->whereNumber('id')->name('game.character-media');
    Route::get('/episodes', [GameContentController::class, 'episodes']);
    Route::get('/episodes/{slug}', [GameContentController::class, 'episode'])->where('slug', '[A-Za-z0-9_-]+');
    Route::get('/shop', [GameContentController::class, 'shop']);
    Route::get('/illustrations/catalogue', [GameContentController::class, 'illustrations']);
});

// Comptes joueurs.
Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

// Données du joueur connecté (jeton Bearer Sanctum).
Route::middleware(['auth:sanctum', 'throttle:300,1'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/saves', [SaveController::class, 'index']);
    Route::get('/saves/{slot}', [SaveController::class, 'show'])->whereNumber('slot');
    Route::put('/saves/{slot}', [SaveController::class, 'update'])->whereNumber('slot');
    Route::post('/saves/{slot}/copy', [SaveController::class, 'copy'])->whereNumber('slot');
    Route::post('/saves/{slot}/reset', [SaveController::class, 'reset'])->whereNumber('slot');
    Route::get('/saves/{slot}/choices', [SaveController::class, 'choices'])->whereNumber('slot');
    Route::post('/saves/{slot}/choices', [SaveController::class, 'recordChoice'])->whereNumber('slot');

    Route::get('/illustrations', [IllustrationController::class, 'index']);
    Route::post('/illustrations', [IllustrationController::class, 'store']);
});