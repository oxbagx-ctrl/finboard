<?php

declare(strict_types=1);

namespace Tests\Feature\InvestmentProject;

use App\Contexts\InvestmentProject\Application\Commands\AddCapexStage\AddCapexStageCommand;
use App\Contexts\InvestmentProject\Application\Commands\AddCapexStage\AddCapexStageHandler;
use App\Contexts\InvestmentProject\Application\Commands\InitializeInvestmentProject\InitializeInvestmentProjectCommand;
use App\Contexts\InvestmentProject\Application\Commands\InitializeInvestmentProject\InitializeInvestmentProjectHandler;
use App\Contexts\InvestmentProject\Application\Commands\RemoveCapexStage\RemoveCapexStageCommand;
use App\Contexts\InvestmentProject\Application\Commands\RemoveCapexStage\RemoveCapexStageHandler;
use App\Contexts\InvestmentProject\Application\Commands\UpdateCapexStage\UpdateCapexStageCommand;
use App\Contexts\InvestmentProject\Application\Commands\UpdateCapexStage\UpdateCapexStageHandler;
use App\Contexts\InvestmentProject\Application\Exceptions\CapexStageNotFoundException;
use App\Contexts\InvestmentProject\Application\Exceptions\InvestmentProjectNotFoundException;
use App\Contexts\InvestmentProject\Domain\Events\CapexStageAdded;
use App\Contexts\InvestmentProject\Domain\Events\CapexStageRemoved;
use App\Contexts\InvestmentProject\Domain\Events\CapexStageUpdated;
use App\Contexts\InvestmentProject\Domain\Events\InvestmentProjectCreated;
use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Models\Company;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\TestCase;

final class InvestmentProjectCommandsIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private Company $companyA;
    private Company $companyB;
    private InvestmentProjectRepositoryInterface $repository;
    private InitializeInvestmentProjectHandler $initHandler;
    private AddCapexStageHandler $addHandler;
    private UpdateCapexStageHandler $updateHandler;
    private RemoveCapexStageHandler $removeHandler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyA = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Projekt BioGas Energy Sp. z o.o.',
            'code' => 'BIOGAS_TEST',
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->companyB = Company::create([
            'id' => (string) Str::uuid(),
            'name' => 'Firma Obca Sp. z o.o.',
            'code' => 'FOREIGN_TEST',
            'tax_id' => 'PL' . random_int(1000000000, 9999999999),
        ]);

        $this->repository = $this->app->make(InvestmentProjectRepositoryInterface::class);
        $this->initHandler = new InitializeInvestmentProjectHandler($this->repository);
        $this->addHandler = new AddCapexStageHandler($this->repository);
        $this->updateHandler = new UpdateCapexStageHandler($this->repository);
        $this->removeHandler = new RemoveCapexStageHandler($this->repository);
    }

    public function test_can_initialize_investment_project_via_command(): void
    {
        Event::fake([InvestmentProjectCreated::class]);
        $initHandler = new InitializeInvestmentProjectHandler($this->app->make(InvestmentProjectRepositoryInterface::class));

        $command = new InitializeInvestmentProjectCommand(
            companyId: $this->companyA->id,
            name: 'Biogazownia Rolnicza 1.5 MW',
            description: 'Kompleks biometanu z kogeneracją',
            startDate: '2026-05-01',
            planningHorizonYears: 15,
            currency: 'PLN',
            equityContribution: '6000000.0000',
            grantAmount: '8000000.0000',
            grantIntensityPercent: 35.0,
            vatBridgeLoan: '4600000.0000',
            bankLoanPrincipal: '12000000.0000',
            bankBaseRate: 5.75,
            bankMargin: 2.15,
            bankTenorMonths: 180,
            bankGracePeriodMonths: 18,
            amortizationType: 'ANNUITY'
        );

        $projectId = $initHandler->handle($command);

        $this->assertNotEmpty($projectId);
        Event::assertDispatched(InvestmentProjectCreated::class);

        $saved = $this->repository->findById(InvestmentProjectId::fromString($projectId), $this->companyA->id);
        $this->assertNotNull($saved);
        $this->assertEquals('Biogazownia Rolnicza 1.5 MW', $saved->name());
        $this->assertEquals('draft', $saved->status());
        $this->assertEquals('6000000.0000', $saved->financingStructure()->investor1Equity()->amount());
        $this->assertEquals('12000000.0000', $saved->debtFacility()->committedAmount()->amount());
        $this->assertEquals(2.15, $saved->debtFacility()->margin()->percentage());
    }

    public function test_can_add_update_and_remove_capex_stages_with_domain_events(): void
    {
        Event::fake([
            InvestmentProjectCreated::class,
            CapexStageAdded::class,
            CapexStageUpdated::class,
            CapexStageRemoved::class,
        ]);
        $repo = $this->app->make(InvestmentProjectRepositoryInterface::class);
        $initHandler = new InitializeInvestmentProjectHandler($repo);
        $addHandler = new AddCapexStageHandler($repo);
        $updateHandler = new UpdateCapexStageHandler($repo);
        $removeHandler = new RemoveCapexStageHandler($repo);

        // 1. Initialize project
        $projectId = $initHandler->handle(new InitializeInvestmentProjectCommand(
            companyId: $this->companyA->id,
            name: 'Projekt Elektrociepłowni',
            description: 'Etapy inwestycyjne',
            startDate: '2026-06-01'
        ));

        // 2. Add Capex Stage 1
        $stage1Id = $addHandler->handle(new AddCapexStageCommand(
            projectId: $projectId,
            companyId: $this->companyA->id,
            stageName: 'Prace projektowe i fundamenty',
            netAmount: '4000000.0000',
            currency: 'PLN',
            startDate: '2026-06-01',
            durationMonths: 4,
            kstCode: 'KST_2',
            isGrantEligible: true,
            stageOrder: 1
        ));

        Event::assertDispatched(CapexStageAdded::class);

        // Verify stage 1 added
        $project = $repo->findById(InvestmentProjectId::fromString($projectId), $this->companyA->id);
        $this->assertNotNull($project);
        $this->assertCount(1, $project->capexStages());
        $this->assertEquals('4000000.0000', $project->totalCapexNet()->amount());

        // 3. Update Capex Stage 1
        $updateHandler->handle(new UpdateCapexStageCommand(
            projectId: $projectId,
            companyId: $this->companyA->id,
            stageId: $stage1Id,
            stageName: 'Prace projektowe i fundamenty - Aneks',
            netAmount: '4500000.0000',
            currency: 'PLN',
            startDate: '2026-06-01',
            durationMonths: 5,
            kstCode: 'KST_2',
            isGrantEligible: true,
            stageOrder: 1
        ));

        Event::assertDispatched(CapexStageUpdated::class);

        $projectAfterUpdate = $repo->findById(InvestmentProjectId::fromString($projectId), $this->companyA->id);
        $this->assertEquals('4500000.0000', $projectAfterUpdate->totalCapexNet()->amount());
        $this->assertEquals('Prace projektowe i fundamenty - Aneks', $projectAfterUpdate->capexStages()[0]->name());

        // 4. Remove Capex Stage 1
        $removeHandler->handle(new RemoveCapexStageCommand(
            projectId: $projectId,
            companyId: $this->companyA->id,
            stageId: $stage1Id
        ));

        Event::assertDispatched(CapexStageRemoved::class);

        $projectAfterRemove = $repo->findById(InvestmentProjectId::fromString($projectId), $this->companyA->id);
        $this->assertCount(0, $projectAfterRemove->capexStages());
        $this->assertEquals('0.0000', $projectAfterRemove->totalCapexNet()->amount());
    }

    public function test_tenant_isolation_fails_when_accessing_other_company_project(): void
    {
        $projectId = $this->initHandler->handle(new InitializeInvestmentProjectCommand(
            companyId: $this->companyA->id,
            name: 'Projekt Poufny Spółki A',
            description: 'Tylko dla A',
            startDate: '2026-01-01'
        ));

        // Attempting to add a stage from Company B must throw InvestmentProjectNotFoundException
        $this->expectException(InvestmentProjectNotFoundException::class);

        $this->addHandler->handle(new AddCapexStageCommand(
            projectId: $projectId,
            companyId: $this->companyB->id,
            stageName: 'Nieautoryzowany etap',
            netAmount: '100000.0000'
        ));
    }

    public function test_updating_non_existent_stage_throws_exception(): void
    {
        $projectId = $this->initHandler->handle(new InitializeInvestmentProjectCommand(
            companyId: $this->companyA->id,
            name: 'Projekt Testowy',
            description: 'Brak etapów',
            startDate: '2026-01-01'
        ));

        $this->expectException(CapexStageNotFoundException::class);

        $this->updateHandler->handle(new UpdateCapexStageCommand(
            projectId: $projectId,
            companyId: $this->companyA->id,
            stageId: (string) Str::uuid(),
            stageName: 'Nieistniejący etap',
            netAmount: '50000.0000'
        ));
    }
}
