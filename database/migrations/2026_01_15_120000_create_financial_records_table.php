<?php

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
        Schema::create('financial_categories', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('name');
            $table->string('type', 64)->index();
            $table->string('code', 32)->index();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('financial_records', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('category_id', 64);
            $table->foreign('category_id')->references('id')->on('financial_categories')->restrictOnDelete();
            $table->string('record_type', 32)->index();
            $table->decimal('amount', 15, 4);
            $table->string('currency', 3)->default('PLN');
            $table->date('record_date')->index();
            $table->string('description', 255);
            $table->string('source', 64)->default('manual');
            $table->timestamps();

            $table->index(['company_id', 'record_date']);
            $table->index(['company_id', 'category_id', 'record_date']);
            $table->index(['company_id', 'record_type', 'record_date']);
        });

        // Seed initial financial categories
        $now = now();
        $categories = [
            [
                'id' => 'cat-revenue',
                'name' => 'Przychody ze sprzedaży',
                'type' => 'revenue',
                'code' => 'REV',
                'description' => 'Główne przychody operacyjne ze sprzedaży towarów i usług',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-cogs',
                'name' => 'Koszty bezpośrednie (COGS)',
                'type' => 'cogs',
                'code' => 'COGS',
                'description' => 'Koszt własny sprzedaży i wytworzenia towarów',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-opex',
                'name' => 'Koszty operacyjne (OPEX)',
                'type' => 'opex',
                'code' => 'OPEX',
                'description' => 'Koszty ogólnego zarządu, sprzedaży i marketingu',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-depreciation',
                'name' => 'Amortyzacja',
                'type' => 'depreciation',
                'code' => 'DEP',
                'description' => 'Odpisy amortyzacyjne środków trwałych i wartości niematerialnych',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-financial',
                'name' => 'Koszty finansowe',
                'type' => 'financial',
                'code' => 'FIN',
                'description' => 'Odsetki bankowe, prowizje i ujemne różnice kursowe',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-tax',
                'name' => 'Podatek dochodowy',
                'type' => 'tax',
                'code' => 'TAX',
                'description' => 'Obciążenia podatkowe od zysku',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-cash',
                'name' => 'Środki pieniężne',
                'type' => 'cash',
                'code' => 'CASH',
                'description' => 'Środki na rachunkach bankowych i w kasie',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-receivables',
                'name' => 'Należności krótkoterminowe',
                'type' => 'receivables',
                'code' => 'REC',
                'description' => 'Należności handlowe z terminem spłaty do 12 miesięcy',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-inventory',
                'name' => 'Zapasy',
                'type' => 'inventory',
                'code' => 'INV',
                'description' => 'Towary, materiały i wyroby gotowe',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-other-current-assets',
                'name' => 'Pozostałe aktywa obrotowe',
                'type' => 'other_current_assets',
                'code' => 'OCA',
                'description' => 'Krótkoterminowe rozliczenia międzyokresowe i inne aktywa obrotowe',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-fixed-assets',
                'name' => 'Aktywa trwałe',
                'type' => 'fixed_assets',
                'code' => 'FA',
                'description' => 'Środki trwałe, nieruchomości i wartości niematerialne',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-current-liabilities',
                'name' => 'Zobowiązania krótkoterminowe',
                'type' => 'current_liabilities',
                'code' => 'CLIAB',
                'description' => 'Zobowiązania handlowe i krótkoterminowe kredyty bankowe',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-long-term-liabilities',
                'name' => 'Zobowiązania długoterminowe',
                'type' => 'long_term_liabilities',
                'code' => 'LTLIAB',
                'description' => 'Długoterminowe kredyty, obligacje i leasingi',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-equity',
                'name' => 'Kapitał własny',
                'type' => 'equity',
                'code' => 'EQ',
                'description' => 'Kapitał zakładowy i zyski zatrzymane',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('financial_categories')->insert($categories);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('financial_records');
        Schema::dropIfExists('financial_categories');
    }
};
