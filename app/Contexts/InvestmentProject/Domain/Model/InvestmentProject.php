<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Model;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Entities\FinancingStructure;
use App\Contexts\InvestmentProject\Domain\Events\CapexStageAdded;
use App\Contexts\InvestmentProject\Domain\Events\DebtFacilityConfigured;
use App\Contexts\InvestmentProject\Domain\Events\FinancingStructureUpdated;
use App\Contexts\InvestmentProject\Domain\Events\InvestmentProjectCreated;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapitalizationRate;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\ProjectBudget;
use App\Contexts\InvestmentProject\Domain\ValueObjects\ValuationMultiple;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatRate;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WorkingCapitalDays;
use App\Shared\Domain\AggregateRoot;
use DateTimeImmutable;
use InvalidArgumentException;

final class InvestmentProject extends AggregateRoot
{
    /** @var array<string, CapexStage> */
    private array $capexStages = [];

    public function __construct(
        private readonly InvestmentProjectId $id,
        private readonly string $companyId,
        private string $name,
        private string $description,
        private DateTimeImmutable $startDate,
        private int $planningHorizonYears,
        private FinancingStructure $financingStructure,
        private DebtFacility $debtFacility,
        private VatRate $vatRate,
        private WorkingCapitalDays $workingCapitalDays,
        private CapitalizationRate $capitalizationRate,
        private ValuationMultiple $valuationMultiple,
        private string $status = 'draft',
        private readonly DateTimeImmutable $createdAt = new DateTimeImmutable(),
        private ?DateTimeImmutable $updatedAt = null
    ) {
        $trimmedCompany = trim($companyId);
        if ($trimmedCompany === '') {
            throw new InvalidArgumentException('InvestmentProject must be associated with a valid companyId.');
        }

        $trimmedName = trim($name);
        if ($trimmedName === '') {
            throw new InvalidArgumentException('InvestmentProject name cannot be empty.');
        }

        if ($planningHorizonYears < 1 || $planningHorizonYears > 30) {
            throw new InvalidArgumentException(
                sprintf('Planning horizon must be between 1 and 30 years, %d given.', $planningHorizonYears)
            );
        }

        $this->name = $trimmedName;
        $this->description = trim($description);
    }

    public static function create(
        InvestmentProjectId $id,
        string $companyId,
        string $name,
        string $description,
        DateTimeImmutable $startDate,
        FinancingStructure $financingStructure,
        DebtFacility $debtFacility,
        ?VatRate $vatRate = null,
        ?WorkingCapitalDays $workingCapitalDays = null,
        ?CapitalizationRate $capitalizationRate = null,
        ?ValuationMultiple $valuationMultiple = null,
        int $planningHorizonYears = 15
    ): self {
        $project = new self(
            $id,
            $companyId,
            $name,
            $description,
            $startDate,
            $planningHorizonYears,
            $financingStructure,
            $debtFacility,
            $vatRate ?? VatRate::standard(),
            $workingCapitalDays ?? WorkingCapitalDays::fromParams(30, 30, 0),
            $capitalizationRate ?? CapitalizationRate::fromPercentage(7.5),
            $valuationMultiple ?? ValuationMultiple::fromFloat(8.0),
            'draft'
        );

        $project->recordThat(
            new InvestmentProjectCreated(
                $id,
                $companyId,
                $name,
                $startDate->format('Y-m-d'),
                $planningHorizonYears
            )
        );

        return $project;
    }

    public function id(): string
    {
        return $this->id->value();
    }

    public function projectId(): InvestmentProjectId
    {
        return $this->id;
    }

    public function companyId(): string
    {
        return $this->companyId;
    }

    public function name(): string
    {
        return $this->name;
    }

    public function description(): string
    {
        return $this->description;
    }

    public function startDate(): DateTimeImmutable
    {
        return $this->startDate;
    }

    public function planningHorizonYears(): int
    {
        return $this->planningHorizonYears;
    }

    public function financingStructure(): FinancingStructure
    {
        return $this->financingStructure;
    }

    public function debtFacility(): DebtFacility
    {
        return $this->debtFacility;
    }

    public function vatRate(): VatRate
    {
        return $this->vatRate;
    }

    public function workingCapitalDays(): WorkingCapitalDays
    {
        return $this->workingCapitalDays;
    }

    public function capitalizationRate(): CapitalizationRate
    {
        return $this->capitalizationRate;
    }

    public function valuationMultiple(): ValuationMultiple
    {
        return $this->valuationMultiple;
    }

    public function status(): string
    {
        return $this->status;
    }

    public function createdAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function updatedAt(): ?DateTimeImmutable
    {
        return $this->updatedAt;
    }

    /**
     * @return array<CapexStage>
     */
    public function capexStages(): array
    {
        $stages = array_values($this->capexStages);
        usort($stages, static fn (CapexStage $a, CapexStage $b) => $a->stageOrder() <=> $b->stageOrder());

        return $stages;
    }

