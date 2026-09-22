<?php

declare(strict_types=1);

namespace Tests\Unit\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Entities\FinancingStructure;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\Services\VatBridgeLoanService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatRate;
use DateTimeImmutable;
use InvalidArgumentException;
use Tests\TestCase;

final class VatBridgeLoanServiceTest extends TestCase
{
    private VatBridgeLoanService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new VatBridgeLoanService();
    }

    public function test_standard_capex_with_two_month_reimbursement_lag(): void
    {
        // 10,000,000 PLN net CAPEX over 4 months = 2,500,000 / month
        // 23% VAT = 575,000 / month
        // Total VAT = 2,300,000 PLN
        $startDate = new DateTimeImmutable('2026-06-01');
        $stage = new CapexStage(
            id: CapexStageId::generate(),
            name: 'Główny etap budowy',
            netAmount: Money::fromDecimal('10000000.0000', Currency::PLN),
            startDate: $startDate,
            durationMonths: 4
        );

        $schedule = $this->service->generateScheduleFromStages(
            stages: [$stage],
            vatRate: VatRate::standard(),
            reimbursementLagMonths: 2,
            annualInterestRate: 6.00, // 0.5% monthly
            facilityLimit: Money::fromDecimal('1500000.0000', Currency::PLN),
            startDate: $startDate
        );

        // Schedule duration = 4 months construction + 2 months lag = 6 months
        $this->assertEquals(6, $schedule->periodCount());
        $this->assertEquals('2300000.0000', $schedule->totalVatIncurred()->amount());
        $this->assertEquals('2300000.0000', $schedule->totalVatRefunded()->amount());
        $this->assertTrue($schedule->isFullySettled());

        // Month 1: Drawdown 575,000, Refund 0, Closing = 575,000
        $p1 = $schedule->period(1);
        $this->assertNotNull($p1);
        $this->assertEquals('0.0000', $p1->openingBalance()->amount());
        $this->assertEquals('575000.0000', $p1->drawdown()->amount());
        $this->assertEquals('0.0000', $p1->repayment()->amount());
        $this->assertEquals('575000.0000', $p1->closingBalance()->amount());

        // Month 2: Drawdown 575,000, Refund 0, Closing = 1,150,000
        $p2 = $schedule->period(2);
        $this->assertNotNull($p2);
        $this->assertEquals('575000.0000', $p2->openingBalance()->amount());
        $this->assertEquals('575000.0000', $p2->drawdown()->amount());
        $this->assertEquals('0.0000', $p2->repayment()->amount());
        $this->assertEquals('1150000.0000', $p2->closingBalance()->amount());

        // Month 3: Drawdown 575,000, Refund for month 1 arrives (575,000), Closing = 1,150,000
        $p3 = $schedule->period(3);
        $this->assertNotNull($p3);
        $this->assertEquals('1150000.0000', $p3->openingBalance()->amount());
        $this->assertEquals('575000.0000', $p3->drawdown()->amount());
        $this->assertEquals('575000.0000', $p3->repayment()->amount());
        $this->assertEquals('1150000.0000', $p3->closingBalance()->amount());

        // Month 5 (First post-construction month): Drawdown 0, Refund for month 3 arrives (575,000), Closing = 575,000
        $p5 = $schedule->period(5);
        $this->assertNotNull($p5);
        $this->assertEquals('1150000.0000', $p5->openingBalance()->amount());
        $this->assertEquals('0.0000', $p5->drawdown()->amount());
        $this->assertEquals('575000.0000', $p5->repayment()->amount());
        $this->assertEquals('575000.0000', $p5->closingBalance()->amount());

        // Month 6 (Final month): Drawdown 0, Refund for month 4 arrives (575,000), Closing = 0.0000
        $p6 = $schedule->period(6);
        $this->assertNotNull($p6);
        $this->assertEquals('575000.0000', $p6->openingBalance()->amount());
        $this->assertEquals('575000.0000', $p6->repayment()->amount());
        $this->assertEquals('0.0000', $p6->closingBalance()->amount());

        // Peak exposure = 1,150,000 (2 months of VAT)
        $this->assertEquals('1150000.0000', $schedule->peakExposure()->amount());
        $this->assertTrue($schedule->isWithinLimit());
    }

    public function test_peak_exposure_and_facility_limit_recommendation(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');
        $stage = new CapexStage(
            id: CapexStageId::generate(),
            name: 'Infrastruktura OZE',
            netAmount: Money::fromDecimal('6000000.0000', Currency::PLN),
            startDate: $startDate,
            durationMonths: 6 // 1,000,000 net/month -> 230,000 VAT/month
        );

        // With 3-month lag, peak exposure is 3 months * 230,000 = 690,000 PLN
        $recommendedLimit = $this->service->calculateRecommendedFacilityLimit(
            stages: [$stage],
            vatRate: VatRate::standard(),
            reimbursementLagMonths: 3
        );

        $this->assertEquals('690000.0000', $recommendedLimit->amount());

        // If bank provides limit of 500,000 PLN, schedule reports over-limit
        $schedule = $this->service->generateScheduleFromStages(
            stages: [$stage],
            vatRate: VatRate::standard(),
            reimbursementLagMonths: 3,
            annualInterestRate: 5.0,
            facilityLimit: Money::fromDecimal('500000.0000', Currency::PLN)
        );

        $this->assertFalse($schedule->isWithinLimit());
        $this->assertEquals('690000.0000', $schedule->peakExposure()->amount());
    }

    public function test_multiple_overlapping_capex_stages(): void
    {
        $startDate = new DateTimeImmutable('2026-03-01');

        // Stage 1: months 1..3 (March..May) -> 300,000 net/month -> 69,000 VAT/month
        $stage1 = new CapexStage(
            id: CapexStageId::generate(),
            name: 'Przygotowanie terenu',
            netAmount: Money::fromDecimal('900000.0000', Currency::PLN),
            startDate: $startDate,
            durationMonths: 3,
            stageOrder: 1
        );

        // Stage 2: starts in month 2 (April) for 4 months (April..July) -> 500,000 net/month -> 115,000 VAT/month
        $stage2 = new CapexStage(
            id: CapexStageId::generate(),
            name: 'Dostawa i montaż',
            netAmount: Money::fromDecimal('2000000.0000', Currency::PLN),
            startDate: $startDate->modify('+1 month'),
            durationMonths: 4,
            stageOrder: 2
        );

        $schedule = $this->service->generateScheduleFromStages(
            stages: [$stage1, $stage2],
            vatRate: VatRate::standard(),
            reimbursementLagMonths: 2,
            startDate: $startDate
        );

        // Total net CAPEX = 2,900,000 -> 23% VAT = 667,000 PLN
        $this->assertEquals('667000.0000', $schedule->totalVatIncurred()->amount());
        $this->assertEquals('667000.0000', $schedule->totalVatRefunded()->amount());
        $this->assertTrue($schedule->isFullySettled());

        // Max capex month is month 5 (July), with 2-month lag -> 7 months total
        $this->assertEquals(7, $schedule->periodCount());
    }

    public function test_generate_schedule_from_investment_project_aggregate(): void
    {
        $startDate = new DateTimeImmutable('2026-05-01');
        $financing = new FinancingStructure(
            id: 'fin-1',
            investor1Equity: Money::fromDecimal('2000000.0000', Currency::PLN),
            vatBridgeLoanAmount: Money::fromDecimal('1000000.0000', Currency::PLN)
        );

        $debt = new DebtFacility(
            DebtFacilityId::generate(),
            'Kredyt',
            Money::fromDecimal('4000000.0000', Currency::PLN),
            InterestMargin::fromPercentage(2.0),
            5.5,
            LoanTenor::fromMonths(60, 0)
        );

        $project = InvestmentProject::create(
            id: InvestmentProjectId::generate(),
            companyId: 'comp-1',
            name: 'Projekt Solarny',
            description: 'Opis',
            startDate: $startDate,
            financingStructure: $financing,
            debtFacility: $debt
        );

        $stage = new CapexStage(
            id: CapexStageId::generate(),
            name: 'Panele i inwertery',
            netAmount: Money::fromDecimal('4000000.0000', Currency::PLN),
            startDate: $startDate,
            durationMonths: 2
        );

        $project->addCapexStage($stage);

        $schedule = $this->service->generateSchedule($project, 2, 7.0);

        $this->assertEquals(4, $schedule->periodCount()); // 2 months CAPEX + 2 months lag
        $this->assertEquals('920000.0000', $schedule->totalVatIncurred()->amount()); // 23% of 4M
        $this->assertEquals('920000.0000', $schedule->totalVatRefunded()->amount());
        $this->assertTrue($schedule->isFullySettled());
        $this->assertTrue($schedule->isWithinLimit());
        $this->assertNotEmpty($schedule->annualSummaries());
    }

    public function test_invalid_parameters_throw_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->service->generateScheduleFromStages(
            stages: [],
            vatRate: VatRate::standard(),
            reimbursementLagMonths: 0 // invalid: must be >= 1
        );
    }
}
