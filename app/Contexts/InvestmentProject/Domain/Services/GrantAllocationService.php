<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Services;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\ValueObjects\GrantCalculationResult;
use App\Contexts\InvestmentProject\Domain\ValueObjects\GrantTranche;
use App\Contexts\InvestmentProject\Domain\ValueObjects\GrantTrancheType;
use DateTimeImmutable;
use InvalidArgumentException;

final class GrantAllocationService
{
    /**
     * Calculates total net CAPEX from an array of CapexStage entities.
     *
     * @param array<CapexStage> $capexStages
     */
    public function calculateTotalCapex(array $capexStages, ?Currency $currency = null): Money
    {
        $resolvedCurrency = $currency ?? (!empty($capexStages) ? $capexStages[0]->netAmount()->currency() : Currency::PLN);
        $total = Money::zero($resolvedCurrency);

        foreach ($capexStages as $stage) {
            $total = $total->add($stage->netAmount());
        }

        return $total;
    }

    /**
     * Calculates total eligible costs from an array of CapexStage entities.
     *
     * @param array<CapexStage> $capexStages
     */
    public function calculateEligibleCosts(array $capexStages, ?Currency $currency = null): Money
    {
        $resolvedCurrency = $currency ?? (!empty($capexStages) ? $capexStages[0]->netAmount()->currency() : Currency::PLN);
        $eligibleTotal = Money::zero($resolvedCurrency);

        foreach ($capexStages as $stage) {
            if ($stage->isGrantEligible()) {
                $eligibleTotal = $eligibleTotal->add($stage->grantEligibleAmount());
            }
        }

        return $eligibleTotal;
    }

    /**
     * Calculates the maximum co-financing grant amount based on eligible costs, intensity rate,
     * and optional program cap.
     */
    public function calculateMaxGrant(
        Money $eligibleCosts,
        float $coFinancingRatePercent,
        ?Money $grantCap = null
    ): Money {
        if ($coFinancingRatePercent < 0.0 || $coFinancingRatePercent > 100.0) {
            throw new InvalidArgumentException(
                sprintf('Co-financing rate must be between 0.0%% and 100.0%%, %.2f%% given.', $coFinancingRatePercent)
            );
        }

        if ($eligibleCosts->isZero() || $coFinancingRatePercent === 0.0) {
            return Money::zero($eligibleCosts->currency());
        }

        $rateDecimal = (string) round($coFinancingRatePercent / 100.0, 6);
        $calculatedGrant = $eligibleCosts->multiply($rateDecimal);

        if ($grantCap !== null && $grantCap->isPositive() && $calculatedGrant->greaterThan($grantCap)) {
            return $grantCap;
        }

        return $calculatedGrant;
    }

    /**
     * Performs complete grant calculation and generates the disbursement tranche schedule.
     *
     * @param array<CapexStage> $capexStages
     */
    public function calculate(
        string $grantProgramName,
        array $capexStages,
        float $coFinancingRatePercent,
        ?Money $grantCap = null,
        float $advanceRatePercent = 0.0,
        float $finalRetentionPercent = 10.0,
        int $reimbursementLagMonths = 2,
        ?DateTimeImmutable $projectStartDate = null,
        ?Currency $currency = null
    ): GrantCalculationResult {
        if (trim($grantProgramName) === '') {
            throw new InvalidArgumentException('Grant program name cannot be empty.');
        }

        if ($advanceRatePercent < 0.0 || $advanceRatePercent > 100.0) {
            throw new InvalidArgumentException('Advance payment rate must be between 0.0% and 100.0%.');
        }

        if ($finalRetentionPercent < 0.0 || $finalRetentionPercent > 100.0) {
            throw new InvalidArgumentException('Final retention rate must be between 0.0% and 100.0%.');
        }

        if (($advanceRatePercent + $finalRetentionPercent) > 100.0) {
            throw new InvalidArgumentException('Sum of advance and final retention rates cannot exceed 100.0%.');
        }

        if ($reimbursementLagMonths < 1) {
            throw new InvalidArgumentException(
                sprintf('Reimbursement lag must be at least 1 month, %d given.', $reimbursementLagMonths)
            );
        }

        $startDate = $projectStartDate ?? new DateTimeImmutable('now');
        $resolvedCurrency = $currency
            ?? (!empty($capexStages) ? $capexStages[0]->netAmount()->currency() : Currency::PLN);

        $totalCapex = $this->calculateTotalCapex($capexStages, $resolvedCurrency);
        $totalEligibleCosts = $this->calculateEligibleCosts($capexStages, $resolvedCurrency);
        $nonEligibleCosts = $totalCapex->subtract($totalEligibleCosts);

        $maxGrantAmount = $this->calculateMaxGrant($totalEligibleCosts, $coFinancingRatePercent, $grantCap);
        $beneficiaryEligibleContribution = $totalEligibleCosts->subtract($maxGrantAmount);
        $totalBeneficiaryContribution = $nonEligibleCosts->add($beneficiaryEligibleContribution);

        $advanceAmount = Money::zero($resolvedCurrency);
        if ($advanceRatePercent > 0.0 && !$maxGrantAmount->isZero()) {
            $advDecimal = (string) round($advanceRatePercent / 100.0, 6);
            $advanceAmount = $maxGrantAmount->multiply($advDecimal);
        }

        $tranches = $this->generateTranches(
            $capexStages,
            $maxGrantAmount,
            $totalEligibleCosts,
            $advanceAmount,
            $finalRetentionPercent,
            $reimbursementLagMonths,
            $startDate,
            $resolvedCurrency
        );

        return new GrantCalculationResult(
            $grantProgramName,
            $totalCapex,
            $totalEligibleCosts,
            $nonEligibleCosts,
            $coFinancingRatePercent,
            $maxGrantAmount,
            $advanceAmount,
            $beneficiaryEligibleContribution,
            $totalBeneficiaryContribution,
            $tranches
        );
    }

