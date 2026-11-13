<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Métadonnées des illustrations du carnet de relations (gérées dans le studio, section « Illustrations »).
        Schema::create('illustrations', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 120)->unique();
            $table->string('title', 160);
            $table->foreignId('media_asset_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->string('episode_id', 80)->nullable();
            $table->json('character_ids');
            $table->string('unlock_node_id', 120)->nullable();
            $table->string('unlock_condition', 20)->default('viewed');
            $table->unsignedTinyInteger('spoiler_level')->default(1);
            $table->timestamps();

            $table->index('episode_id');
        });

        // Progression du carnet : colonnes nullables pour ne pas toucher aux sauvegardes existantes.
        Schema::table('player_saves', function (Blueprint $table) {
            $table->json('discovered_character_ids')->nullable()->after('completed_episodes');
            $table->json('unlocked_illustration_ids')->nullable()->after('discovered_character_ids');
        });
    }

    public function down(): void
    {
        Schema::table('player_saves', function (Blueprint $table) {
            $table->dropColumn(['discovered_character_ids', 'unlocked_illustration_ids']);
        });
        Schema::dropIfExists('illustrations');
    }
};