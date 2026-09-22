<?php

declare(strict_types=1);

namespace Tests\Unit\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Entities\FinancingStructure;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\Services\DepreciationScheduleService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DepreciationSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class DepreciationScheduleServiceTest extends TestCase
{
    private DepreciationScheduleService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new DepreciationScheduleService();
    }

    public function test_single_stage_linear_depreciation_and_capitalization(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        // 1,200,000 PLN, 6 months (Jan-Jun 2026), 200,000/month, KST_4 (10%/year -> 10,000/month)
        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Park Maszynowy CNC',
            Money::fromDecimal('1200000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_4')
        );

        $schedule = $this->service->generateFromStages([$stage], $startDate, horizonYears: 15);

        $this->assertInstanceOf(DepreciationSchedule::class, $schedule);
        $this->assertEquals(180, $schedule->monthlyPeriodCount()); // 15 years * 12 months
        $this->assertEquals(15, count($schedule->annualSummaries()));

        // Months 1-5: CIP accumulates, 0 depreciation, 0 gross book value in use
        for ($m = 1; $m <= 5; $m++) {
            $period = $schedule->monthlyPeriod($m);
            $this->assertNotNull($period);
            $this->assertEquals('200000.0000', $period->capexIncurred()->amount());
            $this->assertEquals('0.0000', $period->capitalizedAmount()->amount());
            $this->assertEquals('0.0000', $period->grossBookValueClosing()->amount());
            $this->assertEquals('0.0000', $period->depreciationCharge()->amount());
            $this->assertEquals((string) ($m * 200000) . '.0000', $period->constructionInProgressClosing()->amount());
        }

        // Month 6: Final CAPEX + Capitalization (OT)
        $p6 = $schedule->monthlyPeriod(6);
        $this->assertNotNull($p6);
        $this->assertEquals('200000.0000', $p6->capexIncurred()->amount());
        $this->assertEquals('1200000.0000', $p6->capitalizedAmount()->amount());
        $this->assertEquals('0.0000', $p6->constructionInProgressClosing()->amount());
        $this->assertEquals('1200000.0000', $p6->grossBookValueClosing()->amount());
        $this->assertEquals('0.0000', $p6->depreciationCharge()->amount()); // Next month rule

        // Month 7: First month of depreciation (10,000 PLN)
        $p7 = $schedule->monthlyPeriod(7);
        $this->assertNotNull($p7);
        $this->assertEquals('0.0000', $p7->capexIncurred()->amount());
        $this->assertEquals('10000.0000', $p7->depreciationCharge()->amount());
        $this->assertEquals('10000.0000', $p7->accumulatedDepreciationClosing()->amount());
        $this->assertEquals('1190000.0000', $p7->netBookValueClosing()->amount());

        // Month 12: End of Year 1
        $p12 = $schedule->monthlyPeriod(12);
        $this->assertNotNull($p12);
        // 6 months of depreciation (months 7, 8, 9, 10, 11, 12) = 60,000 PLN
        $this->assertEquals('60000.0000', $p12->accumulatedDepreciationClosing()->amount());
        $this->assertEquals('1140000.0000', $p12->netBookValueClosing()->amount());

        // Year 1 Annual Summary
        $y1 = $schedule->annualSummary(1);
        $this->assertNotNull($y1);
        $this->assertEquals('0.0000', $y1->openingNetBookValue()->amount());
        $this->assertEquals('1200000.0000', $y1->capexIncurred()->amount());
        $this->assertEquals('1200000.0000', $y1->capitalizedAmount()->amount());
        $this->assertEquals('60000.0000', $y1->depreciationExpense()->amount());
        $this->assertEquals('1200000.0000', $y1->grossBookValueClosing()->amount());
        $this->assertEquals('60000.0000', $y1->accumulatedDepreciationClosing()->amount());
        $this->assertEquals('1140000.0000', $y1->closingNetBookValue()->amount());
        $this->assertEquals('0.0000', $y1->closingConstructionInProgress()->amount());
        $this->assertEquals('1140000.0000', $y1->totalFixedAssetsClosing()->amount());

        // Year 2 Annual Summary (Full 12 months of depreciation = 120,000 PLN)
        $y2 = $schedule->annualSummary(2);
        $this->assertNotNull($y2);
        $this->assertEquals('1140000.0000', $y2->openingNetBookValue()->amount());
        $this->assertEquals('0.0000', $y2->capexIncurred()->amount());
        $this->assertEquals('120000.0000', $y2->depreciationExpense()->amount());
        $this->assertEquals('180000.0000', $y2->accumulatedDepreciationClosing()->amount());
        $this->assertEquals('1020000.0000', $y2->closingNetBookValue()->amount());
    }

    public function test_asset_stops_depreciating_at_zero_net_book_value(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        // Transport vehicles KST_7: 20% annual rate (5 years of depreciation)
        // 100,000 PLN completed in 1 month (January 2026)
        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Flota pojazdów dostawczych',
            Money::fromDecimal('100000.0000', Currency::PLN),
            $startDate,
            1,
            KstClassification::fromCode('KST_7')
        );

        $schedule = $this->service->generateFromStages([$stage], $startDate, horizonYears: 10);

        // Total depreciated over 10-year horizon must equal exactly 100,000 PLN (cannot exceed gross value)
        $this->assertEquals('100000.0000', $schedule->totalDepreciationOverHorizon()->amount());

        // In year 6, asset is already fully depreciated (or remaining few months of 60 months)
        // Month 1 was cap, months 2..61 (60 months) depreciated 1,666.6667/mo
        $p62 = $schedule->monthlyPeriod(62);
        $this->assertNotNull($p62);
        $this->assertEquals('0.0000', $p62->depreciationCharge()->amount());
        $this->assertEquals('0.0000', $p62->netBookValueClosing()->amount());

        // Year 7 depreciation expense must be 0
        $y7 = $schedule->annualSummary(7);
        $this->assertNotNull($y7);
        $this->assertEquals('0.0000', $y7->depreciationExpense()->amount());
        $this->assertEquals('0.0000', $y7->closingNetBookValue()->amount());
    }

    public function test_non_depreciable_asset_remains_at_full_book_value(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        // Land purchase KST_0: 0% depreciation
        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Działka inwestycyjna',
            Money::fromDecimal('500000.0000', Currency::PLN),
            $startDate,
            1,
            KstClassification::fromCode('KST_0')
        );

        $schedule = $this->service->generateFromStages([$stage], $startDate, horizonYears: 15);

        $this->assertEquals('0.0000', $schedule->totalDepreciationOverHorizon()->amount());

        for ($year = 1; $year <= 15; $year++) {
            $this->assertEquals('0.0000', $schedule->annualDepreciation($year)->amount());
            $this->assertEquals('500000.0000', $schedule->closingNetBookValue($year)->amount());
        }
    }

    public function test_multi_stage_staggered_construction_in_progress(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        // Stage 1: 300,000 PLN, months 1-3
        $stage1 = CapexStage::create(
            CapexStageId::generate(),
            'Etap 1 - Roboty ziemne',
            Money::fromDecimal('300000.0000', Currency::PLN),
            $startDate,
            3,
            KstClassification::fromCode('KST_2') // 4.5%
        );

        // Stage 2: 600,000 PLN, starts month 4 (2026-04-01), duration 6 months (months 4-9)
        $stage2 = CapexStage::create(
            CapexStageId::generate(),
            'Etap 2 - Budynek biurowo-magazynowy',
            Money::fromDecimal('600000.0000', Currency::PLN),
            $startDate->modify('+3 months'),
            6,
            KstClassification::fromCode('KST_1') // 2.5%
        );

        $schedule = $this->service->generateFromStages([$stage1, $stage2], $startDate, horizonYears: 15);

        // Month 3: Stage 1 capitalizes (300k), CIP drops to 0
        $p3 = $schedule->monthlyPeriod(3);
        $this->assertEquals('0.0000', $p3->constructionInProgressClosing()->amount());
        $this->assertEquals('300000.0000', $p3->grossBookValueClosing()->amount());

        // Month 4: Stage 2 starts spending (100k), Stage 1 starts depreciating
        $p4 = $schedule->monthlyPeriod(4);
        $this->assertEquals('100000.0000', $p4->constructionInProgressClosing()->amount());
        $this->assertTrue($p4->depreciationCharge()->isPositive());

        // Month 9: Stage 2 capitalizes (600k)
        $p9 = $schedule->monthlyPeriod(9);
        $this->assertEquals('0.0000', $p9->constructionInProgressClosing()->amount());
        $this->assertEquals('900000.0000', $p9->grossBookValueClosing()->amount());

        // Year 1 total capital expenditures
        $y1 = $schedule->annualSummary(1);
        $this->assertEquals('900000.0000', $y1->capexIncurred()->amount());
        $this->assertEquals('900000.0000', $y1->capitalizedAmount()->amount());
    }

    public function test_breakdown_by_kst_and_by_stage_summaries(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage1 = CapexStage::create(
            CapexStageId::generate(),
            'Hala',
            Money::fromDecimal('500000.0000', Currency::PLN),
            $startDate,
            2,
            KstClassification::fromCode('KST_1')
        );

        $stage2 = CapexStage::create(
            CapexStageId::generate(),
            'Serwery',
            Money::fromDecimal('100000.0000', Currency::PLN),
            $startDate,
            1,
            KstClassification::fromCode('KST_IT')
        );

        $schedule = $this->service->generateFromStages([$stage1, $stage2], $startDate, horizonYears: 5);

        $byKst = $schedule->byKstSummaries();
        $this->assertArrayHasKey('KST_1', $byKst);
        $this->assertArrayHasKey('KST_IT', $byKst);

        // IT equipment has 30% annual rate -> Year 2 has 30,000 PLN depreciation
        $itYear2 = $byKst['KST_IT'][2];
        $this->assertEquals('30000.0000', $itYear2->depreciationExpense()->amount());

        // Building has 2.5% rate on 500k -> 12,500 PLN/year
        $bldYear2 = $byKst['KST_1'][2];
        $this->assertEquals('12500.0000', $bldYear2->depreciationExpense()->amount());
    }

    public function test_generate_schedule_from_investment_project_aggregate(): void
    {
        $startDate = new DateTimeImmutable('2026-02-01');

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'comp-1111-1111',
            'Fabryka Mebli',
            'Opis',
            $startDate,
            FinancingStructure::create(Money::fromDecimal('1000000.0000', Currency::PLN)),
            DebtFacility::create(
                DebtFacilityId::generate(),
                'Kredyt',
                Money::fromDecimal('500000.0000', Currency::PLN),
                InterestMargin::fromPercentage(2.0),
                5.0,
                LoanTenor::fromMonths(60)
            )
        );

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Budynek stolarni',
            Money::fromDecimal('800000.0000', Currency::PLN),
            $startDate,
            4,
            KstClassification::fromCode('KST_1')
        );

        $project->addCapexStage($stage);

        $schedule = $this->service->generateSchedule($project, horizonYears: 15);

        $this->assertEquals(180, $schedule->monthlyPeriodCount());
        $this->assertEquals('800000.0000', $schedule->totalCapexIncurred()->amount());

        $array = $schedule->toArray();
        $this->assertIsArray($array);
        $this->assertEquals('PLN', $array['currency']);
        $this->assertEquals(15, $array['horizon_years']);
        $this->assertCount(15, $array['annual_summaries']);
    }

    public function test_invalid_horizon_years_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->service->generateFromStages([], new DateTimeImmutable(), horizonYears: 0);
    }
}
