<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->foreignUuid('folder_id')->nullable()->after('company_id')->constrained('transaction_folders')->nullOnDelete();
            $table->string('index_code', 50)->nullable()->after('type')->index();

            $table->index(['company_id', 'folder_id']);
            $table->index(['company_id', 'index_code']);
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropForeign(['folder_id']);
            $table->dropIndex(['company_id', 'folder_id']);
            $table->dropIndex(['company_id', 'index_code']);
            $table->dropColumn(['folder_id', 'index_code']);
        });
    }
};
