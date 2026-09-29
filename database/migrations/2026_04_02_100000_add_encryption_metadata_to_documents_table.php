<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->boolean('is_encrypted')->default(false)->after('storage_path')->index();
            $table->string('encryption_algo', 32)->nullable()->after('is_encrypted');
            $table->text('encryption_iv')->nullable()->after('encryption_algo');
            $table->text('encryption_tag')->nullable()->after('encryption_iv');
            $table->string('key_id', 64)->default('vdr-key-1')->after('encryption_tag');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex(['is_encrypted']);
            $table->dropColumn([
                'is_encrypted',
                'encryption_algo',
                'encryption_iv',
                'encryption_tag',
                'key_id',
            ]);
        });
    }
};
