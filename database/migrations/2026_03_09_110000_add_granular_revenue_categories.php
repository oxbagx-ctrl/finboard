<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Introduces granular revenue subcategories for software, B2B services, and cloud/technology consulting:
     * - cat-revenue-services (REV-SRV)
     * - cat-revenue-saas (REV-SAAS)
     * - cat-revenue-consulting (REV-CON)
     */
    public function up(): void
    {
        $now = now();
        $categories = [
            [
                'id' => 'cat-revenue-services',
                'name' => 'Usługi programistyczne i inżynieryjne B2B',
                'type' => 'revenue',
                'code' => 'REV-SRV',
                'description' => 'Przychody ze świadczenia dedykowanych usług programistycznych, wdrożeniowych i inżynieryjnych',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-revenue-saas',
                'name' => 'Subskrypcje i licencje SaaS',
                'type' => 'revenue',
                'code' => 'REV-SAAS',
                'description' => 'Przychody powtarzalne (ARR/MRR) z licencji oprogramowania i platform SaaS',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-revenue-consulting',
                'name' => 'Doradztwo technologiczne i audyty chmurowe',
                'type' => 'revenue',
                'code' => 'REV-CON',
                'description' => 'Przychody z profesjonalnego doradztwa IT, audytów architektury i optymalizacji chmurowych',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        foreach ($categories as $cat) {
            DB::table('financial_categories')->updateOrInsert(
                ['id' => $cat['id']],
                $cat
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('financial_categories')->whereIn('id', [
            'cat-revenue-services',
            'cat-revenue-saas',
            'cat-revenue-consulting',
        ])->delete();
    }
};
