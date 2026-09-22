<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Application\Commands\UpdateCapexStage;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Application\Exceptions\CapexStageNotFoundException;
use App\Contexts\InvestmentProject\Application\Exceptions\InvestmentProjectNotFoundException;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use DateTimeImmutable;

final class UpdateCapexStageHandler
{
    public function __construct(
        private readonly InvestmentProjectRepositoryInterface $repository
    ) {
    }

    public function handle(UpdateCapexStageCommand $command): void
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

        $currency = Currency::from($command->currency);
        $netAmount = Money::fromDecimal($command->netAmount, $currency);

        $startDate = $command->startDate !== null
            ? new DateTimeImmutable($command->startDate)
            : $existingStage->startDate();

        $kst = $command->kstCode !== null
            ? KstClassification::fromCode($command->kstCode)
            : $existingStage->kst();

        $grantEligible = $command->grantEligibleAmount !== null
            ? Money::fromDecimal($command->grantEligibleAmount, $currency)
            : null;

        $updatedStage = new CapexStage(
            id: CapexStageId::fromString($command->stageId),
            name: $command->stageName,
            netAmount: $netAmount,
            startDate: $startDate,
            durationMonths: $command->durationMonths,
            kst: $kst,
            isGrantEligible: $command->isGrantEligible,
            grantEligibleAmount: $grantEligible,
            stageOrder: $command->stageOrder
        );

        $project->updateCapexStage($updatedStage);

        $this->repository->save($project);
    }
}
