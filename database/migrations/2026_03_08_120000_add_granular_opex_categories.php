<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $now = now();
        $categories = [
            [
                'id' => 'cat-opex-payroll',
                'name' => 'Wynagrodzenia i świadczenia pracownicze',
                'type' => 'opex',
                'code' => 'PAYROLL',
                'description' => 'Koszty wynagrodzeń, ubezpieczeń społecznych i benefitów pracowniczych',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-opex-services',
                'name' => 'Usługi obce i podwykonawcy B2B',
                'type' => 'opex',
                'code' => 'SRV',
                'description' => 'Usługi doradcze, konsultingowe, audytorskie i podwykonawstwo B2B',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-opex-office',
                'name' => 'Czynsz i utrzymanie infrastruktury biurowej',
                'type' => 'opex',
                'code' => 'OFFICE',
                'description' => 'Wynajem powierzchni biurowych, media, eksploatacja i serwis',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-opex-software',
                'name' => 'Narzędzia IT, licencje i chmura AWS/GCP',
                'type' => 'opex',
                'code' => 'CLOUD',
                'description' => 'Subskrypcje oprogramowania SaaS, hosting, infrastruktura chmurowa',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-opex-marketing',
                'name' => 'Marketing, sprzedaż i pozyskiwanie klientów',
                'type' => 'opex',
                'code' => 'MKT',
                'description' => 'Kampanie reklamowe, lead generation, targi i promocja',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'cat-opex-legal',
                'name' => 'Obsługa prawna, księgowa i audyt',
                'type' => 'opex',
                'code' => 'LEGAL',
                'description' => 'Kancelarie prawne, obsługa podatkowa, księgowa i audytorska',
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
            'cat-opex-payroll',
            'cat-opex-services',
            'cat-opex-office',
            'cat-opex-software',
            'cat-opex-marketing',
            'cat-opex-legal',
        ])->delete();
    }
};
