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
        Schema::create('investment_grant_allocations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('investment_projects')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('grant_program_name', 255);
            $table->decimal('total_eligible_costs', 15, 4);
            $table->decimal('co_financing_rate_percent', 5, 2);
            $table->decimal('max_grant_amount', 15, 4);
            $table->decimal('advance_payment_amount', 15, 4)->default(0.0000);
            $table->string('currency', 3)->default('PLN');
            $table->string('status', 32)->default('applied')->index(); // applied, approved, contracted, disbursed, settled
            $table->json('disbursement_schedule')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'status']);
            $table->index(['company_id', 'project_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('investment_grant_allocations');
    }
};
