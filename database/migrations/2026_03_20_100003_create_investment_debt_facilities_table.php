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
        Schema::create('investment_debt_facilities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('investment_projects')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('facility_name', 255);
            $table->string('facility_type', 64)->default('term_loan');
            $table->decimal('principal_amount', 15, 4);
            $table->string('currency', 3)->default('PLN');
            $table->string('base_rate_type', 32)->default('WIBOR_3M');
            $table->decimal('base_rate_percent', 6, 4)->default(0.0000);
            $table->decimal('margin_percent', 6, 4)->default(0.0000);
            $table->integer('tenor_months');
            $table->integer('grace_period_months')->default(0);
            $table->string('amortization_type', 32)->default('ANNUITY');
            $table->decimal('upfront_fee_percent', 5, 2)->default(0.00);
            $table->decimal('commitment_fee_percent', 5, 2)->default(0.00);
            $table->string('interest_payment_frequency', 16)->default('monthly');
            $table->string('principal_payment_frequency', 16)->default('monthly');
            $table->timestamps();

            $table->index(['project_id', 'facility_type']);
            $table->index(['company_id', 'project_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('investment_debt_facilities');
    }
};
