<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_assets', function (Blueprint $table) {
            $table->string('appearance_category', 20)->nullable();
        });

        DB::table('media_assets')
            ->where('category', 'wardrobe')
            ->whereNotNull('wardrobe_slot')
            ->update(['appearance_category' => DB::raw('wardrobe_slot')]);
    }

    public function down(): void
    {
        Schema::table('media_assets', function (Blueprint $table) {
            $table->dropColumn('appearance_category');
        });
    }
};
