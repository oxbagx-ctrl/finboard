<?php

declare(strict_types=1);

namespace Tests\Unit\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Entities\FinancingStructure;
use App\Contexts\InvestmentProject\Domain\Events\CapexStageAdded;
use App\Contexts\InvestmentProject\Domain\Events\DebtFacilityConfigured;
use App\Contexts\InvestmentProject\Domain\Events\FinancingStructureUpdated;
use App\Contexts\InvestmentProject\Domain\Events\InvestmentProjectCreated;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatRate;
use DateTimeImmutable;
use InvalidArgumentException;
use Tests\TestCase;

final class InvestmentProjectAggregateTest extends TestCase
{
    private function createSampleProject(): InvestmentProject
    {
        $id = InvestmentProjectId::generate();
        $companyId = 'company-helix-100';
        $startDate = new DateTimeImmutable('2026-01-01');

        $financing = FinancingStructure::create(
            Money::fromDecimal('2000000.00', Currency::PLN),
            Money::fromDecimal('1000000.00', Currency::PLN),
            Money::fromDecimal('2000000.00', Currency::PLN),
            50.0,
            Money::fromDecimal('2300000.00', Currency::PLN)
        );

        $debt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Kredyt Inwestycyjny EBOiR',
            Money::fromDecimal('5000000.00', Currency::PLN),
            InterestMargin::fromPercentage(2.25),
            5.85,
            LoanTenor::fromMonths(120, 12),
            AmortizationType::ANNUITY,
            1.0,
            $startDate
        );

