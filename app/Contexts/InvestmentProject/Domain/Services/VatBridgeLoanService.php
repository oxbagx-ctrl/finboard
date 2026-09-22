<?php

declare(strict_types=1);

namespace App\Contexts\InvestmentProject\Domain\Services;

use App\Contexts\Finance\Domain\ValueObjects\Currency;
use App\Contexts\Finance\Domain\ValueObjects\Money;
use App\Contexts\InvestmentProject\Domain\Entities\CapexStage;
use App\Contexts\InvestmentProject\Domain\Model\InvestmentProject;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatBridgePeriod;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatBridgeSchedule;
use App\Contexts\InvestmentProject\Domain\ValueObjects\VatRate;
use DateTimeImmutable;
use InvalidArgumentException;

final class VatBridgeLoanService
{
    /**
     * Generate complete VAT Bridge loan schedule for an InvestmentProject aggregate.
     */
    public function generateSchedule(
        InvestmentProject $project,
        int $reimbursementLagMonths = 2,
        float $annualInterestRate = 6.50
    ): VatBridgeSchedule {
        return $this->generateScheduleFromStages(
            stages: $project->capexStages(),
            vatRate: $project->vatRate(),
            reimbursementLagMonths: $reimbursementLagMonths,
            annualInterestRate: $annualInterestRate,
            facilityLimit: $project->financingStructure()->vatBridgeLoanAmount(),
            startDate: $project->startDate()
        );
    }

    /**
     * Alias for generateSchedule.
     */
    public function generateFromAggregate(
        InvestmentProject $project,
        int $reimbursementLagMonths = 2,
        float $annualInterestRate = 6.50
    ): VatBridgeSchedule {
        return $this->generateSchedule($project, $reimbursementLagMonths, $annualInterestRate);
    }

