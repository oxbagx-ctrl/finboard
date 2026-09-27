<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaction_folders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->uuid('parent_id')->nullable();
            $table->string('index_code', 50);
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['company_id', 'parent_id']);
            $table->index(['company_id', 'index_code']);
            $table->unique(['company_id', 'index_code']);
        });

        Schema::table('transaction_folders', function (Blueprint $table) {
            $table->foreign('parent_id')->references('id')->on('transaction_folders')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_folders');
    }
};
