<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Application\Commands\RemoveCapexStage;

use App\Contexts\InvestmentProject\Application\Exceptions\CapexStageNotFoundException;
use App\Contexts\InvestmentProject\Application\Exceptions\InvestmentProjectNotFoundException;
use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;

final class RemoveCapexStageHandler
{
    public function __construct(
        private readonly InvestmentProjectRepositoryInterface $repository
    ) {
    }

    public function handle(RemoveCapexStageCommand $command): void
    {
        $project = $this->repository->findById(
            InvestmentProjectId::fromString($command->projectId),
            $command->companyId
        );

        if ($project === null) {
            throw InvestmentProjectNotFoundException::withId($command->projectId, $command->companyId);
        }

        $existingStage = $project->getCapexStage($command->stageId);
        if ($existingStage === null) {
            throw CapexStageNotFoundException::withId($command->stageId, $command->projectId);
        }

        $project->removeCapexStage($command->stageId);

        $this->repository->save($project);
    }
}
