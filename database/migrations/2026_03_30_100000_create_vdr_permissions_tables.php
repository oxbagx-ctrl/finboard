<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vdr_folder_permissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('folder_id')->constrained('transaction_folders')->cascadeOnDelete();
            $table->string('subject_type', 32); // 'role' or 'user'
            $table->string('subject_id', 255);  // role name (e.g. 'client', 'advisor') or user UUID
            $table->string('permission_level', 32)->default('view'); // 'none', 'view', 'download', 'manage'
            $table->boolean('watermark_required')->default(false);
            $table->timestamps();

            $table->unique(
                ['company_id', 'folder_id', 'subject_type', 'subject_id'],
                'vdr_folder_perm_unique'
            );
            $table->index(['company_id', 'folder_id']);
            $table->index(['subject_type', 'subject_id']);
        });

        Schema::create('vdr_document_permissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('document_id')->constrained('documents')->cascadeOnDelete();
            $table->string('subject_type', 32); // 'role' or 'user'
            $table->string('subject_id', 255);  // role name or user UUID
            $table->string('permission_level', 32)->default('view'); // 'none', 'view', 'download', 'manage'
            $table->boolean('watermark_required')->default(false);
            $table->timestamps();

            $table->unique(
                ['company_id', 'document_id', 'subject_type', 'subject_id'],
                'vdr_doc_perm_unique'
            );
            $table->index(['company_id', 'document_id']);
            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vdr_document_permissions');
        Schema::dropIfExists('vdr_folder_permissions');
    }
};