    /**
     * Generate VAT Bridge loan schedule from an array of CapexStages.
     *
     * @param array<CapexStage> $stages
     */
    public function generateScheduleFromStages(
        array $stages,
        VatRate $vatRate,
        int $reimbursementLagMonths = 2,
        float $annualInterestRate = 6.50,
        ?Money $facilityLimit = null,
        ?DateTimeImmutable $startDate = null
    ): VatBridgeSchedule {
        if ($reimbursementLagMonths < 1 || $reimbursementLagMonths > 12) {
            throw new InvalidArgumentException(
                sprintf('Reimbursement lag must be between 1 and 12 months, %d given.', $reimbursementLagMonths)
            );
        }

        if ($annualInterestRate < 0.0 || $annualInterestRate > 50.0) {
            throw new InvalidArgumentException(
                sprintf('Annual interest rate must be between 0.0%% and 50.0%%, %.2f%% given.', $annualInterestRate)
            );
        }

        if (empty($stages)) {
            $currency = $facilityLimit?->currency() ?? Currency::PLN;

            return new VatBridgeSchedule(
                facilityLimit: $facilityLimit ?? Money::zero($currency),
                reimbursementLagMonths: $reimbursementLagMonths,
                annualInterestRate: $annualInterestRate,
                periods: []
            );
        }

        $currency = $stages[0]->netAmount()->currency();
        $limit = $facilityLimit ?? Money::zero($currency);

        // Determine base start date (normalized to 1st of month)
        $baseDate = $startDate ?? $stages[0]->startDate();
        $baseStartMonth = new DateTimeImmutable($baseDate->format('Y-m-01'));

        // 1. Calculate monthly net CAPEX per month index (t = 1, 2, ...)
        /** @var array<int, Money> $monthlyNetCapex */
        $monthlyNetCapex = [];
        $maxCapexMonth = 1;

        foreach ($stages as $stage) {
            $stageStart = new DateTimeImmutable($stage->startDate()->format('Y-m-01'));
            $diff = $baseStartMonth->diff($stageStart);
            $monthOffset = ($diff->y * 12) + $diff->m;
            if ($stageStart < $baseStartMonth) {
                $monthOffset = 0;
            }

            $duration = $stage->durationMonths();
            $stageNet = $stage->netAmount();
            $stageVat = $vatRate->calculateVat($stageNet);
            $stageNetAllocated = Money::zero($currency);
            $stageVatAllocated = Money::zero($currency);

            for ($i = 0; $i < $duration; $i++) {
                $m = 1 + $monthOffset + $i;
                if (!isset($monthlyNetCapex[$m])) {
                    $monthlyNetCapex[$m] = Money::zero($currency);
                }
                if (!isset($monthlyVatIncurred[$m])) {
                    $monthlyVatIncurred[$m] = Money::zero($currency);
                }

                if ($i === $duration - 1) {
                    $monthNet = $stageNet->subtract($stageNetAllocated);
                    $monthVat = $stageVat->subtract($stageVatAllocated);
                } else {
                    $monthNet = $stage->monthlyCapex();
                    $monthVat = $vatRate->calculateVat($monthNet);
                    $stageNetAllocated = $stageNetAllocated->add($monthNet);
                    $stageVatAllocated = $stageVatAllocated->add($monthVat);
                }

                $monthlyNetCapex[$m] = $monthlyNetCapex[$m]->add($monthNet);
                $monthlyVatIncurred[$m] = $monthlyVatIncurred[$m]->add($monthVat);

                if ($m > $maxCapexMonth) {
                    $maxCapexMonth = $m;
                }
            }
        }

        // Total schedule duration is max Capex month + reimbursement lag months
        $totalScheduleMonths = $maxCapexMonth + $reimbursementLagMonths;
        $monthlyRate = ($annualInterestRate / 100.0) / 12.0;

        // 2. Map scheduled VAT refunds
        /** @var array<int, Money> $monthlyVatRefunds */
        $monthlyVatRefunds = [];

        for ($m = 1; $m <= $totalScheduleMonths; $m++) {
            $vat = $monthlyVatIncurred[$m] ?? Money::zero($currency);

            // Refund occurs at m + reimbursementLagMonths
            $refundMonth = $m + $reimbursementLagMonths;
            if (!isset($monthlyVatRefunds[$refundMonth])) {
                $monthlyVatRefunds[$refundMonth] = Money::zero($currency);
            }
            $monthlyVatRefunds[$refundMonth] = $monthlyVatRefunds[$refundMonth]->add($vat);
        }

        // 3. Build monthly periods
        $periods = [];
        $balance = Money::zero($currency);

        for ($m = 1; $m <= $totalScheduleMonths; $m++) {
            $periodDate = $baseStartMonth->modify(sprintf('+%d months', $m - 1));
            $openingBalance = $balance;

            $netCapex = $monthlyNetCapex[$m] ?? Money::zero($currency);
            $drawdown = $monthlyVatIncurred[$m] ?? Money::zero($currency);
            $repayment = $monthlyVatRefunds[$m] ?? Money::zero($currency);

            // Interest on opening balance
            $interest = $monthlyRate > 0.0
                ? $openingBalance->multiply($monthlyRate)
                : Money::zero($currency);

            // Balance after drawdown and repayment
            $closingBalance = $openingBalance->add($drawdown)->subtract($repayment);
            if ($closingBalance->isNegative() || ($m === $totalScheduleMonths)) {
                $closingBalance = Money::zero($currency);
            }

            $periods[] = new VatBridgePeriod(
                periodNumber: $m,
                date: $periodDate,
                capexNet: $netCapex,
                vatIncurred: $drawdown,
                vatRefunded: $repayment,
                openingBalance: $openingBalance,
                drawdown: $drawdown,
                repayment: $repayment,
                interestPayment: $interest,
                closingBalance: $closingBalance,
                monthlyInterestRate: $monthlyRate
            );

            $balance = $closingBalance;
        }

        return new VatBridgeSchedule(
            facilityLimit: $limit,
            reimbursementLagMonths: $reimbursementLagMonths,
            annualInterestRate: $annualInterestRate,
            periods: $periods
        );
    }

    /**
     * Calculate recommended VAT facility limit (equal to peak exposure during construction).
     *
     * @param array<CapexStage> $stages
     */
    public function calculateRecommendedFacilityLimit(
        array $stages,
        VatRate $vatRate,
        int $reimbursementLagMonths = 2
    ): Money {
        $schedule = $this->generateScheduleFromStages(
            stages: $stages,
            vatRate: $vatRate,
            reimbursementLagMonths: $reimbursementLagMonths,
            annualInterestRate: 0.0
        );

        return $schedule->peakExposure();
    }
}
