<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Application\Commands\AddCapexStage;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Application\Exceptions\InvestmentProjectNotFoundException;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Repositories\InvestmentProjectRepositoryInterface;
use App\Contexts\InvestmentProject\Domain\ValueObjects\CapexStageId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\InvestmentProjectId;
use App\Contexts\InvestmentProject\Domain\ValueObjects\KstClassification;
use DateTimeImmutable;

final class AddCapexStageHandler
{
    public function __construct(
        private readonly InvestmentProjectRepositoryInterface $repository
    ) {
    }

    public function handle(AddCapexStageCommand $command): string
    {
        $project = $this->repository->findById(
            InvestmentProjectId::fromString($command->projectId),
            $command->companyId
        );

        if ($project === null) {
            throw InvestmentProjectNotFoundException::withId($command->projectId, $command->companyId);
        }

        $currency = Currency::from($command->currency);
        $netAmount = Money::fromDecimal($command->netAmount, $currency);

        $startDate = $command->startDate !== null
            ? new DateTimeImmutable($command->startDate)
            : $project->startDate();

        $kst = $command->kstCode !== null
            ? KstClassification::fromCode($command->kstCode)
            : KstClassification::default();

        $grantEligible = $command->grantEligibleAmount !== null
            ? Money::fromDecimal($command->grantEligibleAmount, $currency)
            : null;

        $stageId = $command->stageId !== null
            ? CapexStageId::fromString($command->stageId)
            : CapexStageId::generate();

        $stage = new CapexStage(
            id: $stageId,
            name: $command->stageName,
            netAmount: $netAmount,
            startDate: $startDate,
            durationMonths: $command->durationMonths,
            kst: $kst,
            isGrantEligible: $command->isGrantEligible,
            grantEligibleAmount: $grantEligible,
            stageOrder: $command->stageOrder
        );

        $project->addCapexStage($stage);

        $this->repository->save($project);

        return $stage->id();
    }
}
