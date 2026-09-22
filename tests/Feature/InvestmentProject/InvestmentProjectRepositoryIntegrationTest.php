<?php

declare(strict_types=1);

namespace Tests\Feature\InvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Entities\FinancingStructure;
use App\Contexts\InvestmentProject\Domain\Events\CapexStageAdded;
use App\Contexts\InvestmentProject\Domain\Events\InvestmentProjectCreated;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Infrastructure\Repositories\EloquentInvestmentProjectRepository;
use App\Models\Company;
use DateTimeImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\TestCase;

final class InvestmentProjectRepositoryIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private Company $companyA;
    private Company $companyB;
    private InvestmentProjectRepositoryInterface $repository;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyA = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Renewable Energy Park Sp. z o.o.',
            'code' => 'REP_TEST',
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->companyB = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Biogas Plant S.A.',
            'code' => 'BIO_TEST',
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->repository = $this->app->make(InvestmentProjectRepositoryInterface::class);
    }

    public function test_repository_interface_is_bound_to_eloquent_implementation(): void
    {
        $this->assertInstanceOf(EloquentInvestmentProjectRepository::class, $this->repository);
    }

    public function test_can_save_and_reconstruct_aggregate_with_domain_events(): void
    {
        Event::fake([InvestmentProjectCreated::class, CapexStageAdded::class]);
        $repository = $this->app->make(InvestmentProjectRepositoryInterface::class);

        $projectId = InvestmentProjectId::generate();
        $startDate = new DateTimeImmutable('2026-06-01');

        $financing = new FinancingStructure(
            id: (string) Str::uuid(),
            investor1Equity: Money::fromDecimal('5000000.0000', Currency::PLN),
            grantAmount: Money::fromDecimal('3000000.0000', Currency::PLN),
            vatBridgeLoanAmount: Money::fromDecimal('2300000.0000', Currency::PLN)
        );

        $debt = new DebtFacility(
            id: DebtFacilityId::generate(),
            name: 'Kredyt Inwestycyjny EBI',
            committedAmount: Money::fromDecimal('12000000.0000', Currency::PLN),
            margin: InterestMargin::fromPercentage(1.85),
            baseRate: 5.75,
            tenor: LoanTenor::fromMonths(144, 12),
            amortizationType: AmortizationType::ANNUITY,
            upfrontFeeRate: 1.0
        );

        $project = InvestmentProject::create(
            id: $projectId,
            companyId: $this->companyA->id,
            name: 'Budowa Magazynu Energii BESS 10MW',
            description: 'Projekt magazynu wielkoskalowego',
            startDate: $startDate,
            financingStructure: $financing,
            debtFacility: $debt
        );

        $stage1 = new CapexStage(
            id: CapexStageId::generate(),
            name: 'Przyłącze WN i transformatory',
            netAmount: Money::fromDecimal('6000000.0000', Currency::PLN),
            startDate: $startDate,
            durationMonths: 6,
            kst: KstClassification::fromCode('KST-2'),
            isGrantEligible: true,
            stageOrder: 1
        );

        $stage2 = new CapexStage(
            id: CapexStageId::generate(),
            name: 'Baterie LFP i system BMS',
            netAmount: Money::fromDecimal('14000000.0000', Currency::PLN),
            startDate: $startDate->modify('+6 months'),
            durationMonths: 6,
            kst: KstClassification::fromCode('KST-4'),
            isGrantEligible: true,
            stageOrder: 2
        );

        $project->addCapexStage($stage1);
        $project->addCapexStage($stage2);

        // Save through repository
        $repository->save($project);

        // Assert domain events were dispatched
        Event::assertDispatched(InvestmentProjectCreated::class);
        Event::assertDispatched(CapexStageAdded::class);

        // Retrieve and assert aggregate reconstitution
        $loaded = $repository->findById($projectId, $this->companyA->id);
        $this->assertNotNull($loaded);
        $this->assertEquals($projectId->value(), $loaded->id());
        $this->assertEquals('Budowa Magazynu Energii BESS 10MW', $loaded->name());
        $this->assertEquals('Projekt magazynu wielkoskalowego', $loaded->description());
        $this->assertEquals('draft', $loaded->status());
        $this->assertEquals('5000000.0000', $loaded->financingStructure()->investor1Equity()->amount());
        $this->assertEquals('12000000.0000', $loaded->debtFacility()->committedAmount()->amount());
        $this->assertEquals(1.85, $loaded->debtFacility()->margin()->percentage());
        $this->assertEquals(144, $loaded->debtFacility()->tenor()->tenorMonths());

        // Assert stages and budget calculations
        $this->assertCount(2, $loaded->capexStages());
        $this->assertEquals('20000000.0000', $loaded->totalCapexNet()->amount());
        $this->assertEquals('24600000.0000', $loaded->totalCapexGross()->amount());
        $this->assertEquals('4600000.0000', $loaded->totalCapexVat()->amount());
    }

    public function test_multi_tenant_isolation_enforcement(): void
    {
        $projectId = InvestmentProjectId::generate();
        $financing = new FinancingStructure((string) Str::uuid(), Money::fromDecimal('1000000.0000', Currency::PLN));
        $debt = new DebtFacility(
            DebtFacilityId::generate(),
            'Kredyt',
            Money::fromDecimal('2000000.0000', Currency::PLN),
            InterestMargin::fromPercentage(2.0),
            5.0,
            LoanTenor::fromMonths(60, 0)
        );

        $project = InvestmentProject::create(
            id: $projectId,
            companyId: $this->companyA->id,
            name: 'Poufny Projekt Firmy A',
            description: 'Tylko dla Firmy A',
            startDate: new DateTimeImmutable('2026-01-01'),
            financingStructure: $financing,
            debtFacility: $debt
        );

        $this->repository->save($project);

        // Company A can access its project
        $this->assertNotNull($this->repository->findById($projectId, $this->companyA->id));
        $this->assertTrue($this->repository->exists($projectId, $this->companyA->id));

        // Company B CANNOT access Company A's project (Tenant Isolation)
        $this->assertNull($this->repository->findById($projectId, $this->companyB->id));
        $this->assertFalse($this->repository->exists($projectId, $this->companyB->id));

        // Listing projects for Company B does not leak Company A's project
        $projectsB = $this->repository->findByCompanyId($this->companyB->id);
        $this->assertEmpty($projectsB);

        // Attempting to delete Company A's project through Company B context fails silently without deleting
        $this->repository->delete($projectId, $this->companyB->id);
        $this->assertTrue($this->repository->exists($projectId, $this->companyA->id));

        // Deleting through Company A context succeeds
        $this->repository->delete($projectId, $this->companyA->id);
        $this->assertFalse($this->repository->exists($projectId, $this->companyA->id));
    }

    public function test_updating_aggregate_syncs_capex_stages(): void
    {
        $projectId = InvestmentProjectId::generate();
        $startDate = new DateTimeImmutable('2026-01-01');

        $financing = new FinancingStructure((string) Str::uuid(), Money::fromDecimal('2000000.0000', Currency::PLN));
        $debt = new DebtFacility(
            DebtFacilityId::generate(),
            'Kredyt',
            Money::fromDecimal('3000000.0000', Currency::PLN),
            InterestMargin::fromPercentage(2.0),
            5.0,
            LoanTenor::fromMonths(60, 0)
        );

        $project = InvestmentProject::create(
            id: $projectId,
            companyId: $this->companyA->id,
            name: 'Projekt z etapami',
            description: 'Opis',
            startDate: $startDate,
            financingStructure: $financing,
            debtFacility: $debt
        );

        $stage1 = new CapexStage(
            id: CapexStageId::generate(),
            name: 'Etap Początkowy',
            netAmount: Money::fromDecimal('1000000.0000', Currency::PLN),
            startDate: $startDate,
            durationMonths: 3
        );

        $project->addCapexStage($stage1);
        $this->repository->save($project);

        $this->assertEquals(1, $this->repository->countByCompanyId($this->companyA->id));

        // Re-load, activate project, remove stage1 and add stage2
        $loaded = $this->repository->findById($projectId, $this->companyA->id);
        $this->assertNotNull($loaded);
        $loaded->activate();
        $loaded->removeCapexStage($stage1->id());

        $stage2 = new CapexStage(
            id: CapexStageId::generate(),
            name: 'Nowy Etap Zastępczy',
            netAmount: Money::fromDecimal('2500000.0000', Currency::PLN),
            startDate: $startDate,
            durationMonths: 6
        );
        $loaded->addCapexStage($stage2);

        $this->repository->save($loaded);

        // Verify updated state
        $updated = $this->repository->findById($projectId, $this->companyA->id);
        $this->assertNotNull($updated);
        $this->assertEquals('active', $updated->status());
        $this->assertCount(1, $updated->capexStages());
        $this->assertEquals('Nowy Etap Zastępczy', $updated->capexStages()[0]->name());
        $this->assertEquals('2500000.0000', $updated->totalCapexNet()->amount());
    }
}
