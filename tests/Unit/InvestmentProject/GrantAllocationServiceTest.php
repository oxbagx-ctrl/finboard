<?php

declare(strict_types=1);

namespace Tests\Unit\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Entities\FinancingStructure;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\Services\GrantAllocationService;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\GrantCalculationResult;
use App\Contexts\InvestmentProject\Domain\ValueObjects\GrantTrancheType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class GrantAllocationServiceTest extends TestCase
{
    private GrantAllocationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new GrantAllocationService();
    }

    public function test_calculate_eligible_costs_and_total_capex(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage1 = CapexStage::create(
            CapexStageId::generate(),
            'Hala produkcyjna',
            Money::fromDecimal('500000.0000', Currency::PLN),
            $startDate,
            6,
            KstClassification::fromCode('KST_1'),
            true, // eligible
            Money::fromDecimal('500000.0000', Currency::PLN)
        );

        $stage2 = CapexStage::create(
            CapexStageId::generate(),
            'Maszyny CNC (częściowo kwalifikowane)',
            Money::fromDecimal('300000.0000', Currency::PLN),
            $startDate,
            4,
            KstClassification::fromCode('KST_4'),
            true, // eligible with limit
            Money::fromDecimal('200000.0000', Currency::PLN)
        );

        $stage3 = CapexStage::create(
            CapexStageId::generate(),
            'Zakup gruntu (niekwalifikowany)',
            Money::fromDecimal('200000.0000', Currency::PLN),
            $startDate,
            1,
            KstClassification::fromCode('KST_0'),
            false // not eligible
        );

        $stages = [$stage1, $stage2, $stage3];

        $totalCapex = $this->service->calculateTotalCapex($stages);
        $eligibleCosts = $this->service->calculateEligibleCosts($stages);

        $this->assertEquals('1000000.0000', $totalCapex->amount());
        $this->assertEquals('700000.0000', $eligibleCosts->amount());
    }

    public function test_calculate_max_grant_with_and_without_cap(): void
    {
        $eligible = Money::fromDecimal('1000000.0000', Currency::PLN);

        // 60% of 1,000,000 PLN = 600,000 PLN
        $grant = $this->service->calculateMaxGrant($eligible, 60.0);
        $this->assertEquals('600000.0000', $grant->amount());

        // With cap of 500,000 PLN
        $cap = Money::fromDecimal('500000.0000', Currency::PLN);
        $cappedGrant = $this->service->calculateMaxGrant($eligible, 60.0, $cap);
        $this->assertEquals('500000.0000', $cappedGrant->amount());

        // Zero intensity or zero eligible costs
        $zeroGrant = $this->service->calculateMaxGrant($eligible, 0.0);
        $this->assertTrue($zeroGrant->isZero());

        $zeroEligibleGrant = $this->service->calculateMaxGrant(Money::zero(Currency::PLN), 50.0);
        $this->assertTrue($zeroEligibleGrant->isZero());
    }

    public function test_complete_grant_calculation_with_advance_interim_and_final_tranches(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage1 = CapexStage::create(
            CapexStageId::generate(),
            'Fundamenty i konstrukcja',
            Money::fromDecimal('400000.0000', Currency::PLN),
            $startDate,
            3, // finishes month 3
            null,
            true,
            Money::fromDecimal('400000.0000', Currency::PLN),
            1
        );

        $stage2 = CapexStage::create(
            CapexStageId::generate(),
            'Montaż linii technologicznej',
            Money::fromDecimal('600000.0000', Currency::PLN),
            $startDate,
            6, // finishes month 6
            null,
            true,
            Money::fromDecimal('600000.0000', Currency::PLN),
            2
        );

        $stage3 = CapexStage::create(
            CapexStageId::generate(),
            'Koszty doradztwa (niekwalifikowane)',
            Money::fromDecimal('100000.0000', Currency::PLN),
            $startDate,
            2,
            null,
            false // not eligible
        );

        $stages = [$stage1, $stage2, $stage3];

        $result = $this->service->calculate(
            grantProgramName: 'FENG Ścieżka SMART',
            capexStages: $stages,
            coFinancingRatePercent: 60.0,
            grantCap: null,
            advanceRatePercent: 20.0,
            finalRetentionPercent: 10.0,
            reimbursementLagMonths: 2,
            projectStartDate: $startDate
        );

        $this->assertInstanceOf(GrantCalculationResult::class, $result);
        $this->assertEquals('FENG Ścieżka SMART', $result->grantProgramName());
        $this->assertEquals('1100000.0000', $result->totalCapex()->amount());
        $this->assertEquals('1000000.0000', $result->totalEligibleCosts()->amount());
        $this->assertEquals('100000.0000', $result->nonEligibleCosts()->amount());
        $this->assertEquals(60.0, $result->coFinancingRatePercent());
        $this->assertEquals('600000.0000', $result->maxGrantAmount()->amount());
        $this->assertEquals('120000.0000', $result->advancePaymentAmount()->amount()); // 20% of 600k
        $this->assertEquals('400000.0000', $result->beneficiaryEligibleContribution()->amount()); // 1M - 600k
        $this->assertEquals('500000.0000', $result->totalBeneficiaryContribution()->amount()); // 100k + 400k

        // Verify total disbursed matches max grant exactly
        $this->assertEquals('600000.0000', $result->totalDisbursed()->amount());
        $this->assertTrue($result->totalDisbursed()->equals($result->maxGrantAmount()));

        // Tranches verification:
        // 1 Advance + 2 Interim + 1 Final = 4 tranches
        $this->assertCount(4, $result->tranches());

        // Tranche 1: Advance (month 1, 120,000 PLN)
        $advance = $result->advanceTranche();
        $this->assertNotNull($advance);
        $this->assertTrue($advance->isAdvance());
        $this->assertEquals(1, $advance->month());
        $this->assertEquals('120000.0000', $advance->disbursementAmount()->amount());
        $this->assertEquals('120000.0000', $advance->cumulativeDisbursed()->amount());

        // Interim Tranches (Pool = 600k - 120k adv - 60k final = 420,000 PLN)
        $interims = $result->interimTranches();
        $this->assertCount(2, $interims);

        // Stage 1 interim: month 3 + 2 = 5, share = 40% of 420k = 168,000 PLN
        $this->assertEquals(5, $interims[0]->month());
        $this->assertTrue($interims[0]->isInterim());
        $this->assertEquals('168000.0000', $interims[0]->disbursementAmount()->amount());

        // Stage 2 interim: month 6 + 2 = 8, share = 60% of 420k = 252,000 PLN
        $this->assertEquals(8, $interims[1]->month());
        $this->assertTrue($interims[1]->isInterim());
        $this->assertEquals('252000.0000', $interims[1]->disbursementAmount()->amount());

        // Final Tranche: month 8 + 1 = 9, amount = 60,000 PLN
        $final = $result->finalTranche();
        $this->assertNotNull($final);
        $this->assertTrue($final->isFinal());
        $this->assertEquals(9, $final->month());
        $this->assertEquals('60000.0000', $final->disbursementAmount()->amount());
        $this->assertEquals('600000.0000', $final->cumulativeDisbursed()->amount());
    }

    public function test_generate_from_investment_project_aggregate(): void
    {
        $startDate = new DateTimeImmutable('2026-03-01');

        $financing = FinancingStructure::create(
            investor1Equity: Money::fromDecimal('500000.0000', Currency::PLN),
            investor2Equity: Money::zero(Currency::PLN),
            grantAmount: Money::fromDecimal('400000.0000', Currency::PLN),
            grantIntensityPercent: 50.0,
            vatBridgeLoanAmount: Money::zero(Currency::PLN)
        );

        $debt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Kredyt Bankowy',
            Money::fromDecimal('300000.0000', Currency::PLN),
            InterestMargin::fromPercentage(2.0),
            6.5,
            LoanTenor::fromMonths(60, 6),
            AmortizationType::ANNUITY
        );

        $project = InvestmentProject::create(
            InvestmentProjectId::generate(),
            'c1111111-1111-1111-1111-111111111111',
            'Nowy Zakład Produkcyjny',
            'Budowa zakładu z dotacją',
            $startDate,
            $financing,
            $debt
        );

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Roboty budowlano-montażowe',
            Money::fromDecimal('800000.0000', Currency::PLN),
            $startDate,
            6,
            null,
            true,
            Money::fromDecimal('800000.0000', Currency::PLN)
        );

        $project->addCapexStage($stage);

        $result = $this->service->generateFromAggregate(
            $project,
            'Program Regionalny Fundusze dla Mazowsza',
            advanceRatePercent: 20.0,
            finalRetentionPercent: 10.0
        );

        $this->assertEquals('Program Regionalny Fundusze dla Mazowsza', $result->grantProgramName());
        $this->assertEquals('800000.0000', $result->totalEligibleCosts()->amount());
        $this->assertEquals(50.0, $result->coFinancingRatePercent());
        // 50% of 800k = 400,000 PLN
        $this->assertEquals('400000.0000', $result->maxGrantAmount()->amount());
        $this->assertEquals('400000.0000', $result->totalDisbursed()->amount());

        // Check annual summary
        $annual = $result->annualDisbursementSummary(15);
        $this->assertArrayHasKey(1, $annual);
        $this->assertArrayHasKey(15, $annual);
        // All disbursements occurred within year 1 (months 1, 8, 9)
        $this->assertEquals('400000.0000', $annual[1]->amount());
        $this->assertEquals('0.0000', $annual[2]->amount());
    }

    public function test_disbursement_at_month_and_cumulative_queries(): void
    {
        $startDate = new DateTimeImmutable('2026-01-01');

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Inwestycja OZE',
            Money::fromDecimal('200000.0000', Currency::PLN),
            $startDate,
            4,
            null,
            true,
            Money::fromDecimal('200000.0000', Currency::PLN)
        );

        $result = $this->service->calculate(
            grantProgramName: 'Dotacja OZE',
            capexStages: [$stage],
            coFinancingRatePercent: 50.0,
            advanceRatePercent: 25.0,
            finalRetentionPercent: 15.0,
            reimbursementLagMonths: 2,
            projectStartDate: $startDate
        );

        // Max grant = 100,000 PLN
        // Month 1 advance: 25,000 PLN
        // Month 6 (4 + 2) interim: 60,000 PLN
        // Month 7 final: 15,000 PLN
        $this->assertEquals('25000.0000', $result->disbursementAtMonth(1)->amount());
        $this->assertEquals('0.0000', $result->disbursementAtMonth(2)->amount());
        $this->assertEquals('60000.0000', $result->disbursementAtMonth(6)->amount());
        $this->assertEquals('15000.0000', $result->disbursementAtMonth(7)->amount());

        $this->assertEquals('25000.0000', $result->cumulativeDisbursementAtMonth(1)->amount());
        $this->assertEquals('25000.0000', $result->cumulativeDisbursementAtMonth(3)->amount());
        $this->assertEquals('85000.0000', $result->cumulativeDisbursementAtMonth(6)->amount());
        $this->assertEquals('100000.0000', $result->cumulativeDisbursementAtMonth(12)->amount());

        $array = $result->toArray();
        $this->assertIsArray($array);
        $this->assertEquals('Dotacja OZE', $array['grant_program_name']);
        $this->assertCount(3, $array['tranches']);
    }

    public function test_invalid_parameters_throw_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->service->calculate(
            grantProgramName: 'Test',
            capexStages: [],
            coFinancingRatePercent: 105.0 // rate > 100%
        );
    }

    public function test_advance_plus_final_retention_exceeding_100_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->service->calculate(
            grantProgramName: 'Test',
            capexStages: [],
            coFinancingRatePercent: 50.0,
            advanceRatePercent: 60.0,
            finalRetentionPercent: 50.0 // 60 + 50 = 110% > 100%
        );
    }

    public function test_empty_program_name_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->service->calculate(
            grantProgramName: '   ',
            capexStages: [],
            coFinancingRatePercent: 50.0
        );
    }
}
