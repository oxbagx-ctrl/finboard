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
        Schema::table('investment_capex_stages', function (Blueprint $table) {
            $table->decimal('grant_eligible_amount', 15, 4)->nullable()->after('eligible_for_grant');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('investment_capex_stages', function (Blueprint $table) {
            $table->dropColumn('grant_eligible_amount');
        });
    }
};
