<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('document_access_logs', function (Blueprint $table) {
            $table->dropForeign(['document_id']);
            $table->uuid('document_id')->nullable()->change();
            $table->string('document_title', 255)->nullable()->after('document_id');
            $table->foreignUuid('company_id')->nullable()->after('user_id')->constrained('companies')->cascadeOnDelete();
            $table->foreign('document_id')->references('id')->on('documents')->nullOnDelete();
        });

        // Backfill document_title and company_id for existing access logs
        if (Schema::hasTable('document_access_logs') && Schema::hasTable('documents')) {
            DB::statement('
                UPDATE document_access_logs
                SET document_title = documents.title,
                    company_id = documents.company_id
                FROM documents
                WHERE document_access_logs.document_id = documents.id
            ');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('document_access_logs', function (Blueprint $table) {
            $table->dropForeign(['document_id']);
            $table->dropForeign(['company_id']);
            $table->dropColumn(['document_title', 'company_id']);
            $table->uuid('document_id')->nullable(false)->change();
            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
