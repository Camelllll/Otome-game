<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('illustrations', function (Blueprint $table) {
            $table->enum('rarity', ['common', 'uncommon', 'rare', 'epic', 'ultra_rare', 'legendary'])
                ->default('common')->change();
        });
    }

    public function down(): void
    {
        if (DB::table('illustrations')->whereIn('rarity', ['uncommon', 'epic'])->exists()) {
            throw new RuntimeException('Impossible de revenir aux anciennes raretés : des illustrations utilisent uncommon ou epic.');
        }

        Schema::table('illustrations', function (Blueprint $table) {
            $table->enum('rarity', ['common', 'rare', 'ultra_rare', 'legendary'])
                ->default('common')->change();
        });
    }
};
