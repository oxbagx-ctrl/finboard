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
        Schema::create('advisor_company', function (Blueprint $table) {
            $table->uuid('advisor_id')->index();
            $table->uuid('company_id')->index();
            $table->uuid('assigned_by')->nullable()->index();
            $table->timestamps();

            $table->primary(['advisor_id', 'company_id']);

            $table->foreign('advisor_id')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->cascadeOnDelete();

            $table->foreign('assigned_by')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('advisor_company');
    }
};
