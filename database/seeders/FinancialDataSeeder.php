<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Contexts\Finance\Domain\ValueObjects\BenchmarkMetricType;
use App\Models\Company;
use App\Models\FinancialBenchmark;
use App\Models\FinancialCategory;
use App\Models\FinancialRecord;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class FinancialDataSeeder extends Seeder
{
    private const HELVEST_ID = '11111111-1111-1111-1111-111111111111';
    private const ACME_ID = '22222222-2222-2222-2222-222222222222';

    public function run(): void
    {
        // Ensure companies exist
        if (!Company::where('id', self::ACME_ID)->exists()) {
            Company::create([
                'id' => self::ACME_ID,
                'name' => 'Acme Manufacturing S.A.',
                'code' => 'ACME',
                'tax_id' => 'PL5252525252',
            ]);
        }

        if (!Company::where('id', self::HELVEST_ID)->exists()) {
            Company::create([
                'id' => self::HELVEST_ID,
                'name' => 'Helvest Advisory Sp. z o.o.',
                'code' => 'HELVEST',
                'tax_id' => 'PL1234567890',
            ]);
        }

        // Ensure granular OPEX categories exist
        $this->seedCategories();

        // Clean existing records to keep seeding idempotent
        FinancialRecord::whereIn('company_id', [self::ACME_ID, self::HELVEST_ID])->delete();

        $this->seedAcmeManufacturing();
        $this->seedHelvestAdvisory();
        $this->seedBenchmarks();
    }

    private function seedCategories(): void
    {
        $categories = [
            [
                'id' => FinancialCategory::OPEX_PAYROLL,
                'name' => 'Wynagrodzenia i świadczenia pracownicze',
                'type' => 'opex',
                'code' => 'PAYROLL',
                'description' => 'Koszty wynagrodzeń, ubezpieczeń społecznych i benefitów pracowniczych',
            ],
            [
                'id' => FinancialCategory::OPEX_SERVICES,
                'name' => 'Usługi obce i podwykonawcy B2B',
                'type' => 'opex',
                'code' => 'SRV',
                'description' => 'Usługi doradcze, konsultingowe, audytorskie i podwykonawstwo B2B',
            ],
            [
                'id' => FinancialCategory::OPEX_OFFICE,
                'name' => 'Czynsz i utrzymanie infrastruktury biurowej',
                'type' => 'opex',
                'code' => 'OFFICE',
                'description' => 'Wynajem powierzchni biurowych, media, eksploatacja i serwis',
            ],
            [
                'id' => FinancialCategory::OPEX_SOFTWARE,
                'name' => 'Narzędzia IT, licencje i chmura AWS/GCP',
                'type' => 'opex',
                'code' => 'CLOUD',
                'description' => 'Subskrypcje oprogramowania SaaS, hosting, infrastruktura chmurowa',
            ],
            [
                'id' => FinancialCategory::OPEX_MARKETING,
                'name' => 'Marketing, sprzedaż i pozyskiwanie klientów',
                'type' => 'opex',
                'code' => 'MKT',
                'description' => 'Kampanie reklamowe, lead generation, targi i promocja',
            ],
            [
                'id' => FinancialCategory::OPEX_LEGAL,
                'name' => 'Obsługa prawna, księgowa i audyt',
                'type' => 'opex',
                'code' => 'LEGAL',
                'description' => 'Kancelarie prawne, obsługa podatkowa, księgowa i audytorska',
            ],
        ];

        foreach ($categories as $cat) {
            FinancialCategory::updateOrCreate(
                ['id' => $cat['id']],
                [
                    'name' => $cat['name'],
                    'type' => $cat['type'],
                    'code' => $cat['code'],
                    'description' => $cat['description'],
                ]
            );
        }
    }

    private function seedAcmeManufacturing(): void
    {
        $records = [];
        $monthIndex = 0;

        for ($year = 2025; $year <= 2026; $year++) {
            $maxMonth = ($year === 2026) ? 9 : 12;
            for ($month = 1; $month <= $maxMonth; $month++) {
                $dateStr = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();

                // Trending baseline growth with seasonality
                $growthFactor = 1.0 + ($monthIndex * 0.015);
                $seasonality = 1.0 + (sin($monthIndex * (pi() / 6)) * 0.08);

                $revenue = round(520000 * $growthFactor * $seasonality, 4);
                $cogs = round($revenue * 0.54, 4);
                $opex = round(95000 * (1.0 + ($monthIndex * 0.008)), 4);
                $depreciation = 24000.0000;
                $financial = 8500.0000;
                $tax = round(($revenue - $cogs - $opex - $depreciation - $financial) * 0.19, 4);
                if ($tax < 0) {
                    $tax = 0.0;
                }

                // Balance sheet metrics for liquidity
                $cash = round(140000 + ($monthIndex * 3500) + (($monthIndex % 3) * 4000), 4);
                $receivables = round($revenue * 0.42, 4);
                $inventory = round($cogs * 0.52, 4);
                $currentLiab = round($cogs * 0.45 + ($opex * 0.25), 4);
                $fixedAssets = 1250000.0000;
                $longTermLiab = 420000.0000;

                // P&L entries
                $records[] = $this->makeRecord(self::ACME_ID, 'cat-revenue', 'revenue', (string) $revenue, $dateStr, 'Przychody ze sprzedaży produktów');
                $records[] = $this->makeRecord(self::ACME_ID, 'cat-cogs', 'expense', (string) $cogs, $dateStr, 'Koszt wytworzenia sprzedanych wyrobów (COGS)');

                // Granular OPEX breakdown across subcategories
                $opexPayroll = round($opex * 0.46, 4);
                $opexServices = round($opex * 0.18, 4);
                $opexOffice = round($opex * 0.14, 4);
                $opexSoftware = round($opex * 0.08, 4);
                $opexMarketing = round($opex * 0.09, 4);
                $opexLegal = round($opex - $opexPayroll - $opexServices - $opexOffice - $opexSoftware - $opexMarketing, 4);

                $records[] = $this->makeRecord(self::ACME_ID, FinancialCategory::OPEX_PAYROLL, 'expense', (string) $opexPayroll, $dateStr, 'Wynagrodzenia zasadnicze i świadczenia pracownicze');
                $records[] = $this->makeRecord(self::ACME_ID, FinancialCategory::OPEX_SERVICES, 'expense', (string) $opexServices, $dateStr, 'Usługi serwisowe, logistyczne i podwykonawcy B2B');
                $records[] = $this->makeRecord(self::ACME_ID, FinancialCategory::OPEX_OFFICE, 'expense', (string) $opexOffice, $dateStr, 'Czynsz hal biurowych, media i utrzymanie obiektów');
                $records[] = $this->makeRecord(self::ACME_ID, FinancialCategory::OPEX_SOFTWARE, 'expense', (string) $opexSoftware, $dateStr, 'Licencje CAD/ERP i infrastruktura chmurowa');
                $records[] = $this->makeRecord(self::ACME_ID, FinancialCategory::OPEX_MARKETING, 'expense', (string) $opexMarketing, $dateStr, 'Marketing przemysłowy, targi B2B i katalogi');
                $records[] = $this->makeRecord(self::ACME_ID, FinancialCategory::OPEX_LEGAL, 'expense', (string) $opexLegal, $dateStr, 'Obsługa prawna, audyt finansowy i doradztwo podatkowe');

                $records[] = $this->makeRecord(self::ACME_ID, 'cat-depreciation', 'expense', (string) $depreciation, $dateStr, 'Amortyzacja parku maszynowego i linii');
                $records[] = $this->makeRecord(self::ACME_ID, 'cat-financial', 'expense', (string) $financial, $dateStr, 'Odsetki od kredytów inwestycyjnych');
                $records[] = $this->makeRecord(self::ACME_ID, 'cat-tax', 'expense', (string) $tax, $dateStr, 'Podatek dochodowy od osób prawnych CIT');

                // Balance Sheet entries
                $records[] = $this->makeRecord(self::ACME_ID, 'cat-cash', 'asset', (string) $cash, $dateStr, 'Środki na rachunkach bankowych');
                $records[] = $this->makeRecord(self::ACME_ID, 'cat-receivables', 'asset', (string) $receivables, $dateStr, 'Należności z tytułu dostaw i usług');
                $records[] = $this->makeRecord(self::ACME_ID, 'cat-inventory', 'asset', (string) $inventory, $dateStr, 'Zapasy surowców i produktów gotowych');
                $records[] = $this->makeRecord(self::ACME_ID, 'cat-fixed-assets', 'asset', (string) $fixedAssets, $dateStr, 'Rzeczowe aktywa trwałe i budynki');
                $records[] = $this->makeRecord(self::ACME_ID, 'cat-current-liabilities', 'liability', (string) $currentLiab, $dateStr, 'Zobowiązania krótkoterminowe handlowe');
                $records[] = $this->makeRecord(self::ACME_ID, 'cat-long-term-liabilities', 'liability', (string) $longTermLiab, $dateStr, 'Kredyty bankowe długoterminowe');

                $monthIndex++;
            }
        }

        FinancialRecord::insert($records);
    }

    private function seedHelvestAdvisory(): void
    {
        $records = [];
        $monthIndex = 0;

        for ($year = 2025; $year <= 2026; $year++) {
            $maxMonth = ($year === 2026) ? 9 : 12;
            for ($month = 1; $month <= $maxMonth; $month++) {
                $dateStr = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();
                $growth = 1.0 + ($monthIndex * 0.02);

                $revenue = round(210000 * $growth, 4);
                $cogs = round(42000 * $growth, 4);
                $opex = round(72000 * (1.0 + ($monthIndex * 0.005)), 4);
                $depreciation = 3500.0000;
                $financial = 900.0000;
                $tax = round(($revenue - $cogs - $opex - $depreciation - $financial) * 0.19, 4);

                $cash = round(320000 + ($monthIndex * 6000), 4);
                $receivables = round($revenue * 0.35, 4);
                $currentLiab = round(48000 + ($monthIndex * 800), 4);

                $records[] = $this->makeRecord(self::HELVEST_ID, 'cat-revenue', 'revenue', (string) $revenue, $dateStr, 'Przychody z doradztwa M&A i transakcyjnego');
                $records[] = $this->makeRecord(self::HELVEST_ID, 'cat-cogs', 'expense', (string) $cogs, $dateStr, 'Wynagrodzenia zewnętrznych audytorów i rzeczoznawców');

                // Granular OPEX breakdown across subcategories
                $opexPayroll = round($opex * 0.52, 4);
                $opexOffice = round($opex * 0.18, 4);
                $opexSoftware = round($opex * 0.12, 4);
                $opexMarketing = round($opex * 0.08, 4);
                $opexServices = round($opex * 0.06, 4);
                $opexLegal = round($opex - $opexPayroll - $opexOffice - $opexSoftware - $opexMarketing - $opexServices, 4);

                $records[] = $this->makeRecord(self::HELVEST_ID, FinancialCategory::OPEX_PAYROLL, 'expense', (string) $opexPayroll, $dateStr, 'Wynagrodzenia zespołu doradczego i analityków');
                $records[] = $this->makeRecord(self::HELVEST_ID, FinancialCategory::OPEX_OFFICE, 'expense', (string) $opexOffice, $dateStr, 'Wynajem biura w Warszawie i recepcja');
                $records[] = $this->makeRecord(self::HELVEST_ID, FinancialCategory::OPEX_SOFTWARE, 'expense', (string) $opexSoftware, $dateStr, 'Terminale finansowe, bazy transakcyjne i chmura');
                $records[] = $this->makeRecord(self::HELVEST_ID, FinancialCategory::OPEX_MARKETING, 'expense', (string) $opexMarketing, $dateStr, 'Konferencje M&A, business development i PR');
                $records[] = $this->makeRecord(self::HELVEST_ID, FinancialCategory::OPEX_SERVICES, 'expense', (string) $opexServices, $dateStr, 'Zewnętrzne ekspertyzy techniczne i rzeczoznawcy');
                $records[] = $this->makeRecord(self::HELVEST_ID, FinancialCategory::OPEX_LEGAL, 'expense', (string) $opexLegal, $dateStr, 'Doradztwo regulacyjne, compliance i obsługa prawna');

                $records[] = $this->makeRecord(self::HELVEST_ID, 'cat-depreciation', 'expense', (string) $depreciation, $dateStr, 'Amortyzacja sprzętu biurowego i licencji');
                $records[] = $this->makeRecord(self::HELVEST_ID, 'cat-financial', 'expense', (string) $financial, $dateStr, 'Prowizje bankowe i opłaty transakcyjne');
                $records[] = $this->makeRecord(self::HELVEST_ID, 'cat-tax', 'expense', (string) $tax, $dateStr, 'Podatek dochodowy CIT');

                $records[] = $this->makeRecord(self::HELVEST_ID, 'cat-cash', 'asset', (string) $cash, $dateStr, 'Rachunek operacyjny i lokaty');
                $records[] = $this->makeRecord(self::HELVEST_ID, 'cat-receivables', 'asset', (string) $receivables, $dateStr, 'Należności za zrealizowane etapy projektów');
                $records[] = $this->makeRecord(self::HELVEST_ID, 'cat-current-liabilities', 'liability', (string) $currentLiab, $dateStr, 'Bieżące zobowiązania operacyjne');

                $monthIndex++;
            }
        }

        FinancialRecord::insert($records);
    }

    private function seedBenchmarks(): void
    {
        foreach ([self::ACME_ID, self::HELVEST_ID] as $companyId) {
            foreach (BenchmarkMetricType::cases() as $metricType) {
                FinancialBenchmark::firstOrCreate(
                    [
                        'company_id' => $companyId,
                        'metric_type' => $metricType->value,
                    ],
                    [
                        'id' => Str::uuid()->toString(),
                        'target_value' => $metricType->defaultTarget(),
                        'warning_threshold' => $metricType->defaultWarning(),
                        'critical_threshold' => $metricType->defaultCritical(),
                        'higher_is_better' => $metricType->higherIsBetter(),
                        'description' => "Standardowy benchmark branżowy: {$metricType->label()}",
                    ]
                );
            }
        }
    }

    private function makeRecord(
        string $companyId,
        string $categoryId,
        string $recordType,
        string $amount,
        string $recordDate,
        string $description
    ): array {
        return [
            'id' => Str::uuid()->toString(),
            'company_id' => $companyId,
            'category_id' => $categoryId,
            'record_type' => $recordType,
            'amount' => bcadd($amount, '0', 4),
            'currency' => 'PLN',
            'record_date' => $recordDate,
            'description' => $description,
            'source' => 'manual',
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }
}