        return InvestmentProject::create(
            $id,
            $companyId,
            'Budowa Centrum Logistycznego Helix',
            'Budowa nowoczesnego hubu magazynowo-produkcyjnego',
            $startDate,
            $financing,
            $debt
        );
    }

    public function test_investment_project_creation_records_domain_event(): void
    {
        $project = $this->createSampleProject();

        $this->assertEquals('Budowa Centrum Logistycznego Helix', $project->name());
        $this->assertEquals('company-helix-100', $project->companyId());
        $this->assertEquals(15, $project->planningHorizonYears());
        $this->assertEquals('draft', $project->status());

        $events = $project->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(InvestmentProjectCreated::class, $events[0]);
        $this->assertEquals($project->id(), $events[0]->aggregateId());

        $payload = $events[0]->toPayload();
        $this->assertEquals('Budowa Centrum Logistycznego Helix', $payload['name']);
        $this->assertEquals('company-helix-100', $payload['company_id']);
    }

    public function test_adding_capex_stages_calculates_totals_and_records_event(): void
    {
        $project = $this->createSampleProject();
        $project->releaseEvents(); // clear creation event

        // Stage 1: Zakup gruntu (KST_0 - nieamortyzowany, 2 000 000 PLN)
        $stage1 = CapexStage::create(
            CapexStageId::generate(),
            'Zakup działki inwestycyjnej',
            Money::fromDecimal('2000000.00', Currency::PLN),
            new DateTimeImmutable('2026-01-01'),
            3,
            KstClassification::fromCode('KST_0'),
            false,
            null,
            1
        );

        // Stage 2: Budowa hali produkcyjnej (KST_1 - 2.5%, 6 000 000 PLN, dotacja kwalifikowana)
        $stage2 = CapexStage::create(
            CapexStageId::generate(),
            'Generalne wykonawstwo hali',
            Money::fromDecimal('6000000.00', Currency::PLN),
            new DateTimeImmutable('2026-04-01'),
            12,
            KstClassification::fromCode('KST_1'),
            true,
            Money::fromDecimal('4000000.00', Currency::PLN),
            2
        );

        // Stage 3: Park maszynowy (KST_4 - 10%, 2 000 000 PLN)
        $stage3 = CapexStage::create(
            CapexStageId::generate(),
            'Linia technologiczna CNC',
            Money::fromDecimal('2000000.00', Currency::PLN),
            new DateTimeImmutable('2026-10-01'),
            6,
            KstClassification::fromCode('KST_4'),
            true,
            Money::fromDecimal('2000000.00', Currency::PLN),
            3
        );

        $project->addCapexStage($stage1);
        $project->addCapexStage($stage2);
        $project->addCapexStage($stage3);

        $this->assertCount(3, $project->capexStages());

        // Total Net CAPEX = 2M + 6M + 2M = 10 000 000 PLN
        $this->assertEquals(10000000.0, $project->totalCapexNet()->toDecimal());

        // Total Gross CAPEX (23% VAT) = 12 300 000 PLN
        $this->assertEquals(12300000.0, $project->totalCapexGross()->toDecimal());
        $this->assertEquals(2300000.0, $project->totalCapexVat()->toDecimal());

        // Total Grant-Eligible CAPEX = 4M + 2M = 6 000 000 PLN
        $this->assertEquals(6000000.0, $project->totalGrantEligibleCapex()->toDecimal());

        // Verify stage calculations
        $this->assertEquals(500000.0, $stage2->monthlyCapex()->toDecimal()); // 6M / 12 months
        $this->assertEquals(150000.0, $stage2->annualDepreciation()->toDecimal()); // 6M * 2.5%
        $this->assertEquals(12500.0, $stage2->monthlyDepreciation()->toDecimal()); // 150k / 12

        // Non-depreciable KST_0
        $this->assertEquals(0.0, $stage1->annualDepreciation()->toDecimal());

        $events = $project->releaseEvents();
        $this->assertCount(3, $events);
        $this->assertInstanceOf(CapexStageAdded::class, $events[0]);
        $this->assertInstanceOf(CapexStageAdded::class, $events[1]);
        $this->assertInstanceOf(CapexStageAdded::class, $events[2]);
    }

    public function test_budget_montage_and_commercial_operations_date(): void
    {
        $project = $this->createSampleProject();

        $stage = CapexStage::create(
            CapexStageId::generate(),
            'Budowa obiektu',
            Money::fromDecimal('10000000.00', Currency::PLN),
            new DateTimeImmutable('2026-01-01'),
            12, // ends 2027-01-01
            KstClassification::fromCode('KST_1')
        );
        $project->addCapexStage($stage);

        // Financing: Total Equity = 3M, Debt = 5M, Grant = 2M => Total = 10M
        $budget = $project->budget();
        $this->assertEquals(10000000.0, $budget->netCapex()->toDecimal());
        $this->assertEquals(10000000.0, $budget->totalFinancing()->toDecimal());
        $this->assertTrue($project->isFullyFunded());
        $this->assertEquals(0.0, $project->fundingGap()->toDecimal());

        // Commercial operations start date
        $expectedOpDate = new DateTimeImmutable('2027-01-01');
        $this->assertEquals($expectedOpDate->format('Y-m-d'), $project->commercialOperationStartDate()->format('Y-m-d'));
    }

    public function test_debt_facility_and_financing_structure_updates_emit_events(): void
    {
        $project = $this->createSampleProject();
        $project->releaseEvents();

        $newDebt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Zwiększony Kredyt PKO BP',
            Money::fromDecimal('6000000.00', Currency::PLN),
            InterestMargin::fromPercentage(2.50),
            5.85,
            LoanTenor::fromMonths(180, 24),
            AmortizationType::EQUAL_PRINCIPAL,
            1.5
        );

        $project->configureDebtFacility($newDebt);

        $this->assertEquals('Zwiększony Kredyt PKO BP', $project->debtFacility()->name());
        $this->assertEquals(8.35, $project->debtFacility()->nominalAnnualRate()); // 5.85 + 2.50
        $this->assertEquals(90000.0, $project->debtFacility()->upfrontFeeAmount()->toDecimal()); // 6M * 1.5%

        $newFinancing = FinancingStructure::create(
            Money::fromDecimal('3000000.00', Currency::PLN),
            Money::fromDecimal('1000000.00', Currency::PLN),
            Money::fromDecimal('1500000.00', Currency::PLN),
            40.0,
            Money::fromDecimal('1500000.00', Currency::PLN)
        );

        $project->updateFinancingStructure($newFinancing);

        $this->assertEquals(4000000.0, $project->financingStructure()->totalEquity()->toDecimal());
        $this->assertEquals(75.0, $project->financingStructure()->investor1Share()); // 3M / 4M = 75%
        $this->assertEquals(25.0, $project->financingStructure()->investor2Share()); // 1M / 4M = 25%

        $events = $project->releaseEvents();
        $this->assertCount(2, $events);
        $this->assertInstanceOf(DebtFacilityConfigured::class, $events[0]);
        $this->assertInstanceOf(FinancingStructureUpdated::class, $events[1]);
    }

    public function test_project_lifecycle_status_transitions(): void
    {
        $project = $this->createSampleProject();
        $this->assertEquals('draft', $project->status());

        $project->activate();
        $this->assertEquals('active', $project->status());
        $this->assertNotNull($project->updatedAt());

        $project->archive();
        $this->assertEquals('archived', $project->status());
    }

    public function test_empty_project_name_throws_exception(): void
    {
        $financing = FinancingStructure::create(Money::fromDecimal('100.00', Currency::PLN));
        $debt = DebtFacility::create(
            DebtFacilityId::generate(),
            'Kredyt',
            Money::fromDecimal('100.00', Currency::PLN),
            InterestMargin::fromPercentage(2.0),
            5.0,
            LoanTenor::fromMonths(12)
        );

        $this->expectException(InvalidArgumentException::class);
        InvestmentProject::create(
            InvestmentProjectId::generate(),
            'company-1',
            '   ',
            'opis',
            new DateTimeImmutable(),
            $financing,
            $debt
        );
    }
}
