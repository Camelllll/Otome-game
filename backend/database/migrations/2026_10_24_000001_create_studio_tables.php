<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false);
        });
        Schema::create('episodes', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 100)->unique();
            $table->string('title');
            $table->unsignedInteger('position')->default(0);
            $table->unsignedBigInteger('published_version_id')->nullable();
            $table->timestamps();
        });
        Schema::create('episode_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('episode_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('number');
            $table->json('data');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['episode_id', 'number']);
        });
        Schema::table('episodes', function (Blueprint $table) {
            $table->foreign('published_version_id')->references('id')->on('episode_versions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('episodes', fn (Blueprint $table) => $table->dropForeign(['published_version_id']));
        Schema::dropIfExists('episode_versions');
        Schema::dropIfExists('episodes');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('is_admin'));
    }
};
