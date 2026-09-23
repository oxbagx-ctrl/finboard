<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Infrastructure\Repositories;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Entities\FinancingStructure;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapitalizationRate;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\ValuationMultiple;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatRate;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WorkingCapitalDays;
use App\Models\InvestmentCapexStage as EloquentInvestmentCapexStage;
use App\Models\InvestmentDebtFacility as EloquentInvestmentDebtFacility;
use App\Models\InvestmentFinancingStructure as EloquentInvestmentFinancingStructure;
use App\Models\InvestmentProject as EloquentInvestmentProject;
use DateTimeImmutable;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class EloquentInvestmentProjectRepository implements InvestmentProjectRepositoryInterface
{
    public function __construct(
        private readonly Dispatcher $dispatcher
    ) {
    }

    public function findById(InvestmentProjectId $id, ?string $companyId = null): ?InvestmentProject
    {
        $query = EloquentInvestmentProject::query()
            ->with(['capexStages', 'financingStructure', 'debtFacilities', 'grantAllocations'])
            ->where('id', $id->value());

        if ($companyId !== null) {
            $query->where('company_id', $companyId);
        }

        /** @var EloquentInvestmentProject|null $eloquent */
        $eloquent = $query->first();

        if ($eloquent === null) {
            return null;
        }

        return $this->toDomain($eloquent);
    }

    /**
     * @return array<InvestmentProject>
     */
    public function findByCompanyId(string $companyId, ?string $status = null): array
    {
        $query = EloquentInvestmentProject::query()
            ->with(['capexStages', 'financingStructure', 'debtFacilities', 'grantAllocations'])
            ->where('company_id', $companyId)
            ->orderBy('created_at', 'desc');

        if ($status !== null) {
            $query->where('status', $status);
        }

        return $query->get()
            ->map(fn (EloquentInvestmentProject $model) => $this->toDomain($model))
            ->all();
    }

    public function save(InvestmentProject $project): void
    {
        DB::transaction(function () use ($project) {
            $currency = $project->financingStructure()->investor1Equity()->currency()->value;

            // 1. Upsert InvestmentProject
            EloquentInvestmentProject::query()->updateOrCreate(
                ['id' => $project->id()],
                [
                    'company_id' => $project->companyId(),
                    'name' => $project->name(),
                    'description' => $project->description(),
                    'status' => $project->status(),
                    'currency' => $currency,
                    'commercial_operation_date' => $project->commercialOperationStartDate()->format('Y-m-d'),
                ]
            );

            // 2. Upsert FinancingStructure
            $fin = $project->financingStructure();
            EloquentInvestmentFinancingStructure::query()->updateOrCreate(
                ['project_id' => $project->id()],
                [
                    'id' => $fin->id(),
                    'company_id' => $project->companyId(),
                    'equity_contribution' => $fin->investor1Equity()->amount(),
                    'bank_loan_amount' => $project->debtFacility()->committedAmount()->amount(),
                    'grant_amount' => $fin->grantAmount()->amount(),
                    'vat_bridge_loan' => $fin->vatBridgeLoanAmount()->amount(),
                    'currency' => $currency,
                ]
            );

            // 3. Upsert DebtFacility
            $debt = $project->debtFacility();
            EloquentInvestmentDebtFacility::query()->updateOrCreate(
                ['id' => $debt->id()],
                [
                    'project_id' => $project->id(),
                    'company_id' => $project->companyId(),
                    'facility_name' => $debt->name(),
                    'principal_amount' => $debt->committedAmount()->amount(),
                    'currency' => $debt->committedAmount()->currency()->value,
                    'base_rate_type' => 'WIBOR_3M',
                    'base_rate_percent' => (string) $debt->baseRate(),
                    'margin_percent' => (string) $debt->margin()->percentage(),
                    'tenor_months' => $debt->tenor()->tenorMonths(),
                    'grace_period_months' => $debt->tenor()->gracePeriodMonths(),
                    'amortization_type' => $debt->amortizationType()->value,
                    'upfront_fee_percent' => (string) $debt->upfrontFeeRate(),
                ]
            );

            // 4. Sync CapexStages
            $stageIds = [];
            foreach ($project->capexStages() as $stage) {
                $stageIds[] = $stage->id();
                EloquentInvestmentCapexStage::query()->updateOrCreate(
                    ['id' => $stage->id()],
                    [
                        'project_id' => $project->id(),
                        'company_id' => $project->companyId(),
                        'stage_name' => $stage->name(),
                        'net_amount' => $stage->netAmount()->amount(),
                        'currency' => $stage->netAmount()->currency()->value,
                        'vat_rate_percent' => (string) $project->vatRate()->percentage(),
                        'vat_rate_code' => $project->vatRate()->code(),
                        'start_date' => $stage->startDate()->format('Y-m-d'),
                        'completion_date' => $stage->completionDate()->format('Y-m-d'),
                        'kst_code' => $stage->kst()->code(),
                        'kst_annual_rate' => (string) $stage->kst()->annualDepreciationRate(),
                        'eligible_for_grant' => $stage->isGrantEligible(),
                        'grant_eligible_amount' => $stage->isGrantEligible()
                            ? $stage->grantEligibleAmount()->amount()
                            : null,
                        'order_index' => $stage->stageOrder(),
                    ]
                );
            }

            // Remove deleted stages
            EloquentInvestmentCapexStage::query()
                ->where('project_id', $project->id())
                ->whereNotIn('id', $stageIds)
                ->delete();
        });

        // 5. Dispatch domain events
        $this->dispatchDomainEvents($project);
    }

    public function delete(InvestmentProjectId $id, ?string $companyId = null): void
    {
        $query = EloquentInvestmentProject::query()->where('id', $id->value());

        if ($companyId !== null) {
            $query->where('company_id', $companyId);
        }

        $query->delete();
    }

    public function exists(InvestmentProjectId $id, ?string $companyId = null): bool
    {
        $query = EloquentInvestmentProject::query()->where('id', $id->value());

        if ($companyId !== null) {
            $query->where('company_id', $companyId);
        }

        return $query->exists();
    }

    public function countByCompanyId(string $companyId): int
    {
        return EloquentInvestmentProject::query()
            ->where('company_id', $companyId)
            ->count();
    }

    private function toDomain(EloquentInvestmentProject $eloquent): InvestmentProject
    {
        $currency = Currency::from($eloquent->currency ?? 'PLN');

        // Reconstruct FinancingStructure
        if ($eloquent->financingStructure !== null) {
            $fin = $eloquent->financingStructure;
            $finCurrency = Currency::from($fin->currency ?? $currency->value);
            $financing = new FinancingStructure(
                id: $fin->id,
                investor1Equity: Money::fromDecimal($fin->equity_contribution, $finCurrency),
                investor2Equity: Money::zero($finCurrency),
                grantAmount: Money::fromDecimal($fin->grant_amount, $finCurrency),
                grantIntensityPercent: 0.0,
                vatBridgeLoanAmount: Money::fromDecimal($fin->vat_bridge_loan, $finCurrency)
            );
        } else {
            $financing = new FinancingStructure(
                id: (string) Str::uuid(),
                investor1Equity: Money::zero($currency)
            );
        }

        // Reconstruct DebtFacility
        if ($eloquent->debtFacilities !== null && $eloquent->debtFacilities->isNotEmpty()) {
            $debt = $eloquent->debtFacilities->first();
            $debtCurrency = Currency::from($debt->currency ?? $currency->value);
            $debtFacility = new DebtFacility(
                id: DebtFacilityId::fromString($debt->id),
                name: $debt->facility_name,
                committedAmount: Money::fromDecimal($debt->principal_amount, $debtCurrency),
                margin: InterestMargin::fromPercentage((float) $debt->margin_percent),
                baseRate: (float) $debt->base_rate_percent,
                tenor: LoanTenor::fromMonths((int) $debt->tenor_months, (int) $debt->grace_period_months),
                amortizationType: AmortizationType::tryFrom($debt->amortization_type) ?? AmortizationType::ANNUITY,
                upfrontFeeRate: (float) $debt->upfront_fee_percent
            );
        } else {
            $debtFacility = new DebtFacility(
                id: DebtFacilityId::generate(),
                name: 'Kredyt Bankowy',
                committedAmount: Money::zero($currency),
                margin: InterestMargin::fromPercentage(2.0),
                baseRate: 5.85,
                tenor: LoanTenor::fromMonths(120, 0)
            );
        }

        // Project startDate: earliest stage start_date or commercial_operation_date or created_at
        $startDate = $eloquent->commercial_operation_date
            ? new DateTimeImmutable($eloquent->commercial_operation_date->format('Y-m-d'))
            : new DateTimeImmutable($eloquent->created_at?->format('Y-m-d') ?? 'today');

        $createdAt = new DateTimeImmutable($eloquent->created_at?->format(DateTimeImmutable::ATOM) ?? 'now');
        $updatedAt = $eloquent->updated_at ? new DateTimeImmutable($eloquent->updated_at->format(DateTimeImmutable::ATOM)) : null;

        $project = new InvestmentProject(
            id: InvestmentProjectId::fromString($eloquent->id),
            companyId: $eloquent->company_id,
            name: $eloquent->name,
            description: $eloquent->description ?? '',
            startDate: $startDate,
            planningHorizonYears: 15,
            financingStructure: $financing,
            debtFacility: $debtFacility,
            vatRate: VatRate::standard(),
            workingCapitalDays: WorkingCapitalDays::fromParams(30, 30, 0),
            capitalizationRate: CapitalizationRate::fromPercentage(7.5),
            valuationMultiple: ValuationMultiple::fromFloat(8.0),
            status: $eloquent->status ?? 'draft',
            createdAt: $createdAt,
            updatedAt: $updatedAt
        );

        // Reconstruct and hydrate CapexStages
        $domainStages = [];
        if ($eloquent->capexStages !== null) {
            foreach ($eloquent->capexStages as $stage) {
                $stageCurrency = Currency::from($stage->currency ?? $currency->value);
                $sStart = new DateTimeImmutable($stage->start_date->format('Y-m-d'));
                $sComp = new DateTimeImmutable($stage->completion_date->format('Y-m-d'));

                $diff = $sStart->diff($sComp);
                $durationMonths = max(1, ($diff->y * 12) + $diff->m);

                $grantEligible = ($stage->eligible_for_grant && $stage->grant_eligible_amount !== null)
                    ? Money::fromDecimal($stage->grant_eligible_amount, $stageCurrency)
                    : null;

                $domainStages[] = new CapexStage(
                    id: CapexStageId::fromString($stage->id),
                    name: $stage->stage_name,
                    netAmount: Money::fromDecimal($stage->net_amount, $stageCurrency),
                    startDate: $sStart,
                    durationMonths: $durationMonths,
                    kst: $stage->kst_code ? KstClassification::fromCode($stage->kst_code) : KstClassification::default(),
                    isGrantEligible: (bool) $stage->eligible_for_grant,
                    grantEligibleAmount: $grantEligible,
                    stageOrder: (int) $stage->order_index
                );
            }
        }
        $project->hydrateCapexStages($domainStages);

        return $project;
    }

    private function dispatchDomainEvents(InvestmentProject $project): void
    {
        foreach ($project->releaseEvents() as $event) {
            $this->dispatcher->dispatch($event);
        }
    }
}