    /**
     * Generates grant allocation calculation from an InvestmentProject aggregate.
     */
    public function generateFromAggregate(
        InvestmentProject $project,
        string $grantProgramName = 'Dofinansowanie Dotacyjne UE / KPO',
        ?float $overrideCoFinancingRate = null,
        ?Money $grantCap = null,
        float $advanceRatePercent = 20.0,
        float $finalRetentionPercent = 10.0,
        int $reimbursementLagMonths = 2
    ): GrantCalculationResult {
        $financingStructure = $project->financingStructure();
        $rate = $overrideCoFinancingRate ?? $financingStructure->grantIntensityPercent();

        if ($rate <= 0.0 && $financingStructure->grantAmount()->isPositive()) {
            // Back-calculate intensity if grant amount was set but intensity was not
            $eligible = $this->calculateEligibleCosts($project->capexStages(), $project->financingStructure()->grantAmount()->currency());
            if ($eligible->isPositive()) {
                $rate = ($financingStructure->grantAmount()->toDecimal() / $eligible->toDecimal()) * 100.0;
            }
        }

        $effectiveCap = $grantCap ?? ($financingStructure->grantAmount()->isPositive() ? $financingStructure->grantAmount() : null);

        return $this->calculate(
            $grantProgramName,
            $project->capexStages(),
            $rate,
            $effectiveCap,
            $advanceRatePercent,
            $finalRetentionPercent,
            $reimbursementLagMonths,
            $project->startDate(),
            $financingStructure->investor1Equity()->currency()
        );
    }

    /**
     * Alias for generateFromAggregate.
     */
    public function generateSchedule(
        InvestmentProject $project,
        string $grantProgramName = 'Dofinansowanie Dotacyjne UE / KPO',
        ?float $overrideCoFinancingRate = null,
        ?Money $grantCap = null,
        float $advanceRatePercent = 20.0,
        float $finalRetentionPercent = 10.0,
        int $reimbursementLagMonths = 2
    ): GrantCalculationResult {
        return $this->generateFromAggregate(
            $project,
            $grantProgramName,
            $overrideCoFinancingRate,
            $grantCap,
            $advanceRatePercent,
            $finalRetentionPercent,
            $reimbursementLagMonths
        );
    }

