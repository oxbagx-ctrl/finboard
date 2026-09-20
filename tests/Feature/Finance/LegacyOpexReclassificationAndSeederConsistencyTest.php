<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Models\Company;
use App\Models\FinancialCategory;
use App\Models\FinancialRecord;
use Database\Seeders\FinancialDataSeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class LegacyOpexReclassificationAndSeederConsistencyTest extends TestCase
{
    use DatabaseTransactions;

    private const TEST_COMPANY_ID = '33333333-3333-3333-3333-333333333333';

    protected function setUp(): void
    {
        parent::setUp();

        if (!Company::where('id', self::TEST_COMPANY_ID)->exists()) {
            Company::create([
                'id' => self::TEST_COMPANY_ID,
                'name' => 'Test Tech Sp. z o.o.',
                'code' => 'TESTTECH',
                'tax_id' => 'PL9999999999',
            ]);
        }
    }

    public function test_migration_reclassifies_legacy_cat_opex_records_without_orphans(): void
    {
        // 1. Arrange: insert legacy cat-opex records with various descriptions
        $now = now();
        $records = [
            [
                'id' => '00000000-0000-0000-0000-000000000001',
                'company_id' => self::TEST_COMPANY_ID,
                'category_id' => FinancialCategory::OPEX_GENERIC,
                'record_type' => 'expense',
                'amount' => 45000.0000,
                'currency' => 'PLN',
                'record_date' => '2024-05-15',
                'description' => 'Wynagrodzenia zespołu inżynierów i programistów B2B za kwiecień',
                'source' => 'manual',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => '00000000-0000-0000-0000-000000000002',
                'company_id' => self::TEST_COMPANY_ID,
                'category_id' => FinancialCategory::OPEX_GENERIC,
                'record_type' => 'expense',
                'amount' => 12500.0000,
                'currency' => 'PLN',
                'record_date' => '2024-05-18',
                'description' => 'Czynsz za wynajem biura w Warszawie oraz opłaty eksploatacyjne',
                'source' => 'manual',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => '00000000-0000-0000-0000-000000000003',
                'company_id' => self::TEST_COMPANY_ID,
                'category_id' => FinancialCategory::OPEX_GENERIC,
                'record_type' => 'expense',
                'amount' => 8400.0000,
                'currency' => 'PLN',
                'record_date' => '2024-05-20',
                'description' => 'Subskrypcje oprogramowania SaaS: AWS Cloud hosting i licencje GitHub',
                'source' => 'manual',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => '00000000-0000-0000-0000-000000000004',
                'company_id' => self::TEST_COMPANY_ID,
                'category_id' => FinancialCategory::OPEX_GENERIC,
                'record_type' => 'expense',
                'amount' => 6200.0000,
                'currency' => 'PLN',
                'record_date' => '2024-05-22',
                'description' => 'Kampania marketingowa Google Ads i promocja targowa',
                'source' => 'manual',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => '00000000-0000-0000-0000-000000000005',
                'company_id' => self::TEST_COMPANY_ID,
                'category_id' => FinancialCategory::OPEX_GENERIC,
                'record_type' => 'expense',
                'amount' => 5100.0000,
                'currency' => 'PLN',
                'record_date' => '2024-05-25',
                'description' => 'Obsługa prawna kancelarii, doradztwo podatkowe i audyt',
                'source' => 'manual',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => '00000000-0000-0000-0000-000000000006',
                'company_id' => self::TEST_COMPANY_ID,
                'category_id' => FinancialCategory::OPEX_GENERIC,
                'record_type' => 'expense',
                'amount' => 3300.0000,
                'currency' => 'PLN',
                'record_date' => '2024-05-28',
                'description' => 'Inne koszty operacyjne bez słów kluczowych',
                'source' => 'manual',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('financial_records')->insert($records);

        // Verify initial setup has 6 generic cat-opex records
        $this->assertSame(6, DB::table('financial_records')->where('company_id', self::TEST_COMPANY_ID)->where('category_id', FinancialCategory::OPEX_GENERIC)->count());

        // 2. Act: run the reclassification migration logic
        $migration = require database_path('migrations/2026_03_09_100000_reclassify_legacy_opex_records.php');
        $migration->up();

        // 3. Assert: zero orphan cat-opex records remaining for this company
        $remainingGenericOpex = DB::table('financial_records')
            ->where('company_id', self::TEST_COMPANY_ID)
            ->where('category_id', FinancialCategory::OPEX_GENERIC)
            ->count();
        $this->assertSame(0, $remainingGenericOpex, 'Expected 0 records with cat-opex remaining in financial_records table.');

        // Assert correct granular classifications
        $recordPayroll = DB::table('financial_records')->where('id', '00000000-0000-0000-0000-000000000001')->first();
        $this->assertSame(FinancialCategory::OPEX_PAYROLL, $recordPayroll->category_id);

        $recordOffice = DB::table('financial_records')->where('id', '00000000-0000-0000-0000-000000000002')->first();
        $this->assertSame(FinancialCategory::OPEX_OFFICE, $recordOffice->category_id);

        $recordSoftware = DB::table('financial_records')->where('id', '00000000-0000-0000-0000-000000000003')->first();
        $this->assertSame(FinancialCategory::OPEX_SOFTWARE, $recordSoftware->category_id);

        $recordMarketing = DB::table('financial_records')->where('id', '00000000-0000-0000-0000-000000000004')->first();
        $this->assertSame(FinancialCategory::OPEX_MARKETING, $recordMarketing->category_id);

        $recordLegal = DB::table('financial_records')->where('id', '00000000-0000-0000-0000-000000000005')->first();
        $this->assertSame(FinancialCategory::OPEX_LEGAL, $recordLegal->category_id);

        // Fallback should map to cat-opex-services
        $recordFallback = DB::table('financial_records')->where('id', '00000000-0000-0000-0000-000000000006')->first();
        $this->assertSame(FinancialCategory::OPEX_SERVICES, $recordFallback->category_id);
    }

    public function test_financial_data_seeder_produces_zero_cat_opex_records_and_proper_revenue_distribution(): void
    {
        $seeder = new FinancialDataSeeder();
        $seeder->run();

        // 1. Verify zero generic cat-opex records across seeded companies
        $orphanOpexCount = DB::table('financial_records')
            ->where('category_id', FinancialCategory::OPEX_GENERIC)
            ->count();
        $this->assertSame(0, $orphanOpexCount, 'FinancialDataSeeder should not seed any legacy cat-opex records.');

        // 2. Verify all seeded OPEX records belong to granular OPEX categories
        $granularOpexCategories = [
            FinancialCategory::OPEX_PAYROLL,
            FinancialCategory::OPEX_SERVICES,
            FinancialCategory::OPEX_OFFICE,
            FinancialCategory::OPEX_SOFTWARE,
            FinancialCategory::OPEX_MARKETING,
            FinancialCategory::OPEX_LEGAL,
        ];

        $opexRecords = DB::table('financial_records')
            ->whereIn('category_id', array_merge($granularOpexCategories, [FinancialCategory::OPEX_GENERIC]))
            ->get();

        $this->assertNotEmpty($opexRecords);
        foreach ($opexRecords as $record) {
            $this->assertContains(
                $record->category_id,
                $granularOpexCategories,
                "Seeded OPEX record {$record->id} must have a granular category ID."
            );
        }

        // 3. Verify granular revenue categories exist and are seeded
        $granularRevenueCategories = [
            FinancialCategory::REVENUE_SERVICES,
            FinancialCategory::REVENUE_SAAS,
            FinancialCategory::REVENUE_CONSULTING,
        ];

        $revenueRecords = DB::table('financial_records')
            ->whereIn('category_id', $granularRevenueCategories)
            ->get();

        $this->assertNotEmpty($revenueRecords, 'Expected granular revenue records to be seeded.');

        $seededRevenueCategories = $revenueRecords->pluck('category_id')->unique()->values()->all();
        $this->assertCount(3, $seededRevenueCategories, 'Expected all 3 granular revenue streams to be present.');
    }
}
