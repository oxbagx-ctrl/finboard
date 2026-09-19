<?php

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
        Schema::create('financial_benchmarks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->string('metric_type', 64)->index();
            $table->decimal('target_value', 12, 4);
            $table->decimal('warning_threshold', 12, 4);
            $table->decimal('critical_threshold', 12, 4)->nullable();
            $table->boolean('higher_is_better')->default(true);
            $table->string('description', 255)->nullable();
            $table->uuid('updated_by')->nullable()->index();
            $table->timestamps();

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->cascadeOnDelete();

            $table->foreign('updated_by')
                ->references('id')
                ->on('users')
                ->nullOnDelete();

            $table->unique(['company_id', 'metric_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('financial_benchmarks');
    }
};
