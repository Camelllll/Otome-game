<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Une ligne par emplacement : slot 0 = sauvegarde principale (autosave), 1..9 = emplacements manuels.
        Schema::create('player_saves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('slot')->default(0);
            $table->string('label', 60)->nullable();
            $table->string('player_name', 40)->default('Sucrette');
            $table->string('current_episode', 80)->nullable();
            $table->string('current_node', 120)->nullable();
            $table->string('current_background', 300)->nullable();
            $table->json('gauges');
            $table->json('flags');
            $table->json('choices');
            $table->json('stats');
            $table->unsignedInteger('currency')->default(0);
            $table->json('inventory');
            $table->unsignedSmallInteger('action_points')->default(25);
            $table->timestamp('last_action_points_at')->useCurrent();
            $table->json('history');
            $table->json('completed_episodes');
            $table->unsignedBigInteger('revision')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'slot']);
        });

        // Journal des choix importants (historique auditable côté serveur).
        Schema::create('player_choices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('slot')->default(0);
            $table->string('episode_id', 80)->nullable();
            $table->string('node_id', 120)->nullable();
            $table->smallInteger('option_index')->nullable();
            $table->string('option_label', 300)->nullable();
            $table->json('flags');
            $table->json('effects');
            $table->timestamp('chosen_at')->useCurrent();

            $table->index(['user_id', 'slot', 'chosen_at']);
        });

        Schema::create('player_illustrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('illustration_path');
            // Empreinte du chemin : un index unique direct sur un chemin de 1000 caractères serait trop long.
            $table->char('path_hash', 64);
            $table->string('episode_id', 80)->nullable();
            $table->string('node_id', 120)->nullable();
            $table->timestamp('acquired_at')->useCurrent();

            $table->unique(['user_id', 'path_hash']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('player_illustrations');
        Schema::dropIfExists('player_choices');
        Schema::dropIfExists('player_saves');
    }
};