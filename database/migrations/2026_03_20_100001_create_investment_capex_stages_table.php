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
        Schema::create('investment_capex_stages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('investment_projects')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('stage_name', 255);
            $table->decimal('net_amount', 15, 4);
            $table->string('currency', 3)->default('PLN');
            $table->decimal('vat_rate_percent', 5, 2)->default(23.00);
            $table->string('vat_rate_code', 16)->default('standard');
            $table->date('start_date');
            $table->date('completion_date');
            $table->string('kst_code', 32)->nullable();
            $table->decimal('kst_annual_rate', 5, 2)->default(2.50);
            $table->boolean('eligible_for_grant')->default(false);
            $table->integer('order_index')->default(0);
            $table->timestamps();

            $table->index(['project_id', 'order_index']);
            $table->index(['company_id', 'project_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('investment_capex_stages');
    }
};
