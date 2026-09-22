<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Application\Commands\InitializeInvestmentProject;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\DebtFacility;
use App\Contexts\InvestmentProject\Domain\Entities\FinancingStructure;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\ValueObjects\AmortizationType;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapitalizationRate;
use App\Contexts\InvestmentProject\Domain\ValueObjects\DebtFacilityId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InterestMargin;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\LoanTenor;
use App\Contexts\InvestmentProject\Domain\ValueObjects\ValuationMultiple;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatRate;
use App\Contexts\InvestmentProject\Domain\ValueObjects\WorkingCapitalDays;
use DateTimeImmutable;
use Illuminate\Support\Str;

final class InitializeInvestmentProjectHandler
{
    public function __construct(
        private readonly InvestmentProjectRepositoryInterface $repository
    ) {
    }

    public function handle(InitializeInvestmentProjectCommand $command): string
    {
        $projectId = $command->projectId !== null
            ? InvestmentProjectId::fromString($command->projectId)
            : InvestmentProjectId::generate();

        $currency = Currency::from($command->currency);
        $startDate = new DateTimeImmutable($command->startDate);

        $financing = new FinancingStructure(
            id: (string) Str::uuid(),
            investor1Equity: Money::fromDecimal($command->equityContribution, $currency),
            investor2Equity: Money::zero($currency),
            grantAmount: Money::fromDecimal($command->grantAmount, $currency),
            grantIntensityPercent: $command->grantIntensityPercent,
            vatBridgeLoanAmount: Money::fromDecimal($command->vatBridgeLoan, $currency)
        );

        $debtFacility = new DebtFacility(
            id: DebtFacilityId::generate(),
            name: 'Kredyt Bankowy Inwestycyjny',
            committedAmount: Money::fromDecimal($command->bankLoanPrincipal, $currency),
            margin: InterestMargin::fromPercentage($command->bankMargin),
            baseRate: $command->bankBaseRate,
            tenor: LoanTenor::fromMonths($command->bankTenorMonths, $command->bankGracePeriodMonths),
            amortizationType: AmortizationType::tryFrom($command->amortizationType) ?? AmortizationType::ANNUITY,
            upfrontFeeRate: $command->upfrontFeeRate
        );

        $vatRate = VatRate::fromPercentage($command->vatRatePercent);
        $workingCapital = WorkingCapitalDays::fromParams($command->dso, $command->dpo, $command->dio);
        $capitalizationRate = CapitalizationRate::fromPercentage($command->capitalizationRatePercent);
        $valuationMultiple = ValuationMultiple::fromFloat($command->valuationMultiple);

        $project = InvestmentProject::create(
            id: $projectId,
            companyId: $command->companyId,
            name: $command->name,
            description: $command->description,
            startDate: $startDate,
            financingStructure: $financing,
            debtFacility: $debtFacility,
            vatRate: $vatRate,
            workingCapitalDays: $workingCapital,
            capitalizationRate: $capitalizationRate,
            valuationMultiple: $valuationMultiple,
            planningHorizonYears: $command->planningHorizonYears
        );

        $this->repository->save($project);

        return $project->id();
    }
}
