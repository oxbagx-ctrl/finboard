<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Application\Commands\InitializeInvestmentProject;

final readonly class InitializeInvestmentProjectCommand
{
    public function __construct(
        public string $companyId,
        public string $name,
        public string $description,
        public string $startDate,
        public int $planningHorizonYears = 15,
        public string $currency = 'PLN',
        public string|int|float $equityContribution = '0.0000',
        public string|int|float $grantAmount = '0.0000',
        public float $grantIntensityPercent = 0.0,
        public string|int|float $vatBridgeLoan = '0.0000',
        public string|int|float $bankLoanPrincipal = '0.0000',
        public float $bankBaseRate = 5.85,
        public float $bankMargin = 2.00,
        public int $bankTenorMonths = 120,
        public int $bankGracePeriodMonths = 0,
        public string $amortizationType = 'ANNUITY',
        public float $upfrontFeeRate = 0.0,
        public float $vatRatePercent = 23.0,
        public int $dso = 30,
        public int $dpo = 30,
        public int $dio = 0,
        public float $capitalizationRatePercent = 7.5,
        public float $valuationMultiple = 8.0,
        public ?string $projectId = null
    ) {
    }
}
