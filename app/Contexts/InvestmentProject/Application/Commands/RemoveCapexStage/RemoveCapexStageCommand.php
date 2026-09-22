<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Application\Commands\RemoveCapexStage;

final readonly class RemoveCapexStageCommand
{
    public function __construct(
        public string $projectId,
        public string $companyId,
        public string $stageId
    ) {
    }
}
