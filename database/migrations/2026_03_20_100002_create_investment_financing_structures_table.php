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
        Schema::create('investment_financing_structures', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->unique()->constrained('investment_projects')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->decimal('equity_contribution', 15, 4)->default(0.0000);
            $table->decimal('bank_loan_amount', 15, 4)->default(0.0000);
            $table->decimal('grant_amount', 15, 4)->default(0.0000);
            $table->decimal('vat_bridge_loan', 15, 4)->default(0.0000);
            $table->string('currency', 3)->default('PLN');
            $table->json('grant_disbursement_schedule')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'project_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('investment_financing_structures');
    }
};
