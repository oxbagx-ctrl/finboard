<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Application\Commands\UpdateCapexStage;

final readonly class UpdateCapexStageCommand
{
    public function __construct(
        public string $projectId,
        public string $companyId,
        public string $stageId,
        public string $stageName,
        public string|int|float $netAmount,
        public string $currency = 'PLN',
        public ?string $startDate = null,
        public int $durationMonths = 1,
        public ?string $kstCode = null,
        public bool $isGrantEligible = false,
        public string|int|float|null $grantEligibleAmount = null,
        public int $stageOrder = 1
    ) {
    }
}
