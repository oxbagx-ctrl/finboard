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
        Schema::create('exchange_rates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('currency', 3)->unique();
            $table->string('currency_name', 100);
            $table->decimal('mid_rate', 10, 4);
            $table->decimal('multiplier', 12, 8);
            $table->string('table_no', 50);
            $table->date('effective_date');
            $table->string('source', 30)->default('NBP');
            $table->timestampTz('fetched_at');
            $table->timestamps();

            $table->index(['currency', 'effective_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('exchange_rates');
    }
};