    /**
     * Generates detailed tranche schedule for advance, interim milestones, and final settlement.
     *
     * @param array<CapexStage> $capexStages
     * @return array<GrantTranche>
     */
    private function generateTranches(
        array $capexStages,
        Money $maxGrantAmount,
        Money $totalEligibleCosts,
        Money $advanceAmount,
        float $finalRetentionPercent,
        int $reimbursementLagMonths,
        DateTimeImmutable $projectStartDate,
        Currency $currency
    ): array {
        if ($maxGrantAmount->isZero()) {
            return [];
        }

        $tranches = [];
        $cumulativeDisbursed = Money::zero($currency);
        $trancheNumber = 1;

        // 1. Advance Tranche (Zaliczka)
        if ($advanceAmount->isPositive()) {
            $cumulativeDisbursed = $cumulativeDisbursed->add($advanceAmount);
            $tranches[] = new GrantTranche(
                $trancheNumber++,
                1, // Month 1: project inception
                $projectStartDate,
                GrantTrancheType::ADVANCE,
                Money::zero($currency), // Advance does not directly settle costs yet
                $advanceAmount,
                $cumulativeDisbursed,
                'Wypłata zaliczki wstępnej na realizację projektu inwestycyjnego'
            );
        }

        // Remaining grant to disburse through interim reimbursements and final retention
        $remainingGrant = $maxGrantAmount->subtract($advanceAmount);
        if ($remainingGrant->isZero()) {
            return $tranches;
        }

        // Calculate theoretical final retention
        $targetFinalRetention = Money::zero($currency);
        if ($finalRetentionPercent > 0.0) {
            $finalDecimal = (string) round($finalRetentionPercent / 100.0, 6);
            $targetFinalRetention = $maxGrantAmount->multiply($finalDecimal);
            if ($targetFinalRetention->greaterThan($remainingGrant)) {
                $targetFinalRetention = $remainingGrant;
            }
        }

        $interimPool = $remainingGrant->subtract($targetFinalRetention);

        // Filter eligible stages
        $eligibleStages = array_values(
            array_filter($capexStages, fn (CapexStage $s) => $s->isGrantEligible() && $s->grantEligibleAmount()->isPositive())
        );

        // Sort by stage order and completion date
        usort($eligibleStages, function (CapexStage $a, CapexStage $b) {
            $orderCmp = $a->stageOrder() <=> $b->stageOrder();
            if ($orderCmp !== 0) {
                return $orderCmp;
            }

            return $a->completionDate() <=> $b->completionDate();
        });

        $interimAllocated = Money::zero($currency);
        $lastDisbursementMonth = 1;

        if (!empty($eligibleStages) && !$interimPool->isZero() && !$totalEligibleCosts->isZero()) {
            $count = count($eligibleStages);
            foreach ($eligibleStages as $idx => $stage) {
                // Determine stage completion month relative to project start
                $diffMonths = $this->calculateMonthOffset($projectStartDate, $stage->completionDate());
                $disbursementMonth = max(1, $diffMonths + $reimbursementLagMonths);
                $disbursementDate = $projectStartDate->modify(sprintf('+%d months', $disbursementMonth));

                if ($disbursementMonth > $lastDisbursementMonth) {
                    $lastDisbursementMonth = $disbursementMonth;
                }

                // Allocate interim portion proportional to stage eligible cost
                if ($idx === $count - 1 && $targetFinalRetention->isZero()) {
                    // Last stage and no final retention: absorb remainder to avoid rounding mismatch
                    $stageDisbursement = $interimPool->subtract($interimAllocated);
                } else {
                    $shareDecimal = (string) round(
                        $stage->grantEligibleAmount()->toDecimal() / $totalEligibleCosts->toDecimal(),
                        6
                    );
                    $stageDisbursement = $interimPool->multiply($shareDecimal);
                }

                if ($stageDisbursement->isPositive()) {
                    $interimAllocated = $interimAllocated->add($stageDisbursement);
                    $cumulativeDisbursed = $cumulativeDisbursed->add($stageDisbursement);

                    $tranches[] = new GrantTranche(
                        $trancheNumber++,
                        $disbursementMonth,
                        $disbursementDate,
                        GrantTrancheType::INTERIM,
                        $stage->grantEligibleAmount(),
                        $stageDisbursement,
                        $cumulativeDisbursed,
                        sprintf('Refundacja wydatków kwalifikowanych etapu: %s', $stage->name())
                    );
                }
            }
        }

        // 3. Final Settlement Tranche (Płatność końcowa)
        // Disburse exact remainder so sum of all tranches equals maxGrantAmount
        $finalDisbursement = $maxGrantAmount->subtract($cumulativeDisbursed);

        if ($finalDisbursement->isPositive()) {
            $finalMonth = $lastDisbursementMonth + 1;
            $finalDate = $projectStartDate->modify(sprintf('+%d months', $finalMonth));
            $cumulativeDisbursed = $cumulativeDisbursed->add($finalDisbursement);

            $tranches[] = new GrantTranche(
                $trancheNumber,
                $finalMonth,
                $finalDate,
                GrantTrancheType::FINAL,
                Money::zero($currency),
                $finalDisbursement,
                $cumulativeDisbursed,
                'Płatność końcowa po weryfikacji wniosku o płatność końcową i audycie projektu'
            );
        }

        return $tranches;
    }

    /**
     * Calculates the month offset between two dates.
     */
    private function calculateMonthOffset(DateTimeImmutable $from, DateTimeImmutable $to): int
    {
        $diff = $from->diff($to);
        $months = ($diff->y * 12) + $diff->m;

        return $diff->invert === 1 ? -$months : $months;
    }
}
