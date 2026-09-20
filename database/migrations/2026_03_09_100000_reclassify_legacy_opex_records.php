<?php

declare(strict_types=1);

use App\Models\FinancialCategory;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Reclassifies legacy generic 'cat-opex' financial records into granular OPEX subcategories:
     * - cat-opex-payroll (PAYROLL)
     * - cat-opex-services (SRV)
     * - cat-opex-office (OFFICE)
     * - cat-opex-software (CLOUD)
     * - cat-opex-marketing (MKT)
     * - cat-opex-legal (LEGAL)
     *
     * Classification rule:
     * 1. Inspect record description with case-insensitive keyword heuristics.
     * 2. If no keyword matches, fallback to cat-opex-services (standard operating services & B2B).
     */
    public function up(): void
    {
        // 1. Keyword-based classification mappings
        $keywordPatterns = [
            FinancialCategory::OPEX_PAYROLL => [
                '%wynagrodzen%',
                '%płac%',
                '%zus%',
                '%etat%',
                '%premia%',
                '%świadczen%',
                '%pracowni%',
                '%b2b kontrakt%',
                '%kadry%',
                '%payroll%',
                '%salary%',
            ],
            FinancialCategory::OPEX_SOFTWARE => [
                '%oprogramowan%',
                '%licencj%',
                '%saas%',
                '%chmur%',
                '%cloud%',
                '%hosting%',
                '%aws%',
                '%gcp%',
                '%azure%',
                '%erp%',
                '%crm%',
                '%cad%',
                '%it %',
                '%subskrypcj%',
            ],
            FinancialCategory::OPEX_OFFICE => [
                '%czynsz%',
                '%wynajem biur%',
                '%powierzchni biurow%',
                '%media %',
                '%prąd%',
                '%energia%',
                '%eksploatacj%',
                '%utrzymani%obiekt%',
                '%serwis biur%',
                '%woda%',
                '%gaz%',
                '%leasing hal%',
            ],
            FinancialCategory::OPEX_MARKETING => [
                '%marketing%',
                '%reklam%',
                '%promocj%',
                '%targi%',
                '%google ads%',
                '%meta ads%',
                '%kampani%',
                '%lead generation%',
                '%branding%',
                '%pr %',
                '%public relations%',
            ],
            FinancialCategory::OPEX_LEGAL => [
                '%prawn%',
                '%kancelari%',
                '%notari%',
                '%audyt%',
                '%doradztwo podatkow%',
                '%księgow%',
                '%compliance%',
                '%legal%',
                '%adwokat%',
                '%radca%',
            ],
            FinancialCategory::OPEX_SERVICES => [
                '%usługi obc%',
                '%doradztwo%',
                '%konsulting%',
                '%podwykonaw%',
                '%serwis%',
                '%logistyk%',
                '%transport%',
                '%spedycj%',
                '%ochrona%',
                '%sprzątani%',
            ],
        ];

        // Execute keyword reclassification for each granular category
        foreach ($keywordPatterns as $targetCategoryId => $patterns) {
            foreach ($patterns as $pattern) {
                DB::table('financial_records')
                    ->where('category_id', FinancialCategory::OPEX_GENERIC)
                    ->whereRaw('LOWER(description) LIKE ?', [strtolower($pattern)])
                    ->update([
                        'category_id' => $targetCategoryId,
                        'updated_at' => now(),
                    ]);
            }
        }

        // 2. Default fallback for any remaining records with cat-opex: reclassify to cat-opex-services
        DB::table('financial_records')
            ->where('category_id', FinancialCategory::OPEX_GENERIC)
            ->update([
                'category_id' => FinancialCategory::OPEX_SERVICES,
                'updated_at' => now(),
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert granular OPEX categories back to cat-opex if needed
        DB::table('financial_records')
            ->whereIn('category_id', [
                FinancialCategory::OPEX_PAYROLL,
                FinancialCategory::OPEX_SERVICES,
                FinancialCategory::OPEX_OFFICE,
                FinancialCategory::OPEX_SOFTWARE,
                FinancialCategory::OPEX_MARKETING,
                FinancialCategory::OPEX_LEGAL,
            ])
            ->update([
                'category_id' => FinancialCategory::OPEX_GENERIC,
                'updated_at' => now(),
            ]);
    }
};