    public function addCapexStage(CapexStage $stage): void
    {
        $this->capexStages[$stage->id()] = $stage;
        $this->touch();

        $this->recordThat(
            new CapexStageAdded(
                $this->id,
                $stage->stageId(),
                $stage->name(),
                $stage->netAmount()->amount(),
                $stage->netAmount()->currency()->value,
                $stage->durationMonths(),
                $stage->kst()->code()
            )
        );
    }

    public function removeCapexStage(string $stageId): void
    {
        if (isset($this->capexStages[$stageId])) {
            unset($this->capexStages[$stageId]);
            $this->touch();
        }
    }

    public function getCapexStage(string $stageId): ?CapexStage
    {
        return $this->capexStages[$stageId] ?? null;
    }

    /**
     * Reconstitute stages from persistence layer without recording domain events.
     *
     * @param array<CapexStage> $stages
     */
    public function hydrateCapexStages(array $stages): void
    {
        $this->capexStages = [];
        foreach ($stages as $stage) {
            $this->capexStages[$stage->id()] = $stage;
        }
    }

    public function configureDebtFacility(DebtFacility $facility): void
    {
        $this->debtFacility = $facility;
        $this->touch();

        $this->recordThat(
            new DebtFacilityConfigured(
                $this->id,
                $facility->facilityId(),
                $facility->name(),
                $facility->committedAmount()->amount(),
                $facility->committedAmount()->currency()->value,
                $facility->nominalAnnualRate(),
                $facility->tenor()->tenorMonths(),
                $facility->tenor()->gracePeriodMonths(),
                $facility->amortizationType()->value
            )
        );
    }

    public function updateFinancingStructure(FinancingStructure $structure): void
    {
        $this->financingStructure = $structure;
        $this->touch();

        $this->recordThat(
            new FinancingStructureUpdated(
                $this->id,
                $structure->investor1Equity()->amount(),
                $structure->investor2Equity()->amount(),
                $structure->grantAmount()->amount(),
                $structure->grantIntensityPercent(),
                $structure->vatBridgeLoanAmount()->amount(),
                $structure->investor1Equity()->currency()->value
            )
        );
    }

    public function updateOperatingParameters(
        WorkingCapitalDays $workingCapitalDays,
        CapitalizationRate $capitalizationRate,
        ValuationMultiple $valuationMultiple,
        ?VatRate $vatRate = null
    ): void {
        $this->workingCapitalDays = $workingCapitalDays;
        $this->capitalizationRate = $capitalizationRate;
        $this->valuationMultiple = $valuationMultiple;
        if ($vatRate !== null) {
            $this->vatRate = $vatRate;
        }
        $this->touch();
    }

    /**
     * Total Net CAPEX aggregated across all stages.
     */
    public function totalCapexNet(): Money
    {
        $currency = $this->financingStructure->investor1Equity()->currency();
        $total = Money::zero($currency);

        foreach ($this->capexStages as $stage) {
            $total = $total->add($stage->netAmount());
        }

        return $total;
    }

    /**
     * Total Gross CAPEX including statutory VAT.
     */
    public function totalCapexGross(): Money
    {
        return $this->vatRate->calculateGross($this->totalCapexNet());
    }

    /**
     * Total VAT tax associated with CAPEX execution.
     */
    public function totalCapexVat(): Money
    {
        return $this->vatRate->calculateVat($this->totalCapexNet());
    }

    /**
     * Total Grant-Eligible CAPEX across all stages.
     */
    public function totalGrantEligibleCapex(): Money
    {
        $currency = $this->financingStructure->investor1Equity()->currency();
        $total = Money::zero($currency);

        foreach ($this->capexStages as $stage) {
            if ($stage->isGrantEligible()) {
                $total = $total->add($stage->grantEligibleAmount());
            }
        }

        return $total;
    }

    /**
     * Synthesize dynamic ProjectBudget reflecting current stages and financing montage.
     */
    public function budget(): ProjectBudget
    {
        return ProjectBudget::create(
            $this->totalCapexNet(),
            $this->financingStructure->totalEquity(),
            $this->debtFacility->committedAmount(),
            $this->financingStructure->grantAmount(),
            $this->financingStructure->vatBridgeLoanAmount()
        );
    }

    public function isFullyFunded(): bool
    {
        return $this->budget()->isFullyFunded();
    }

    public function fundingGap(): Money
    {
        return $this->budget()->fundingGap();
    }

    /**
     * Commercial operations start date (completion of construction / CAPEX stage).
     */
    public function commercialOperationStartDate(): DateTimeImmutable
    {
        if (empty($this->capexStages)) {
            return $this->startDate;
        }

        $latestDate = $this->startDate;
        foreach ($this->capexStages as $stage) {
            $compDate = $stage->completionDate();
            if ($compDate > $latestDate) {
                $latestDate = $compDate;
            }
        }

        return $latestDate;
    }

    public function activate(): void
    {
        $this->status = 'active';
        $this->touch();
    }

    public function archive(): void
    {
        $this->status = 'archived';
        $this->touch();
    }

    private function touch(): void
    {
        $this->updatedAt = new DateTimeImmutable();
    }
}
