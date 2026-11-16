<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Apparence de Pommette : identifiants d'éléments du catalogue (cheveux, yeux, haut, bas, tenue, accessoire).
        // Nullable : une sauvegarde existante reçoit l'apparence par défaut du catalogue, sans migration de données.
        Schema::table('player_saves', function (Blueprint $table) {
            $table->json('appearance')->nullable()->after('player_name');
        });
    }

    public function down(): void
    {
        Schema::table('player_saves', function (Blueprint $table) {
            $table->dropColumn('appearance');
        });
    }
};