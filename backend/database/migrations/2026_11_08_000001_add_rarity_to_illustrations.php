<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('illustrations', function (Blueprint $table) {
            // Après spoiler_level pour garder un ordre logique.
            $table->enum('rarity', ['common', 'rare', 'ultra_rare', 'legendary'])
                  ->default('common')
                  ->after('spoiler_level');
        });
    }

    public function down(): void
    {
        Schema::table('illustrations', function (Blueprint $table) {
            $table->dropColumn('rarity');
        });
    }
};